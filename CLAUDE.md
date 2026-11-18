# CLAUDE.md

SkyNet stakeholder message generator: a single-page app that builds incident messages for ATCO supervisors, engineering and management in EN/DE/FR from an incident record, and proves with real checks that no message contradicts the record. Product intent is in `PRODUCT.md`, visual rules in `DESIGN.md`, and the full original brief (demo script, check rules, required tests) in `SPEC.md`.

## Stack

Plain HTML, CSS and browser JavaScript. **No Node, npm, bundler, framework or ES modules**, so the app opens straight from `file://`. Do not introduce a build step or `import`/`export`.

- Every file attaches to the global `window.SkyNet` (`data`, `lib`, `ui`) inside an IIFE.
- Scripts load in a fixed order: `data` → `lib` (recipients, label, render, diff, checks) → `ui/views.js` → `ui/app.js`. The list appears in **both** `index.html` and `tests.html`; when adding a file, update both.
- `src/lib/` is pure logic (no DOM). `src/ui/views.js` holds pure `state → HTML string` functions. `src/ui/app.js` holds state, actions and event delegation (`data-action` attributes). Every action re-renders via `innerHTML` and focus is restored afterwards.
- Escape every user- or data-derived string in views with `esc()` / `attr()`.

## Run and test

- App: open `index.html`, or `powershell -ExecutionPolicy Bypass -File serve.ps1 [-Port 5173]` (preview config: `.claude/launch.json`).
- Tests: open `tests.html` (or `/tests.html` on the server). The tab title shows `PASS n/n`; `window.__testResult` holds `{pass, fail}`. All tests must pass before committing.
- Tests use a tiny `describe`/`it`/`expect` runner (`tests/runner.js`). App tests mount with a fake clock (`opts.clock`, `opts.now`) and call `flush()`.

## Rules that must stay true

- Facts enter messages **only** as `{{type:key}}` tokens rendered from the record; checks in `src/lib/checks.js` are real code.
- The planted error in `drafts.js` (v2 × ENGINEERING × FR) is intentional. It must stay the **only** failing draft.
- Nothing is sent without per-role approval; an approval covers only the languages present when it was given.
