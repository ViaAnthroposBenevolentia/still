import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';

export const prerender = true;
export const load = () => redirect(307, resolve('/books'));
