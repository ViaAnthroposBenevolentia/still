export type Word = { text: string; paragraph: number; endsParagraph: boolean };
export type Frame = { text: string; count: number; before: string; pivot: string; after: string };

const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

export const tokenize = (text: string): Word[] =>
	text
		.trim()
		.split(/\n\s*\n/u)
		.flatMap((paragraph, index) => {
			const words = paragraph.trim().split(/\s+/u).filter(Boolean);
			return words.map((word, wordIndex) => ({
				text: word,
				paragraph: index,
				endsParagraph: wordIndex === words.length - 1,
			}));
		});

/** Keep a recognition letter fixed, including for words with leading punctuation. */
export const frameAt = (words: Word[], position: number, maxWords: number): Frame => {
	const parts: string[] = [];
	for (const word of words.slice(position, position + maxWords)) {
		if (parts.length && [...parts, word.text].join(' ').length > 22) break;
		parts.push(word.text);
		if (word.endsParagraph || /[.!?…][”’"')\]]*$/u.test(word.text)) break;
	}
	const text = parts.join(' ');
	const letters = Array.from(graphemes.segment(text), (segment) => segment.segment);
	const first = letters.findIndex((letter) => /[\p{L}\p{N}]/u.test(letter));
	const length = letters.filter((letter) => /[\p{L}\p{N}]/u.test(letter)).length;
	const offset = length <= 1 ? 0 : length <= 4 ? 1 : length <= 9 ? 2 : 3;
	const pivot = Math.min(Math.max(0, first) + offset, Math.max(0, letters.length - 1));
	return {
		text,
		count: parts.length,
		before: letters.slice(0, pivot).join(''),
		pivot: letters[pivot] ?? '',
		after: letters.slice(pivot + 1).join(''),
	};
};

/** WPM counts words, even when multiple words share a frame. Pauses are additive. */
export const dwellTime = (words: Word[], wpm: number, rampWords = 10): number => {
	let weight = words.length;
	for (const word of words) {
		if (word.text.length > 9) weight += Math.min(0.5, (word.text.length - 9) * 0.04);
		if (/\d/u.test(word.text)) weight += 0.2;
		if (/[.!?…][”’"')\]]*$/u.test(word.text)) weight += 0.65;
		else if (/[,;:—][”’"')\]]*$/u.test(word.text)) weight += 0.3;
		if (word.endsParagraph) weight += 0.5;
	}
	return (60_000 / wpm) * weight * (1 + Math.max(0, 10 - rampWords) * 0.06);
};

export const slugify = (title: string): string =>
	title
		.normalize('NFKD')
		.replace(/\p{M}/gu, '')
		.toLowerCase()
		.replace(/[^\p{L}\p{N}]+/gu, '-')
		.replace(/^-|-$/gu, '')
		.slice(0, 90)
		.replace(/-$/u, '') || 'untitled';

export const progress = (position: number, total: number): number =>
	total ? Math.min(100, Math.floor((position / total) * 100)) : 0;
