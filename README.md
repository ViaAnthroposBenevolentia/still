# Still

A local reading library with a focused RSVP reader. Import a `.txt` file or paste text, then read at your own pace. Everything stays in IndexedDB in your browser.

## Development

```sh
mise install
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm dev
```

Run `pnpm check` for formatting, linting, type checking, unused-code detection, timing tests, a production build, and browser tests. `pnpm fix` applies formatting and safe lint fixes. Install the pre-commit hook with `pnpm exec simple-git-hooks` after initializing Git.

## Reading

Space toggles playback. Left/right move 15 words; up/down adjust speed by 25 WPM. Controls keep their native keyboard behavior when focused. Pausing reveals the current paragraph; select a word to resume from there. Text view provides the complete scrollable document.

Frames contain up to the selected word count, constrained to 22 characters unless a single word is longer. Sentence and paragraph boundaries end a frame. Punctuation, numbers, long words, and the first ten words after play receive extra time, so WPM is a base pace and remaining time is an estimate.

## Hosting

`render.yaml` configures a Render static site, including the `/books/*` fallback needed for local book URLs. Connect the repository through a Render Blueprint. No database, secrets, or server service is needed. The generated site is in `build/`.

## MVP boundaries

- UTF-8 plain text only, up to 5 MB. PDF, EPUB, link imports, accounts, sync, and extensions are deferred.
- Data belongs to this browser profile and origin. Clearing site data deletes the library. Keep original files: there is no backup/export feature yet.
- The app requests persistent browser storage after import, but the browser may decline. A stable domain matters.
- There is no service worker, so loading the application requires a network connection.
- Playback pauses on tab hiding and navigation, and never autoplays. Reading progress is saved after each frame.
- The app is a pacing tool; it makes no promise of improved comprehension at higher speeds.

## Tooling decisions

TypeScript 6 is retained because the current `svelte-check` peer range does not support TypeScript 7. Oxfmt handles all formatting with its built-in Svelte support enabled. Oxlint covers JS/TS with type-aware rules; ESLint is scoped to the Svelte plugin's component checks. The Knip exception covers dynamically loaded icon data.

Dependency install scripts are denied; the platform binaries used here work without them. Dependencies use exact pins. CI is the authoritative gate; the optional hook only checks formatting of staged files. No commit-message convention or scheduled dependency automation is imposed.
