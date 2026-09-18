# Still

A local reading library with an RSVP reader that shows a few words at a time. Import a `.txt` file or paste text, then choose your reading speed. App stores your library in IndexedDB in your browser.

## Development

```sh
mise install
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm dev
```

Run `pnpm check` for formatting, linting, type checking, unused-code detection, timing tests, a production build, and browser tests. `pnpm fix` applies formatting and safe lint fixes. Install the pre-commit hook with `pnpm exec simple-git-hooks` after initializing Git.

## Reading

Space toggles playback. The left and right arrow keys move back or forward 15 words. The up and down arrow keys adjust speed by 25 words per minute. Focused controls keep their native keyboard behavior.

Pause to see the current paragraph, then select a word to resume from there. Open text view to scroll through the full document.

Each frame shows up to your selected word count, with a 22-character limit unless a single word is longer. Frames end at sentence and paragraph boundaries. The reader gives extra time to punctuation, numbers, long words, and the first ten words after you start playback. Your chosen speed is the base pace, so the remaining time is an estimate.

## Hosting

Connect the repository through a Render Blueprint. `render.yaml` configures a static site with the `/books/*` fallback for local book URLs. The build writes the site to `build/`. Hosting needs no database, secrets, or application server.

## Limits and storage

- Import UTF-8 plain text files up to 5 MB. Still does not yet support PDF, EPUB, link imports, accounts, sync, or extensions.
- Your library stays in the browser profile and origin where you imported it. Clearing site data deletes it. Keep your original files because there is no backup or export yet.
- Still requests persistent browser storage after import, but the browser may decline. Keep the app on the same domain to retain access to your library.
- Loading the app requires a network connection because there is no service worker.
- Playback pauses when you hide the tab or navigate away. It never starts automatically. Still saves your progress after each frame.
- Still helps you pace your reading. Higher speeds do not guarantee better comprehension.

## Tooling decisions

The project uses TypeScript 6 because the current `svelte-check` peer range does not support TypeScript 7. Oxfmt formats all files with its built-in Svelte support enabled. Oxlint checks JavaScript and TypeScript with type-aware rules. ESLint runs only the Svelte plugin's component checks. The Knip exception covers dynamically loaded icon data.

Dependencies use exact versions, and install scripts are disabled. The platform binaries work without those scripts. CI runs the required checks. The optional pre-commit hook checks only staged-file formatting. There is no required commit-message format or scheduled dependency automation.
