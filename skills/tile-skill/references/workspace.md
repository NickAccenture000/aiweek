# Personal workspace

Reference status: manually maintained  
Tile contract checked: 2026-10-13  
Applicable skill version: 0.6.x  
Canonical sources: api/src/workspace/, api/src/hosting/draft.rs, api/src/edit/target.rs, api/src/edit/stored.rs, api/src/pages/upload_routes.rs, api/src/pages/publish_routes.rs, web/src/lib/workspaceDocs.ts

## What it is

Every signed-in colleague has a private workspace (the Workspace tab) for HTML files and bundles before they become tiles. An artifact holds numbered versions; Tile serves a version only to its owner, behind SSO, at `https://tile.accenture.com/apps/pages/draft/<id>/<n>/`. Drafts are static: no `svc/*`, no analytics, and no sharing, so try HTML that uses services on a real private tile instead. App admins can size and delete artifacts but cannot open them.

## Agent loop

An agent reaches the workspace only with the owner's account token (see [Automation](automation.md)), under `https://tile.accenture.com/mapi/u/workspace/`. It cannot open `/apps/pages/draft/`.

1. `GET mapi/u/workspace/artifacts` returns `{ artifacts: [{ id, name, versions: [{ n, from_version, created_by, open_notes, handoff_at, … }] }], usage }`; pick the artifact `id` and version `n`.
2. `GET mapi/u/workspace/artifacts/<id>/versions/<n>/edit/handoff` returns the request the author stored with Send to agent as JSON (`base_hash`, `stale`, `instructions`, `markdown`, `changes`, `notes`, `saved`, `assets`, `bundle_url`); 404 if none. `stale: true` means the version changed since. Fetch each replacement image from its `assets[].url`; that URL and `bundle_url` are root-relative, so prefix `https://tile.accenture.com` and send the Bearer token. The old `…/versions/<n>/handoff` answers 410. Without a stored hand-off, `GET …/versions/<n>/edit/document`, then `POST …/versions/<n>/edit/handoff` with `{ "base_hash": "<X-Pages-Source-Hash>" }` builds a download package from saved edits and notes (409 if the version changed).
3. `GET …/versions/<n>/edit/download` (the hand-off's `bundle_url`) for the files to revise. Apply the hand-off as described in [Edit mode](editing.md).
4. `POST mapi/u/workspace/artifacts/<id>/versions?from=<n>` with the raw `.html` or `.zip` body pushes the revision as the next version (`201 { id, name, n, dropped, warnings }`); `from` must name an earlier version. `POST mapi/u/workspace/by-name/<name>/versions` creates or adds by case-insensitive name, and `POST mapi/u/workspace/artifacts?name=<name>` starts a new artifact.
5. `DELETE …/versions/<n>/edit/handoff` clears the stored request once the revision is pushed.
6. To publish, `POST mapi/u/pages/<slug>/upload-from-draft` with `{ "artifact": "<id>", "n": <n> }` → `{ upload_id }`, then `POST mapi/u/pages/<slug>/finalize` with `{ "upload_id" }` → `{ warnings, published: false }`, then `POST mapi/u/pages/<slug>/publish` → `{ published: true }`. Finalize takes the tile offline, and it stays a bare 404 until publish succeeds. The tile must already exist and the owner must administer it; never send a `declaration` field.

Version numbers are never reused. A replaced version answers 404 with `newest`; continue from that one.

## Limits

- 20 artifacts and 100 MiB per person, versions and stored hand-offs together; over either is 413 naming what to delete.
- 10 versions per artifact; the eleventh replaces the oldest.
- 60 version adds per hour per person, browser and agent together (429). Adds, draft edit saves, and stored hand-offs also count against the token's hourly write limit; upload-from-draft, finalize, and publish cost three units.
- An artifact idle for 90 days is deleted.
- Publishing a draft is capped at 64 MiB assembled (413); larger bundles must be downloaded and uploaded instead. A 503 means Tile is busy assembling others; retry shortly.

## Security

When the owner opens a version in `/apps/pages/draft/` or the editor, its JavaScript runs same-origin with the owner's session and can call any Tile API as them, including minting a token. A version pushed by a leaked token is therefore a way back in. Tile marks token-added versions in the version strip and the editor bar; tell the owner to review a token-added version before opening it. Keep only the owner's own token in the agent's environment and never log it.

## Verification

- The agent uses the owner's account token and only `mapi/u/workspace/*` and `mapi/u/pages/<slug>/*` routes.
- The stored hand-off is read from `…/edit/handoff`, applied in full, and cleared after the revision is pushed with `from=<n>`.
- Publishing from a draft ends with `publish` answering `{ published: true }`.
- Limits and the 404 `newest` case are handled.
- The owner is told the new version came from an agent before opening it.
