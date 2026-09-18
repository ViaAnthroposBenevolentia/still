import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const chapter =
	'The morning was quiet and the light fell softly through the window. She opened her book and began to read, one word at a time.\n\nOutside the world carried on. Inside there was only the page, and the possibility of somewhere new.';

const addBook = async (page: Page, title = 'A quiet morning', text = chapter) => {
	await page.goto('/');
	await page.getByRole('banner').getByRole('button', { name: 'Add a book', exact: true }).click();
	await page.getByRole('textbox', { name: 'Title', exact: true }).fill(title);
	await page.getByRole('textbox', { name: 'Text', exact: true }).fill(text);
	await page.getByRole('button', { name: 'Add to library' }).click();
	await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeEnabled();
};

test('imports, saves a position and preferences, and resumes from a direct book URL', async ({
	page,
}) => {
	await addBook(page);
	await expect(page).toHaveURL('/books/a-quiet-morning');
	await page.getByRole('button', { name: 'Forward 15 words' }).click();
	await page.getByRole('button', { name: 'Increase speed' }).click();
	await page.getByRole('combobox', { name: 'Words per frame' }).selectOption('3');
	await page.getByRole('link', { name: 'Library', exact: true }).click();
	await expect(page.getByRole('link', { name: /PICK UP WHERE YOU LEFT OFF/ })).toBeVisible();
	await page.goto('/books/a-quiet-morning');
	await expect(page.getByRole('slider', { name: 'Reading position' })).toHaveValue('15');
	await expect(page.getByRole('spinbutton', { name: 'Words per minute' })).toHaveValue('375');
	await expect(page.getByRole('combobox', { name: 'Words per frame' })).toHaveValue('3');
	await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
});

test('playback advances, pauses, seeks, and finishes without skipping the final word', async ({
	page,
}) => {
	await page.clock.install();
	await addBook(page, 'A short read', 'One two three.');
	await expect(
		page.getByRole('region', { name: 'Reading context' }).getByRole('paragraph'),
	).toHaveText('One two three.');
	await page.getByRole('button', { name: 'Play', exact: true }).click();
	await page.clock.runFor(300);
	await expect(page.getByRole('slider', { name: 'Reading position' })).toHaveValue('1');
	await page.getByRole('button', { name: 'Pause', exact: true }).click();
	await page.clock.runFor(3000);
	await expect(page.getByRole('slider', { name: 'Reading position' })).toHaveValue('1');
	await page.getByRole('button', { name: 'Read from One, word 1' }).click();
	await expect(page.getByRole('slider', { name: 'Reading position' })).toHaveValue('0');
	await page.getByRole('button', { name: 'Play', exact: true }).click();
	await page.clock.runFor(2000);
	await expect(page.getByRole('button', { name: 'Read again' })).toBeVisible();
	await expect(page.getByRole('slider', { name: 'Reading position' })).toHaveValue('3');
});

test('file import handles duplicate titles and deletion without affecting another book', async ({
	page,
}) => {
	await addBook(page);
	await page.goto('/');
	await page.getByRole('banner').getByRole('button', { name: 'Add a book', exact: true }).click();
	await page.getByLabel('Upload text file').setInputFiles({
		name: 'A quiet morning.txt',
		mimeType: 'text/plain',
		buffer: Buffer.from(chapter),
	});
	await page.getByRole('button', { name: 'Add to library' }).click();
	await expect(page).toHaveURL('/books/a-quiet-morning-2');
	await page.getByRole('link', { name: 'Library', exact: true }).click();
	await page.getByRole('button', { name: 'Delete A quiet morning', exact: true }).first().click();
	await page.getByRole('button', { name: 'Remove book', exact: true }).click();
	await expect(page.getByRole('link', { name: 'Read A quiet morning', exact: true })).toHaveCount(
		1,
	);
	await page.reload();
	await expect(page.getByRole('link', { name: 'Read A quiet morning', exact: true })).toHaveCount(
		1,
	);
});

test('plain text and library are accessible on a narrow screen', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await addBook(page);
	await expect(
		page.locator('[aria-live="assertive"] .word-frame, [aria-live="polite"] .word-frame'),
	).toHaveCount(0);
	await expect(
		new AxeBuilder({ page }).analyze().then((result) => result.violations),
	).resolves.toEqual([]);
	await page.getByRole('button', { name: 'Text view' }).click();
	await expect(page.getByRole('article', { name: 'Book text' })).toContainText(
		'Outside the world carried on.',
	);
	await expect(
		new AxeBuilder({ page }).analyze().then((result) => result.violations),
	).resolves.toEqual([]);
	await page.getByRole('link', { name: 'Library', exact: true }).click();
	await expect(page.getByRole('link', { name: 'Read A quiet morning', exact: true })).toBeVisible();
	await expect(
		new AxeBuilder({ page }).analyze().then((result) => result.violations),
	).resolves.toEqual([]);
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('keyboard controls leave input editing alone and a missing book has a way home', async ({
	page,
}) => {
	await addBook(page);
	await page.getByRole('button', { name: 'Play', exact: true }).focus();
	await page.keyboard.press('ArrowRight');
	await expect(page.getByRole('slider', { name: 'Reading position' })).toHaveValue('15');
	await page.keyboard.press('ArrowUp');
	await expect(page.getByRole('spinbutton', { name: 'Words per minute' })).toHaveValue('375');
	await page.getByRole('spinbutton', { name: 'Words per minute' }).focus();
	await page.keyboard.press('ArrowLeft');
	await expect(page.getByRole('slider', { name: 'Reading position' })).toHaveValue('15');
	await page.goto('/books/missing-book');
	await expect(page.getByRole('heading', { name: 'Book not found.' })).toBeVisible();
	await page.getByRole('link', { name: 'Back to library' }).click();
	await expect(page).toHaveURL('/');
});
