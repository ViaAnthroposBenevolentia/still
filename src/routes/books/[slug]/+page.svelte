<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { openBook, storageError } from '$lib/library';
	import Reader from '$lib/components/Reader.svelte';

	const slug = $derived(page.params.slug ?? '');
	const loaded = $derived(openBook(slug));
</script>

{#await loaded}
	<main id="main" class="route-message"><p role="status">Opening your book…</p></main>
{:then result}
	{#if result}
		{#key result.book.id}<Reader book={result.book} text={result.text} />{/key}
	{:else}
		<main id="main" class="route-message">
			<h1>Book not found.</h1>
			<p>This book isn’t saved in this browser.</p>
			<a class="btn btn-primary" href={resolve('/books')}>Back to library</a>
		</main>
	{/if}
{:catch error}
	<main id="main" class="route-message">
		<h1>Couldn’t open this book.</h1>
		<p role="alert">{storageError(error)}</p>
		<a class="btn btn-primary" href={resolve('/books')}>Back to library</a>
	</main>
{/await}
