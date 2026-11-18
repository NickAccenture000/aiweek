# Publishing

Reference status: manually maintained  
Tile contract checked: 2026-10-13  
Applicable skill version: 0.6.x  
Canonical sources: api/src/upload.rs, api/src/pages/upload_routes.rs, api/src/pages/publish_routes.rs, api/src/declaration/mod.rs, api/src/hosting/view.rs, api/src/hosting/public.rs, api/src/edit/mod.rs, web/src/PublishWizard.svelte, web/src/manage/PublishStateCard.svelte

## Prepare the bundle

Publish one HTML file or a ZIP static bundle. A ZIP may contain index.html at its root or inside exactly one enclosing top-level directory. Preserve the build output beneath that entry point.

Limits: 100 MiB upload, 5,000 ZIP entries, 100 MiB decompressed content, and safe relative paths. Uploads flow through Tile, not browser-direct S3.

ZIP entry names must use forward slashes (`assets/app.js`). Windows PowerShell 5.1's `Compress-Archive` writes backslashes, which do not unpack as folders, so do not use it. A command that zips a build folder's contents the same way on macOS, Linux, and Windows is `python3 -c "import shutil; shutil.make_archive('dist', 'zip', 'dist')"` (`py` instead of `python3` on Windows); on macOS and Linux, `cd dist && zip -r ../dist.zip .` also works. Name files in the bundle with the case the HTML uses: Windows and macOS file systems ignore case, but the hosted tile does not.

Use relative URLs (./…) for your own bundled assets, including paths assembled in JavaScript; resolve CSS and nested-document paths relative to their containing file. Keep the platform SDK URL /vendor/tile.js and documented vendor-library URLs root-absolute.

Publishing injects a base URL and rewrites supported static HTML/CSS references, including root-absolute assets, to the tile's own prefix (`/view/<slug>/…` or `/public/<slug>/…`). Keep `/vendor/tile.js` pointing to the platform SDK rather than a tile-local asset. Documented vendor-library references under `/apps/pages/` are also left alone. It cannot rewrite JavaScript strings such as fetch('/api/data'); change those to relative URLs or use the matching Tile SDK capability.

## Addresses

Tiles live at `https://tile.accenture.com/view/<slug>/` (private) or `https://tile.accenture.com/public/<slug>/` (public). Take the address from the `url` field that create, list, and detail return; never compose it from the slug and tier. The address is fixed at creation and a republish never moves it.

## Tile limit

A person owns at most 100 live tiles by default; expired tiles and tiles where they are only a co-admin do not count. Creating a tile past the limit, or renewing an expired one, answers 409 `{"error", "limit", "count"}`. Tell the user to delete a tile, let one expire, or raise a tile-limit request (see [Requests](requests.md)); do not retry.

## Publish state

Whether a tile's URL serves is a separate flag, `published`, shown in list and detail. An unpublished tile answers a bare 404 to every caller, admins included: its index.html, every svc route, and the public gate. It never answers 410. Admins can still open it in Tile's editor.

- A person's create (with the data declaration) starts the tile published, and a person's finalize keeps `published` as it was.
- A token's finalize (PAT or account token) sets `published` to false before replacing content, so a token publish is always upload, finalize, then `POST …/pages/<slug>/publish`. Finalize alone leaves the URL offline; the response says `"published": false`.
- `POST …/pages/<slug>/publish` answers `{ "published": true }`, also when it already was. It is 409 on an expired tile ("renew the tile first").
- `POST …/pages/<slug>/unpublish` answers `{ "published": false }`. Any tile admin may call it; PATs have no unpublish route.
- A Gallery listing only shows published tiles (see [Gallery](gallery.md)).

Use the plane of the credential: `/mapi/v1/pages/<slug>/…` for a PAT, `/mapi/u/pages/<slug>/…` for an account token (see [Automation](automation.md)). Do not publish a tile the user has not asked to put online.

## Data declaration

Every upload and every publish of undeclared content is covered by a data declaration: the content is covered by a CDP plan and contains no personal data.

- A token declared once at mint. Requests made with a token must not send a `declaration` field; doing so is 400.
- A person's create and finalize must send `"declaration": { "cdp": true, "no_pii": true, "statement_version": "<current>" }`; a missing or false field is 400 "confirm the data declaration", an old version is 400 "reload Tile to see the current data declaration". A person's publish of undeclared content without one is 409 `{ "needs_declaration": true }`.
- Tiles last uploaded before the declaration existed are unpublished and undeclared until someone re-uploads or publishes them.

Never tick the declaration for the user. If content may hold personal data or lacks a CDP plan, stop and ask.

## Publish and republish

Upload stages raw bytes and returns `{ upload_id }`. Finalize validates and transforms them before touching live content. A rejected bundle leaves the current tile and its publish state unchanged; its staged upload is discarded, so upload again after fixing it.

Finalize answers `{ warnings, published }`. A non-empty `warnings` list still means the content was replaced; check `published` to know whether the URL serves it. Read the warnings: they name rewritten root-absolute references, leftover `<!-- PAGES NOTE n: … -->` comments or note instructions from an edit-mode hand-off, and an embedded edit panel that viewers would see. Remove leftover notes and panels from the source rather than shipping them. A 409 means another publish, edit save, or deletion holds the tile, or Tile is busy publishing other tiles; retry shortly.

A successful republish is edit-in-place:

- same slug and URL;
- same immutable private/public tier;
- no version history;
- expiry unchanged;
- whole old content tree removed before the new files are written, including edits saved in Tile's editor since the last upload.

Clean replacement means no old asset survives, at the cost of a brief possible 404 window while the files are replaced. If someone saved edits in Tile's editor, get them from the editor's Download or a hand-off first (see [Edit mode](editing.md)).

## What Tile serves

Served HTML is not byte-identical to the upload: Tile adds the base URL, rewritten references, and an instance marker in the root index.html head (used by analytics). Do not diff served bytes against the upload or strip these additions. Content is served no-cache, so a republish shows on the next load.

## Security

Hosted JavaScript is same-origin and unsandboxed. Apply the [foundation authoring safety rules](foundations.md#authoring-safety) before upload. Do not add sandbox or CSP isolation as a local patch; it breaks the hosted asset/session model.

Finalize scans the bundle; inspect its scan findings as well as warnings. A successful scan is not a security guarantee. Keep third-party scripts, fonts, styles, and images in the bundle instead of loading them from remote sites, while retaining documented Tile SDK/vendor paths. These are authoring safeguards, not a claim that every external asset or unsafe pattern is automatically blocked. For token publishing, management-API calls and secret files can cause a 422 refusal; other scan findings need not block replacement (see [Automation](automation.md)).

## Verification

- Entry index is valid and archive paths are safe.
- Built output stays within upload and expansion limits.
- Static assets and nested HTML files load from the hosted URL.
- Own asset URLs are relative; runtime root-absolute requests have been redesigned.
- Scan findings were reviewed and the foundation authoring safety rules are satisfied.
- Finalize warnings were read; no PAGES NOTE comments or embedded edit panel remain.
- A token publish called `publish` after finalize, and `publish` answered `{ published: true }`.
- Edits saved in Tile's editor since the last upload are in the source before republish.
- An asset removed from the new build no longer exists after republish.
- URL, tier, ACL, and expiry remain unchanged unless separately requested.
