<script lang="ts">
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import Upload from '~icons/lucide/upload';
	import X from '~icons/lucide/x';
	import { importBook, storageError } from '$lib/library';

	let { close }: { close: () => void } = $props();
	let title = $state('');
	let text = $state('');
	let error = $state('');
	let busy = $state(false);
	let filename = $state('');

	const upload = async (event: Event) => {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		error = '';
		busy = true;
		try {
			if (!/\.(?:txt|epub)$/iu.test(file.name)) throw new Error('Choose a .txt or .epub file.');
			const epub = /\.epub$/iu.test(file.name);
			const limit = epub ? 20 : 5;
			if (file.size > limit * 1024 * 1024)
				throw new Error(`Choose a ${epub ? 'book' : 'text'} smaller than ${limit} MB.`);
			const source = epub
				? (await import('$lib/epub')).readEpub(new Uint8Array(await file.arrayBuffer()))
				: { title: '', text: await file.text() };
			text = source.text;
			title ||=
				source.title.slice(0, 160) ||
				file.name
					.replace(/\.(?:txt|epub)$/iu, '')
					.replace(/[_-]/gu, ' ')
					.slice(0, 160);
			filename = file.name;
		} catch (cause) {
			error = storageError(cause);
		} finally {
			busy = false;
			input.value = '';
		}
	};

	const submit = async (event: SubmitEvent) => {
		event.preventDefault();
		busy = true;
		error = '';
		try {
			const book = await importBook(title, text);
			void navigator.storage?.persist?.().catch(() => false);
			await goto(resolve('/books/[slug]', { slug: book.slug }));
		} catch (cause) {
			error = storageError(cause);
		} finally {
			busy = false;
		}
	};
</script>

<form onsubmit={submit}>
	<div class="dialog-heading">
		<h2 id="import-title">A new read.</h2>
		<button type="button" class="btn btn-ghost btn-circle" aria-label="Close import" onclick={close}
			><X /></button
		>
	</div>
	<label class="upload-zone">
		<Upload aria-hidden="true" />
		<span>{filename || 'Choose a book file'}</span>
		<span class="subtle">.txt up to 5 MB · .epub up to 20 MB</span>
		<input
			type="file"
			accept=".txt,.epub,text/plain,application/epub+zip"
			aria-label="Upload book file"
			onchange={upload}
			disabled={busy}
		/>
	</label>
	<label class="field"
		><span>Title</span><input
			class="input"
			bind:value={title}
			disabled={busy}
			required
			maxlength="160"
			placeholder="Name your book"
		/></label
	>
	<label class="field"
		><span>Text</span><textarea
			class="textarea"
			bind:value={text}
			disabled={busy}
			required
			rows="7"
			placeholder="Or paste something worth reading…"></textarea></label
	>
	{#if error}<p class="error" role="alert">{error}</p>{/if}
	<button class="btn btn-primary import-submit" type="submit" disabled={busy}
		>{busy ? 'Adding…' : 'Add to library'}</button
	>
	<p class="storage-note">Saved in this browser. Your text stays on your device.</p>
</form>
