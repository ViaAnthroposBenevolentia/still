<script lang="ts">
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { liveQuery } from 'dexie';
	import Plus from '~icons/lucide/plus';
	import ArrowUpRight from '~icons/lucide/arrow-up-right';
	import BookOpen from '~icons/lucide/book-open';
	import Search from '~icons/lucide/search';
	import Trash from '~icons/lucide/trash-2';
	import X from '~icons/lucide/x';
	import Brand from '$lib/components/Brand.svelte';
	import Import from '$lib/components/Import.svelte';
	import { deleteBook, listBooks, storageError, type Book } from '$lib/library';
	import { progress } from '$lib/reading';

	let books = $state<Book[]>([]);
	let loading = $state(true);
	let error = $state('');
	let query = $state('');
	let filter = $state('all');
	let importDialog = $state<HTMLDialogElement>();
	let deleteDialog = $state<HTMLDialogElement>();
	let removing = $state<Book>();
	let deleting = $state(false);
	const filtered = $derived(
		books.filter(
			(book) =>
				book.title.toLocaleLowerCase().includes(query.toLocaleLowerCase()) &&
				(filter === 'all' ||
					(filter === 'reading'
						? book.position > 0 && book.position < book.words
						: book.position === book.words)),
		),
	);
	const current = $derived(books.find((book) => book.position > 0 && book.position < book.words));
	const palette = (book: Book) =>
		[...book.title].reduce((sum, letter) => sum + (letter.codePointAt(0) ?? 0), 0) % 5;

	onMount(() => {
		const subscription = liveQuery(listBooks).subscribe({
			next: (result) => {
				books = result;
				loading = false;
			},
			error: (cause: unknown) => {
				error = storageError(cause);
				loading = false;
			},
		});
		return () => subscription.unsubscribe();
	});

	const remove = async () => {
		if (!removing) return;
		deleting = true;
		try {
			await deleteBook(removing.id);
			deleteDialog?.close();
			removing = undefined;
		} catch (cause) {
			error = storageError(cause);
		} finally {
			deleting = false;
		}
	};
</script>

<svelte:head
	><title>Library · Still</title><meta
		name="description"
		content="A quiet place for your books. A focused way to read."
	/></svelte:head
>

<div class="catalog-shell">
	<header class="site-header">
		<Brand /><button
			class="btn btn-primary"
			disabled={loading}
			onclick={() => importDialog?.showModal()}><Plus aria-hidden="true" /> Add a book</button
		>
	</header>
	<main id="main" class="catalog">
		<div class="catalog-heading">
			<h1>Your library<span>.</span></h1>
			<span class="book-count">{books.length} {books.length === 1 ? 'book' : 'books'}</span>
		</div>
		{#if error}<p class="error" role="alert">{error}</p>{/if}
		{#if current && !query && filter === 'all'}
			<a class="continue-card" href={resolve('/books/[slug]', { slug: current.slug })}>
				<div class="continue-art cover-{palette(current)}" aria-hidden="true">
					<div class="cover-orbit"></div>
				</div>
				<div class="continue-copy">
					<span class="eyebrow">PICK UP WHERE YOU LEFT OFF</span>
					<h2>{current.title}</h2>
					<div class="continue-progress">
						<progress
							class="progress"
							value={current.position}
							max={current.words}
							aria-label="Reading progress"
						></progress><span>{progress(current.position, current.words)}%</span>
					</div>
				</div>
				<span class="continue-action">Continue reading <ArrowUpRight aria-hidden="true" /></span>
			</a>
		{/if}
		<div class="library-toolbar">
			<div class="library-filters" aria-label="Filter library">
				{#each [{ id: 'all', label: 'All books' }, { id: 'reading', label: 'In progress' }, { id: 'finished', label: 'Finished' }] as item (item.id)}
					<button
						class:active={filter === item.id}
						aria-pressed={filter === item.id}
						disabled={loading}
						onclick={() => (filter = item.id)}>{item.label}</button
					>
				{/each}
			</div>
			<label class="search-box"
				><Search aria-hidden="true" /><input
					type="search"
					disabled={loading}
					aria-label="Search library"
					placeholder="Find a book"
					bind:value={query}
				/></label
			>
		</div>
		{#if loading}<p class="empty-message" role="status">Opening your library…</p>
		{:else if books.length === 0 && !error}
			<section class="empty-library">
				<div class="empty-art" aria-hidden="true"><span></span><span></span><span></span></div>
				<h2>Make room for a good read.</h2>
				<button class="btn btn-primary" onclick={() => importDialog?.showModal()}
					><Plus aria-hidden="true" /> Add your first book</button
				>
			</section>
		{:else if filtered.length === 0}<p class="empty-message">No books here yet.</p>
		{:else}
			<div class="book-grid">
				{#each filtered as book (book.id)}
					<article class="book-card">
						<a
							href={resolve('/books/[slug]', { slug: book.slug })}
							aria-label={`Read ${book.title}`}
							class="book-link"
						>
							<div class="book-cover cover-{palette(book)}">
								<div class="cover-orbit" aria-hidden="true"></div>
								<span class="cover-title">{book.title}</span><span class="cover-bottom"
									><BookOpen aria-hidden="true" /><span>{book.words.toLocaleString()} WORDS</span
									></span
								>
							</div>
							<h2>{book.title}</h2>
							<div class="book-meta">
								<span
									>{book.position === book.words
										? 'Finished'
										: book.position > 0
											? `${progress(book.position, book.words)}% read`
											: 'Unread'}</span
								><span>{Math.max(1, Math.ceil(book.words / 350))} min</span>
							</div>
							<progress
								class="progress"
								value={book.position}
								max={book.words}
								aria-label={`${book.title} reading progress`}
							></progress>
						</a>
						<button
							class="btn btn-ghost btn-circle delete-book"
							aria-label={`Delete ${book.title}`}
							onclick={() => {
								removing = book;
								deleteDialog?.showModal();
							}}><Trash /></button
						>
					</article>
				{/each}
			</div>
		{/if}
	</main>
</div>
<dialog class="modal" bind:this={importDialog} aria-labelledby="import-title">
	<div class="modal-box"><Import dialog={importDialog} /></div>
	<form method="dialog" class="modal-backdrop">
		<button aria-label="Close import">close</button>
	</form>
</dialog>
<dialog class="modal" bind:this={deleteDialog} aria-labelledby="delete-title">
	<div class="modal-box delete-dialog">
		<div class="dialog-heading">
			<h2 id="delete-title">Remove this book?</h2>
			<button
				class="btn btn-ghost btn-circle"
				aria-label="Cancel deletion"
				onclick={() => deleteDialog?.close()}><X /></button
			>
		</div>
		<p>“{removing?.title}” and its reading progress will be removed from this browser.</p>
		<div class="dialog-actions">
			<button class="btn btn-ghost" onclick={() => deleteDialog?.close()}>Keep book</button><button
				class="btn btn-error"
				disabled={deleting}
				onclick={remove}>Remove book</button
			>
		</div>
	</div>
</dialog>
