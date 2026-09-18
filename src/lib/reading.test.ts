import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dwellTime, frameAt, slugify, tokenize } from './reading.ts';

await test('paragraphs survive tokenization and chunks never cross their boundaries', () => {
	const words = tokenize('The cat sat.\n\nA new paragraph.');
	assert.equal(words.length, 6);
	assert.equal(words[3]?.paragraph, 1);
	assert.equal(frameAt(words, 1, 3).text, 'cat sat.');
	assert.equal(frameAt(words, 2, 3).count, 1);
});

await test('chunks keep short words together and leave a long word intact', () => {
	const words = tokenize('the cat sat extraordinarily quietly');
	assert.equal(frameAt(words, 0, 3).text, 'the cat sat');
	assert.equal(frameAt(words, 3, 3).text, 'extraordinarily');
	assert.equal(frameAt(words, 4, 3).text, 'quietly');
});

await test('recognition anchors account for punctuation and preserve graphemes', () => {
	assert.equal(frameAt(tokenize('“hello”'), 0, 1).pivot, 'l');
	assert.equal(frameAt(tokenize('I'), 0, 1).pivot, 'I');
	const frame = frameAt(tokenize('e\u0301lan'), 0, 1);
	assert.equal(frame.before + frame.pivot + frame.after, 'e\u0301lan');
	assert.equal(frame.pivot, 'l');
});

await test('WPM accounts for every word in a chunk, with time to process pauses', () => {
	const plain = tokenize('one two three four');
	assert.equal(dwellTime(plain.slice(0, 1), 300), 200);
	assert.equal(dwellTime(plain.slice(0, 3), 300), 600);
	assert.equal(dwellTime(plain.slice(0, 1), 600), 100);
	assert.ok(dwellTime(tokenize('wait, next').slice(0, 1), 300) > 200);
	assert.ok(
		dwellTime(tokenize('stop. next').slice(0, 1), 300) >
			dwellTime(tokenize('wait, next').slice(0, 1), 300),
	);
	assert.ok(dwellTime(tokenize('42 next').slice(0, 1), 300) > 200);
	assert.ok(dwellTime(tokenize('extraordinarily next').slice(0, 1), 300) > 200);
	assert.ok(dwellTime(plain.slice(0, 1), 300, 0) > dwellTime(plain.slice(0, 1), 300, 10));
});

await test('slugs support accented and non-Latin titles and empty punctuation', () => {
	assert.equal(slugify('  A Room of One’s Own  '), 'a-room-of-one-s-own');
	assert.equal(slugify('Café'), 'cafe');
	assert.equal(slugify('Привет мир'), 'привет-мир');
	assert.equal(slugify('!!!'), 'untitled');
});
