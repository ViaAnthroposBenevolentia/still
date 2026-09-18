import Dexie, { type EntityTable } from 'dexie';
import { slugify, tokenize } from './reading.ts';

export type Book = {
	id: string;
	slug: string;
	title: string;
	words: number;
	position: number;
	created: number;
	opened: number;
};
type Content = { id: string; text: string };
export type Preferences = { id: 'reader'; wpm: number; chunk: number };

const db = new Dexie('still-library') as Dexie & {
	books: EntityTable<Book, 'id'>;
	contents: EntityTable<Content, 'id'>;
	preferences: EntityTable<Preferences, 'id'>;
};
db.version(1).stores({ books: 'id, &slug, opened', contents: 'id', preferences: 'id' });

export const listBooks = (): Promise<Book[]> => db.books.orderBy('opened').reverse().toArray();

export const importBook = async (title: string, source: string): Promise<Book> => {
	const text = source.replace(/\r\n?/gu, '\n').trim();
	if (!title.trim()) throw new Error('Give your book a title.');
	if (title.trim().length > 160) throw new Error('Keep the title under 160 characters.');
	if (!text || !/[\p{L}\p{N}]/u.test(text)) throw new Error('Add some text to read.');
	if (new Blob([text]).size > 5 * 1024 * 1024) throw new Error('Choose a text smaller than 5 MB.');
	if (text.includes('\0')) throw new Error('This does not look like a plain-text file.');
	const base = slugify(title);
	return db.transaction('rw', db.books, db.contents, async () => {
		let slug = base;
		let suffix = 2;
		while (await db.books.where('slug').equals(slug).count()) slug = `${base}-${suffix++}`;
		const book: Book = {
			id: crypto.randomUUID(),
			slug,
			title: title.trim(),
			words: tokenize(text).length,
			position: 0,
			created: Date.now(),
			opened: Date.now(),
		};
		await db.books.add(book);
		await db.contents.add({ id: book.id, text });
		return book;
	});
};

export const openBook = async (slug: string): Promise<{ book: Book; text: string } | undefined> => {
	const book = await db.books.where('slug').equals(slug).first();
	if (!book) return undefined;
	const content = await db.contents.get(book.id);
	if (!content) throw new Error('The text for this book is missing. Import it again.');
	await db.books.update(book.id, { opened: Date.now() });
	return { book, text: content.text };
};

export const savePosition = async (id: string, position: number): Promise<void> => {
	const updated = await db.books.update(id, { position });
	if (!updated) throw new Error('This book was removed from your library.');
};

export const deleteBook = (id: string): Promise<void> =>
	db.transaction('rw', db.books, db.contents, async () => {
		await db.books.delete(id);
		await db.contents.delete(id);
	});

export const loadPreferences = async (): Promise<Preferences> =>
	(await db.preferences.get('reader')) ?? { id: 'reader', wpm: 350, chunk: 1 };

export const savePreferences = (wpm: number, chunk: number): Promise<string> =>
	db.preferences.put({ id: 'reader', wpm, chunk });

export const storageError = (error: unknown): string => {
	if (error instanceof Error && error.name === 'QuotaExceededError')
		return 'Your browser storage is full. Remove a book and try again.';
	return error instanceof Error
		? error.message
		: 'Browser storage is unavailable. Please try again.';
};
