import svelte from 'eslint-plugin-svelte';
import ts from 'typescript-eslint';

export default [
	{ ignores: ['.svelte-kit/**', 'build/**', 'playwright-report/**', 'test-results/**'] },
	...svelte.configs['flat/recommended'],
	{
		files: ['**/*.svelte'],
		languageOptions: { parserOptions: { parser: ts.parser } },
	},
];
