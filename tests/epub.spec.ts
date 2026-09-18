import { expect, test, type Page } from '@playwright/test';
import { strToU8, zipSync } from 'fflate';

const makeEpub = (overrides: Record<string, string> = {}, version = '3.0') => {
	const files = {
		mimetype: 'application/epub+zip',
		'META-INF/container.xml':
			'<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="EPUB/book.opf" media-type="application/oebps-package+xml"/></rootfiles></container>',
		'EPUB/book.opf': `<package xmlns="http://www.idpf.org/2007/opf" version="${version}"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Quiet &amp; Light</dc:title></metadata><manifest><item id="second" href="Text/second.xhtml" media-type="application/xhtml+xml"/><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="first" href="Text/../Text/first%20chapter.xhtml#start" media-type="application/xhtml+xml"/><item id="extra" href="extra.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="nav"/><itemref idref="first"/><itemref idref="extra" linear="no"/><itemref idref="second"/></spine></package>`,
		'EPUB/Text/second.xhtml':
			'<html xmlns="http://www.w3.org/1999/xhtml"><body><p>The second chapter.</p></body></html>',
		'EPUB/Text/first chapter.xhtml':
			'<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Ignore head</title></head><body><h1>First chapter</h1><p>Hello <em>quiet</em> world &amp; friends.</p><p>Another paragraph.<br/>A new line.</p><script>throw new Error("Never execute")</script><style>Ignore styles</style><p hidden="hidden">Ignore hidden</p><img src="https://example.invalid/cover.jpg"/></body></html>',
		'META-INF/encryption.xml':
			'<encryption xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><EncryptedData xmlns="http://www.w3.org/2001/04/xmlenc#"><CipherData><CipherReference URI="EPUB/font.otf"/></CipherData></EncryptedData></encryption>',
		...overrides,
	};
	return Buffer.from(
		zipSync(Object.fromEntries(Object.entries(files).map(([name, text]) => [name, strToU8(text)]))),
	);
};

const openImport = async (page: Page) => {
	await page.goto('/books');
	await page.getByRole('banner').getByRole('link', { name: 'Add a book', exact: true }).click();
};

const upload = (page: Page, buffer: Buffer) =>
	page
		.getByLabel('Upload book file')
		.setInputFiles({ name: 'fallback-title.epub', mimeType: 'application/epub+zip', buffer });

for (const version of ['2.0', '3.0']) {
	test(`EPUB ${version} imports metadata and paragraphs in spine order and persists readable text`, async ({
		page,
	}) => {
		const externalRequests: string[] = [];
		page.on('request', (request) => {
			if (request.url().includes('example.invalid')) externalRequests.push(request.url());
		});
		await openImport(page);
		await upload(page, makeEpub({}, version));
		await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toHaveValue(
			'Quiet & Light',
		);
		await expect(page.getByRole('textbox', { name: 'Text', exact: true })).toHaveValue(
			'First chapter\n\nHello quiet world & friends.\n\nAnother paragraph.\n\nA new line.\n\nThe second chapter.',
		);
		await page.getByRole('button', { name: 'Add to library' }).click();
		await expect(page).toHaveURL('/books/quiet-light');
		await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeEnabled();
		await page.getByRole('link', { name: 'Text view' }).click();
		await expect(page).toHaveURL('/books/quiet-light?view=text');
		await page.reload();
		await expect(page.getByRole('article', { name: 'Book text' })).toContainText(
			'The second chapter.',
		);
		expect(externalRequests).toEqual([]);
	});
}

const invalidBooks = [
	{ name: 'broken archive', buffer: Buffer.from('not a zip'), error: 'This EPUB is damaged' },
	{
		name: 'missing chapter',
		buffer: makeEpub({
			'EPUB/book.opf': '<package><manifest/><spine><itemref idref="missing"/></spine></package>',
		}),
		error: 'This EPUB is damaged',
	},
	{
		name: 'malformed chapter',
		buffer: makeEpub({ 'EPUB/Text/second.xhtml': '<html><body><p>broken</body>' }),
		error: 'This EPUB is damaged',
	},
	{
		name: 'encrypted chapter',
		buffer: makeEpub({
			'META-INF/encryption.xml':
				'<encryption><CipherReference URI="EPUB/Text/second.xhtml"/></encryption>',
		}),
		error: 'Choose a DRM-free EPUB',
	},
	{
		name: 'image-only book',
		buffer: makeEpub({
			'EPUB/Text/first chapter.xhtml': '<html><body><img src="cover.jpg"/></body></html>',
			'EPUB/Text/second.xhtml': '<html><body/></html>',
		}),
		error: 'This EPUB has no readable text',
	},
	{
		name: 'oversized expanded archive',
		buffer: makeEpub({ 'large.txt': 'x'.repeat(50 * 1024 * 1024) }),
		error: 'smaller than 50 MB when uncompressed',
	},
];

for (const { name, buffer, error } of invalidBooks) {
	test(`rejects ${name} and preserves the draft for recovery`, async ({ page }) => {
		await openImport(page);
		await page.getByRole('textbox', { name: 'Title', exact: true }).fill('My draft');
		await page.getByRole('textbox', { name: 'Text', exact: true }).fill('Keep this text.');
		await upload(page, buffer);
		await expect(page.getByRole('alert')).toContainText(error);
		await expect(page.getByRole('textbox', { name: 'Text', exact: true })).toHaveValue(
			'Keep this text.',
		);
		await upload(page, makeEpub());
		await expect(page.getByRole('alert')).toHaveCount(0);
		await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toHaveValue('My draft');
		await page.getByRole('button', { name: 'Add to library' }).click();
		await expect(page).toHaveURL('/books/my-draft');
	});
}

test('uses the filename when EPUB title metadata is absent', async ({ page }) => {
	await openImport(page);
	await upload(
		page,
		makeEpub({
			'EPUB/book.opf':
				'<package><manifest><item id="chapter" href="Text/second.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="chapter"/></spine></package>',
		}),
	);
	await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toHaveValue(
		'fallback title',
	);
});
