<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve -- Query URLs preserve page.url.pathname, which already includes the deployment base. */
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { integerParam, queryUrl } from '$lib/url';
	import { beforeNavigate, goto } from '$app/navigation';
	import ArrowLeft from '~icons/lucide/arrow-left';
	import Play from '~icons/lucide/play';
	import Pause from '~icons/lucide/pause';
	import RotateCcw from '~icons/lucide/rotate-ccw';
	import RotateCw from '~icons/lucide/rotate-cw';
	import Minus from '~icons/lucide/minus';
	import Plus from '~icons/lucide/plus';
	import AlignLeft from '~icons/lucide/align-left';
	import Focus from '~icons/lucide/focus';
	import Brand from './Brand.svelte';
	import {
		loadPreferences,
		savePosition,
		savePreferences,
		storageError,
		type Book,
	} from '$lib/library';
	import { tokenize, frameAt, dwellTime, progress } from '$lib/reading';

	let { book, text }: { book: Book; text: string } = $props();
	const words = $derived(tokenize(text));
	const paragraphs = $derived(text.split(/\n\s*\n/u));
	let settings = $state({ wpm: 350, chunk: 1 });
	const position = $derived(integerParam(page.url, 'position', book.position, 0, words.length));
	const wpm = $derived(integerParam(page.url, 'wpm', settings.wpm, 100, 900));
	const chunk = $derived(integerParam(page.url, 'chunk', settings.chunk, 1, 3));
	let playing = $state(false);
	const mode = $derived(page.url.searchParams.get('view') === 'text' ? 'text' : 'focus');
	let error = $state('');
	let ready = $state(false);
	let ramp = $state(0);
	let contextElement = $state<HTMLParagraphElement>();
	const finished = $derived(position >= words.length);
	const frame = $derived(frameAt(words, Math.min(position, words.length - 1), chunk));
	const paragraphIndex = $derived(words[Math.min(position, words.length - 1)]?.paragraph ?? 0);
	const indexedParagraphs = $derived.by(() => {
		const grouped: { text: string; index: number }[][] = [];
		words.forEach((word, index) => {
			(grouped[word.paragraph] ??= []).push({ text: word.text, index });
		});
		return grouped;
	});
	const context = $derived(indexedParagraphs[paragraphIndex] ?? []);
	const remainingWeight = $derived(
		words.reduce((total, word, index) => {
			total.push((total[index - 1] ?? 0) + dwellTime([word], 60_000));
			return total;
		}, [] as number[]),
	);
	const remainingMinutes = $derived(
		Math.max(
			0,
			Math.ceil(((remainingWeight.at(-1) ?? 0) - (remainingWeight[position - 1] ?? 0)) / wpm),
		),
	);

	const fail = (cause: unknown) => {
		playing = false;
		error = storageError(cause);
	};
	const persist = () => {
		void savePosition(book.id, position).catch(fail);
	};
	const pause = () => {
		playing = false;
		persist();
	};
	const seek = (next: number) => {
		const value = Math.max(0, Math.min(words.length, next));
		void goto(queryUrl(page.url, { position: String(value) }), {
			replaceState: true,
			noScroll: true,
			keepFocus: true,
		});
		void savePosition(book.id, value).catch(fail);
	};
	const move = (next: number) => {
		playing = false;
		seek(next);
	};
	const toggle = () => {
		if (!ready || mode === 'text' || error) return;
		if (playing) pause();
		else {
			if (finished) seek(0);
			ramp = 0;
			playing = true;
		}
	};
	const preferences = (nextWpm: number, nextChunk: number) => {
		void goto(queryUrl(page.url, { wpm: String(nextWpm), chunk: String(nextChunk) }), {
			replaceState: true,
			noScroll: true,
			keepFocus: true,
		});
		void savePreferences(nextWpm, nextChunk).catch(fail);
	};
	const speed = (next: number) => {
		preferences(Math.min(900, Math.max(100, Math.round(next))), chunk);
	};
	const keyboard = (event: KeyboardEvent) => {
		if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)
			return;
		if (
			event.target instanceof Element &&
			event.target.closest('input, textarea, select, [contenteditable="true"]')
		)
			return;
		if (mode === 'text') return;
		if (event.code === 'Space') {
			if (event.target instanceof Element && event.target.closest('button, a')) return;
			event.preventDefault();
			toggle();
		} else if (event.key === 'ArrowLeft') {
			event.preventDefault();
			move(position - 15);
		} else if (event.key === 'ArrowRight') {
			event.preventDefault();
			move(position + 15);
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			speed(wpm + 25);
		} else if (event.key === 'ArrowDown') {
			event.preventDefault();
			speed(wpm - 25);
		}
	};

	onMount(() => {
		let mounted = true;
		void loadPreferences()
			.then((saved) => {
				if (!mounted) return;
				settings = saved;
				ready = true;
			})
			.catch(fail);
		return () => {
			mounted = false;
		};
	});
	beforeNavigate(({ to, type }) => {
		if (
			type === 'popstate' ||
			to?.url.pathname !== page.url.pathname ||
			to.url.searchParams.get('view') !== page.url.searchParams.get('view')
		)
			pause();
	});

	$effect(() => {
		if (playing || mode !== 'focus') return;
		const selected = contextElement?.querySelector<HTMLElement>(`[data-word="${position}"]`);
		if (!selected || !contextElement) return;
		const wordBounds = selected.getBoundingClientRect();
		const paragraphBounds = contextElement.getBoundingClientRect();
		if (wordBounds.top < paragraphBounds.top || wordBounds.bottom > paragraphBounds.bottom) {
			contextElement.scrollTop +=
				wordBounds.top - paragraphBounds.top - contextElement.clientHeight / 2;
		}
	});

	// Each displayed frame gets its full dwell; a busy main thread never skips words to catch up.
	$effect(() => {
		if (!playing) return;
		const count = frame.count;
		const timer = setTimeout(
			() => {
				const next = position + count;
				seek(next);
				ramp += count;
				if (next >= words.length) playing = false;
			},
			dwellTime(words.slice(position, position + count), wpm, ramp),
		);
		return () => clearTimeout(timer);
	});
</script>

<svelte:window onkeydown={keyboard} onpagehide={pause} />
<svelte:document
	onvisibilitychange={() => {
		if (document.hidden) pause();
	}}
/>
<svelte:head><title>{book.title} · Still</title></svelte:head>

<div class="reader-shell">
	<header class="reader-header">
		<a class="btn btn-ghost back-link" href={resolve('/books')}
			><ArrowLeft aria-hidden="true" /> Library</a
		><Brand /><a
			class="btn btn-ghost view-toggle"
			href={queryUrl(page.url, { view: mode === 'focus' ? 'text' : null })}
			data-sveltekit-noscroll
			data-sveltekit-keepfocus
			>{#if mode === 'focus'}<AlignLeft aria-hidden="true" /> Text view{:else}<Focus
					aria-hidden="true"
				/> Focus view{/if}</a
		>
	</header>
	<main id="main" class="reader-main">
		<div class="reader-title">
			<h1>{book.title}</h1>
			<span
				>{finished ? 'Finished' : `${progress(position, words.length)}% read`}<span class="meta-dot"
					>·</span
				>~{remainingMinutes} min left</span
			>
		</div>
		{#if error}<p class="error" role="alert">{error}</p>{/if}
		{#if mode === 'focus'}
			<div class="focus-stage" class:playing aria-hidden="true">
				<div class="focus-rule"></div>
				<div
					class="word-frame"
					style:font-size={`min(4.5rem, ${Math.min(12, 72 / Math.max(1, Array.from(frame.before).length, Array.from(frame.after).length))}cqw)`}
				>
					<span class="word-before">{frame.before}</span><span class="word-pivot"
						>{frame.pivot}</span
					><span class="word-after">{frame.after}</span>
				</div>
				<div class="focus-rule bottom"></div>
			</div>
			<div class="reader-controls">
				<div class="playback-controls">
					<button
						class="btn btn-ghost skip-button"
						aria-label="Back 15 words"
						aria-keyshortcuts="ArrowLeft"
						disabled={position === 0}
						onclick={() => move(position - 15)}
						><RotateCcw aria-hidden="true" /><span>15</span></button
					>
					<button
						class="btn btn-primary btn-circle play-button"
						aria-label={playing ? 'Pause' : finished ? 'Read again' : 'Play'}
						aria-keyshortcuts="Space"
						disabled={!ready || !!error}
						onclick={toggle}
						>{#if playing}<Pause />{:else if finished}<RotateCcw />{:else}<Play />{/if}</button
					>
					<button
						class="btn btn-ghost skip-button"
						aria-label="Forward 15 words"
						aria-keyshortcuts="ArrowRight"
						disabled={finished}
						onclick={() => move(position + 15)}
						><RotateCw aria-hidden="true" /><span>15</span></button
					>
				</div>
				<div class="reader-settings">
					<div class="speed-control">
						<button
							class="btn btn-ghost btn-circle"
							aria-label="Decrease speed"
							disabled={!ready || wpm <= 100}
							onclick={() => speed(wpm - 25)}><Minus /></button
						><label
							><input
								type="number"
								aria-label="Words per minute"
								min="100"
								max="900"
								step="25"
								value={wpm}
								disabled={!ready}
								onchange={(event) => {
									const next = event.currentTarget.valueAsNumber;
									if (Number.isFinite(next)) speed(next);
									else event.currentTarget.value = String(wpm);
								}}
							/><span>WPM</span></label
						><button
							class="btn btn-ghost btn-circle"
							aria-label="Increase speed"
							disabled={!ready || wpm >= 900}
							onclick={() => speed(wpm + 25)}><Plus /></button
						>
					</div>
					<span class="settings-divider"></span><label class="chunk-control"
						><span>Words</span><select
							class="select select-ghost"
							aria-label="Words per frame"
							value={chunk}
							disabled={!ready}
							onchange={(event) => preferences(wpm, Number(event.currentTarget.value))}
							><option value={1}>1</option><option value={2}>2</option><option value={3}>3</option
							></select
						></label
					>
				</div>
			</div>
			<section
				class="context-panel"
				aria-label="Reading context"
				class:context-hidden={playing}
				inert={playing}
			>
				<div class="context-heading">
					<span>{finished ? 'FINISHED' : 'IN CONTEXT'}</span><span
						>{paragraphIndex + 1} / {paragraphs.length}</span
					>
				</div>
				<p class="context-text" bind:this={contextElement}>
					{#each context as word (word.index)}<button
							data-word={word.index}
							class:current-word={word.index >= position && word.index < position + frame.count}
							aria-label={`Read from ${word.text}, word ${word.index + 1}`}
							onclick={() => move(word.index)}>{word.text}</button
						><!-- eslint-disable-next-line svelte/no-useless-mustaches -- Preserve spaces between each-block iterations. -->
						{' '}
					{/each}
				</p>
			</section>
		{:else}
			<article class="document-view" aria-label="Book text">
				{#each paragraphs as paragraph, index (index)}<p
						class:active-paragraph={index === paragraphIndex}
					>
						{paragraph}
					</p>{/each}
			</article>
		{/if}
	</main>
	<footer class="reader-footer">
		<label class="sr-only" for="position">Reading position</label><input
			id="position"
			class="range range-xs"
			type="range"
			min="0"
			max={words.length}
			step="1"
			value={position}
			aria-valuetext={`Word ${position} of ${words.length}`}
			oninput={(event) => move(event.currentTarget.valueAsNumber)}
		/>
		<div class="progress-labels">
			<span
				>{position.toLocaleString()}
				<span class="subtle">/ {words.length.toLocaleString()} words</span></span
			><span>{progress(position, words.length)}%</span>
		</div>
	</footer>
</div>
