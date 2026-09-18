<script lang="ts">
	import type { Snippet } from 'svelte';
	let {
		open,
		labelledby,
		close,
		children,
	}: { open: boolean; labelledby: string; close: () => void; children: Snippet } = $props();

	let dialog: HTMLDialogElement;

	$effect(() => {
		if (open) dialog.showModal();
		else dialog.close();
	});
</script>

<dialog
	class="modal"
	bind:this={dialog}
	aria-labelledby={labelledby}
	oncancel={(event) => {
		event.preventDefault();
		close();
	}}
>
	<div class="modal-box">{@render children()}</div>
	<form
		method="dialog"
		class="modal-backdrop"
		onsubmit={(event) => {
			event.preventDefault();
			close();
		}}
	>
		<button aria-label="Close dialog">close</button>
	</form>
</dialog>
