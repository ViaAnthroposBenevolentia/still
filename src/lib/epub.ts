import { unzipSync } from 'fflate';

const invalid = () => new Error('This EPUB is damaged or has an unsupported structure.');
const elements = (root: Document | Element, name: string): Element[] =>
	Array.from(root.getElementsByTagNameNS('*', name));

const parseXml = (source: Uint8Array): Document => {
	const xml = new DOMParser().parseFromString(new TextDecoder().decode(source), 'application/xml');
	if (elements(xml, 'parsererror').length) throw invalid();
	return xml;
};

/** Resolve package-relative references without fetching any book resources. */
const resolvePath = (reference: string, base = ''): string => {
	const root = 'https://epub.invalid/';
	const url = new URL(reference, new URL(base, root));
	if (url.origin !== new URL(root).origin || url.search) throw invalid();
	return decodeURIComponent(url.pathname.slice(1));
};

const chapterText = (document: Document): string => {
	const body = elements(document, 'body')[0];
	if (!body) throw invalid();
	const parts: string[] = [];
	const visit = (node: Node) => {
		if (node.nodeType === Node.TEXT_NODE || node.nodeType === Node.CDATA_SECTION_NODE) {
			parts.push((node.textContent ?? '').replace(/\s+/gu, ' '));
			return;
		}
		if (!(node instanceof Element)) return;
		const name = node.localName.toLowerCase();
		if (
			['script', 'style', 'svg', 'math', 'iframe', 'object', 'noscript'].includes(name) ||
			node.hasAttribute('hidden') ||
			node.getAttribute('aria-hidden') === 'true'
		)
			return;
		const block = /^(?:p|div|section|article|h[1-6]|li|blockquote|pre|tr|hr)$/u.test(name);
		if (block || name === 'br') parts.push('\n\n');
		for (const child of node.childNodes) visit(child);
		if (block) parts.push('\n\n');
		if (name === 'td' || name === 'th') parts.push(' ');
	};
	visit(body);
	return parts
		.join('')
		.split(/\n\s*\n/u)
		.map((part) => part.trim())
		.filter(Boolean)
		.join('\n\n');
};

/** Extract plain text in spine order. Book markup never enters the live DOM. */
export const readEpub = (data: Uint8Array): { title: string; text: string } => {
	let expanded = 0;
	let files: ReturnType<typeof unzipSync>;
	try {
		files = unzipSync(data, {
			filter: (file) => {
				expanded += file.originalSize;
				if (expanded > 50 * 1024 * 1024)
					throw new Error('Choose an EPUB smaller than 50 MB when uncompressed.');
				return true;
			},
		});
	} catch (cause) {
		if (cause instanceof Error && cause.message.startsWith('Choose an EPUB')) throw cause;
		throw invalid();
	}
	const readXml = (path: string) => {
		const source = Object.hasOwn(files, path) ? files[path] : undefined;
		if (!source) throw invalid();
		return parseXml(source);
	};
	const container = readXml('META-INF/container.xml');
	const packagePath = elements(container, 'rootfile')
		.find((entry) => entry.getAttribute('media-type') === 'application/oebps-package+xml')
		?.getAttribute('full-path');
	if (!packagePath) throw invalid();
	const packageDocument = readXml(packagePath);
	const metadata = elements(packageDocument, 'metadata')[0];
	const title = metadata ? (elements(metadata, 'title')[0]?.textContent?.trim() ?? '') : '';
	const manifest = new Map(
		elements(packageDocument, 'item').map((item) => [item.getAttribute('id'), item]),
	);
	const encrypted = new Set(
		Object.hasOwn(files, 'META-INF/encryption.xml')
			? elements(readXml('META-INF/encryption.xml'), 'CipherReference').map((entry) =>
					resolvePath(entry.getAttribute('URI') ?? ''),
				)
			: [],
	);
	const chapters: string[] = [];
	let textBytes = 0;
	for (const reference of elements(packageDocument, 'itemref')) {
		if (reference.getAttribute('linear') === 'no') continue;
		const item = manifest.get(reference.getAttribute('idref'));
		const href = item?.getAttribute('href');
		if (!href) throw invalid();
		if (item?.getAttribute('properties')?.split(/\s+/u).includes('nav')) continue;
		const path = resolvePath(href, packagePath);
		if (encrypted.has(path))
			throw new Error('This EPUB contains encrypted text. Choose a DRM-free EPUB.');
		if (item?.getAttribute('media-type') !== 'application/xhtml+xml')
			throw new Error(
				'This EPUB uses an unsupported chapter format. Choose an EPUB with text chapters.',
			);
		const text = chapterText(readXml(path));
		textBytes += new TextEncoder().encode(text).length + 2;
		if (textBytes > 5 * 1024 * 1024) throw new Error('Choose an EPUB with less than 5 MB of text.');
		if (text) chapters.push(text);
	}
	const text = chapters.join('\n\n');
	if (!/[\p{L}\p{N}]/u.test(text))
		throw new Error('This EPUB has no readable text. Image-only books are not supported.');
	return { title, text };
};
