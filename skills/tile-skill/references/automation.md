# Automation

Reference status: manually maintained  
Tile contract checked: 2026-10-27  
Applicable skill version: 0.6.x  
Canonical sources: api/src/machine/mod.rs, api/src/pat/, api/src/pages/token_routes.rs, api/src/pages/upload_routes.rs, api/src/pages/publish_routes.rs, api/src/pages/sqlite_routes.rs, api/src/sqlite/broker.rs, api/src/declaration/mod.rs, web/src/lib/patDocs.ts, api/src/acct/, api/src/caller.rs, api/src/requests/kinds.rs, web/src/lib/accountTokenDocs.ts

## Choosing a token

| Need | Token |
| --- | --- |
| One pipeline publishes one tile's bundle, replaces its dataset, or syncs its rows | Tile access token (PAT, `pgs_…`) on `/mapi/v1/` |
| An agent works across several tiles, creates tiles, edits, reads current content, or uses the workspace | Account token (`pga_…`) on `/mapi/u/` |

Prefer a PAT whenever one tile suffices: it reaches one slug and only the operations its scopes name. Never put either token in an uploaded bundle.

## Tile access tokens (PATs)

A PAT is a bearer credential for exactly one slug. It has no SSO identity and is never an app admin. Use base `https://tile.accenture.com/mapi/v1/`, for example `https://tile.accenture.com/mapi/v1/pages/<slug>/upload`; the machine plane exposes only these ten routes:

| Route | Scope | Request → success |
| --- | --- | --- |
| `GET /mapi/v1/whoami` | none | empty → `{ tid, slug, name, scopes, expires_at }` |
| `GET /mapi/v1/pages/<slug>` | `content:read` | empty → `{ slug, title, mode, updated_at, updated_by, expires_at }`; metadata only: no HTML, no admin roster, no `published` |
| `POST /mapi/v1/pages/<slug>/upload` | `content:write` | raw file body (`.html` or `.zip`) → `{ upload_id }` |
| `POST /mapi/v1/pages/<slug>/finalize` | `content:write` | JSON `{ "upload_id": "<from upload>" }` → `{ warnings: [], published: false, scan: { rating, findings, … } }` |
| `POST /mapi/v1/pages/<slug>/publish` | `content:write` | empty → `{ published: true }` |
| `POST /mapi/v1/pages/<slug>/sqlite/upload` | `data:write` | raw `.sqlite` body → `{ ok: true }` |
| `POST /mapi/v1/pages/<slug>/sqlite/compact` | `data:write` | JSON `{ "accept_rowid_change": false }` → `{ before_bytes, after_bytes, rowids_changed, auto_vacuum }` |
| `GET /mapi/v1/pages/<slug>/sqlite/download` | `data:read` | empty → SQLite attachment; 404 `no database yet` if none |
| `DELETE /mapi/v1/pages/<slug>/sqlite` | `data:delete` | empty → `204` with no body |
| `POST /mapi/v1/pages/<slug>/sqlite/pipeline` | `data:rows` | Hrana v2 JSON `{ "requests": [ …, { "type": "close" } ] }` → `{ baton: null, results: [ … ] }` plus header `X-Svc-Sqlite-Rev` |

Write every path in full; `mapi/v1/upload` without `pages/<slug>` does not exist. Send `Authorization: Bearer <PAT>` and nothing else; the plane never reads `X-Forwarded-Email`, so never synthesize it. Uploads are raw bodies (`curl --data-binary @dist.zip`), not multipart. Finalize, compact, and pipeline use `Content-Type: application/json`.

### Shells on macOS, Linux, and Windows

Check which shell runs the commands before writing them; the routes and bodies are the same everywhere.

- macOS and Linux: `curl` with the token from an environment variable, `-H "Authorization: Bearer $TILE_TOKEN"`.
- Windows PowerShell: `curl` there may be an alias for `Invoke-WebRequest`, so call `curl.exe` (included with Windows 10 and 11) or use `Invoke-RestMethod`. Read the token as `$env:TILE_TOKEN`. Quote the file argument (`--data-binary '@dist.zip'`), because a bare `@name` is PowerShell splatting. PowerShell before 7.3 strips the double quotes inside a JSON argument passed to `curl.exe`, so write JSON bodies to a file and send `--data-binary '@finalize.json'`, or use `Invoke-RestMethod -Method Post -ContentType 'application/json' -Body (@{ upload_id = $id } | ConvertTo-Json)`.
- Windows Command Prompt: use `curl.exe`, read the token as `%TILE_TOKEN%`, and send JSON bodies from a file.
- Everywhere: add `-f` (or `--fail-with-body`) to `curl` and check `Invoke-RestMethod` errors so a non-2xx status fails the step, and never echo or log the token.

### Scopes

Six scopes, deny by default and fixed at mint. None implies another.

| Scope | Unlocks | Grant when |
| --- | --- | --- |
| `content:write` | upload, finalize, publish | The ordinary CI publisher; the default. Cannot read data or change settings. |
| `content:read` | `GET pages/<slug>` | Rarely; publishing does not need it. |
| `data:rows` | `sqlite/pipeline` | A sync job or workflow that reads and changes rows. Cannot change the schema, or replace, download, compact, or delete the file. |
| `data:write` | `sqlite/upload`, `sqlite/compact` | A job that replaces the whole dataset, schema included. Cannot read the old one back. |
| `data:read` | `sqlite/download` | Only a backup job: it reads every row every viewer wrote. |
| `data:delete` | `DELETE sqlite` | Almost never; there is no version history to restore from. |

### Errors

Treat non-2xx as failure:

| Status | Meaning |
| --- | --- |
| `302` | Reached the SSO gate, not the machine plane: check the URL first. |
| `400` | Empty upload, invalid JSON, missing `upload_id`, a rejected bundle (no `index.html` at the root or in one top-level folder, unsafe path, too many files, over 100 MiB decompressed), or an invalid SQLite file. |
| `401` | Authentication failed; one answer for unknown, revoked, expired, and wrong secret. Check `whoami`. |
| `403` | Valid token missing the scope; mint a new token with it. |
| `404` | Wrong slug, deleted tile, unknown `upload_id`, unknown route, plane switched off, SQLite off for the tile (pipeline), or no database yet (compact, download). Branch on status, not body. |
| `409` | Another publish or edit save holds the tile, or Tile is busy with other tiles; retry shortly. From `publish`: the tile has expired and a person must renew it. From `compact`: the body's `tables` would have their rowids renumbered. |
| `413` | Body over 100 MiB, or a pipeline write would take the database over its quota (nothing is saved). |
| `422` | Finalize refused the bundle: its script calls Tile's management API (`/api/account`, `/api/admin`, `/api/pages/…/tokens`, `/mapi`), or it contains secret files (`.env`, `.git/`, private keys). The error names the files; the live tile is untouched. |
| `429` | The token's hourly publish limit, its separate pipeline limit, or ten failed authentications within a minute for this token id. |
| `503` | Database briefly unavailable, or compact busy; the plane fails closed. Retry. |
| `507` | Compact found too little free space; the database is unchanged. Retry later. |

Never parse JSON from the successful `204` delete. Finalize warnings and `scan` findings other than the 422 refusals never block: the new files are in place.

No machine route changes ACLs, access tier, expiry, service toggles, or tokens, and none unpublishes. Keep those actions with a signed-in tile admin.

### Publishing workflow

Use one PAT per slug, scoped to `content:write`. Publishing takes three calls: POST the file to `upload` and capture `upload_id`, POST it as JSON to `finalize`, then POST `publish` and confirm `{ published: true }`. A token's finalize always takes the tile offline before replacing its files, and an unpublished tile is a bare 404 for everyone, admins included, so a pipeline that stops after finalize leaves the tile down. If finalize fails after validation (409 or 5xx), the tile may already be offline: retry finalize, then publish. Calling `publish` on a live tile is harmless. Serialize deployments for one slug. Finalize validates before replacement, replaces the whole old tree (including edits saved in Tile's editor since the last upload), and does not renew expiry.

### Row-level SQLite (`data:rows`)

`sqlite/pipeline` takes the same Hrana v2 pipeline a tile's own JavaScript sends to `svc/sqlite/v2/pipeline` (see [SQLite](sqlite.md)). Rules:

- Only SELECT, INSERT, UPDATE, and DELETE run. A schema change, pragma, ATTACH, VACUUM, or transaction statement (`BEGIN`, `SAVEPOINT`, `COMMIT`) comes back as a result of type `error` with code `PAGES_SQLITE_ROWS_ONLY` inside a 200. Check every entry of `results`, not just the HTTP status.
- Each call is stateless and must end with `{ "type": "close" }`. Viewers can write between your read and your write, so make each write conditional (`WHERE id = ? AND updated_at = ?`) and treat `affected_row_count: 0` as a conflict to re-read, not to retry blindly.
- Bind values through `args` (`{ "type": "text" | "integer" | "float" | "null" | "blob", "value": … }`; integers travel as strings). Never interpolate SQL.
- Every writing call republishes the whole database, so put many statements in one pipeline instead of one call per row.
- The tile's Database service must be on (404 otherwise); the token needs no viewer or editor role, since the scope is the grant.

Example request body:

    {"requests":[
      {"type":"execute","stmt":{
        "sql":"UPDATE task SET status = ?, updated_at = ? WHERE id = ? AND updated_at = ?",
        "args":[{"type":"text","value":"done"},{"type":"text","value":"<new timestamp>"},
                {"type":"integer","value":"42"},{"type":"text","value":"<timestamp you read>"}]}},
      {"type":"close"}]}

### Compact

A database Tile created reclaims deleted rows' space automatically. An older or uploaded database keeps it until compacted once; `sqlite/compact` rewrites the file and switches it to automatic reclaiming. Send `accept_rowid_change: false` first; on 409, send `true` only if nothing stores rowid values (tables without an `INTEGER PRIMARY KEY` get renumbered). Compact is rarely needed and is not part of a normal publish.

### Limits, minting, and rotation

- Upload, finalize, publish, and every SQLite upload, download, delete, and compact count against 60 publish units per hour per token, so one publish costs three and you can budget about 20 an hour.
- `sqlite/pipeline` has its own limit of 600 calls per hour per token and spends no publish units.
- A tile admin mints PATs in Manage → Automation and confirms the data declaration there; it covers everything the token publishes, so machine requests never carry one. The value is shown once; only a hash is stored.
- PATs expire: default 90 days, maximum 365 days, never later than the tile; an expired tile cannot mint one, and a token on an expired tile answers 401. There is no renewal. Rotate by minting a replacement, updating the CI secret, verifying with `whoami`, then revoking the old token.
- At most ten live tokens per tile. Removing the minter from the tile's admins revokes their tokens on it.

Keep the PAT in the CI secret store and out of URLs, logs, artifacts, caches, and untrusted pull-request jobs.

## Account tokens

An account token (`pga_…`) is a personal delegate for an agent: it acts as its owner on every tile the owner currently administers (named or through an `edit` team), through `https://tile.accenture.com/mapi/u/…`. Each `/api/<route>` of the management plane maps to `/mapi/u/<route>`. Commonly used:

| Route | Purpose |
| --- | --- |
| `GET mapi/u/me` | Smoke test; who the token acts as. |
| `GET` / `POST mapi/u/pages` | List administered tiles / create a tile. |
| `GET` / `PATCH` / `DELETE mapi/u/pages/<slug>` | Detail, settings and renewal, delete. |
| `GET mapi/u/pages/<slug>/download` | ZIP of the current stored bundle, serving-path rewrites undone. |
| `POST mapi/u/pages/<slug>/{upload,finalize,publish,unpublish}` | Publish cycle. |
| `GET mapi/u/pages/<slug>/edit/document`, `PUT …/edit/source` | Targeted, hash-checked edit saves (see [Edit mode](editing.md)). |
| `GET` / `DELETE mapi/u/pages/<slug>/edit/handoff` | Stored hand-off from Send to agent. |
| `POST mapi/u/pages/<slug>/sqlite/upload`, `GET …/sqlite/download`, `DELETE …/sqlite` | Whole-database replace, download, delete. |
| `GET mapi/u/pages/<slug>/sqlite/health` | `{ bytes, free_bytes, auto_vacuum, rowid_tables_without_alias, tables_without_index, tables, indexes }`. |
| `POST mapi/u/pages/<slug>/sqlite/compact` | Same body, answers, and 409/507 rules as the PAT route. |
| `mapi/u/pages/<slug>/links`, `…/edition`, `mapi/u/requests`, `mapi/u/workspace/*` | Share links, reporting group, requests, workspace. |

An account token has no row-level SQL route; use a `data:rows` PAT for row sync.

Create with `POST mapi/u/pages` and JSON `{ "slug", "title", "mode" }` → `201 { slug, url_shape, url }`. `mode` defaults to `allowlist` (an empty allowlist), so pass `all-acn` to open the tile to every signed-in colleague; take the address from `url`. Publishing is the same three calls as a PAT: upload, finalize (always `published: false`), then `POST mapi/u/pages/<slug>/publish` → `{ published: true }`. `POST …/unpublish` takes a tile offline (`{ published: false }`). Never send a `declaration` field: the token declared at mint, and a request that offers one answers 400. On an expired tile, renew with `PATCH mapi/u/pages/<slug>` and `{ "expires_at" }` before publishing.

Before replacing an existing tile, download its current bundle and merge local changes against it. A full-bundle finalize has no revision check: a later finalize overwrites newer changes, and downloading right before uploading does not close that race, so coordinate through one publisher. Only edit saves (`PUT …/edit/source` with `base_hash`) answer 409 when `index.html` changed underneath.

### Minting

The owner mints the token on the Profile screen, confirming the data declaration; it is shown once. Minting is limited to app admins and tech power users. Anyone else sees a request form on Profile ("Request tech power user access"), which raises a `power_user` request an app admin approves; no tile is needed to ask. Removing someone from the tech power users revokes their live account tokens.

### Exceptions

`/mapi/u/admin/*`, any token route (`/pages/<slug>/tokens*`), `/mapi/u/account/*`, and `/mapi/u/shared/*` answer 404. `ai_enabled: true` on create or update answers 403, because a person must enable AI. Creating a public tile needs the token's public acknowledgment, which Profile does not grant, so expect 403; a guessable public address additionally needs the guessable-address acknowledgment plus `guessable_url_ack: true` in the request. Tile ignores the token on `/view/`, `/public/`, and `/apps/pages/draft/`, so it cannot open a tile as a viewer; read content through `download` instead.

### Limits

- Five live tokens per person; 30-day default and 90-day maximum lifetime with no renewal.
- 20 created tiles per token per 24-hour window, counted from its first create. Created tiles count against the owner's live-tile limit (100 by default).
- 60 counted writes per token per hour. Counted writes are upload, upload-from-draft, finalize, publish, SQLite upload, delete, and compact, edit-mode saves, stored hand-offs (`edit/handoff?store=1`), custom preview uploads, and workspace version adds. A full publish costs three, so budget about 20 an hour; a counted call spends its unit even when it then fails. Reads, health, and settings `PATCH`es are not counted.
- The same 401, 404, 429, and 503 rules as PATs apply; 403 also means the owner does not administer that slug. 409 also means a slug is taken, the owner is at their tile limit (the body carries `limit` and `count`; raise a tile-limit request), an edit save's `base_hash` is stale, or `publish` hit an expired tile. The plane is off by default and answers 404 while off.

A leaked account token reaches every tile its owner administers: it can replace content with script, create tiles, add co-admins, extend expiry, mint share links, publish or unpublish, and delete tiles. Revocation does not undo any of that, and planted script can mint a fresh token with a visiting colleague's session. The owner revokes on the Profile screen; an app admin can revoke every token for a person.

## Security delta

A leaked `content:write` token can replace one tile's content with arbitrary JavaScript and put it live, which Tile serves same-origin and unsandboxed inside the Accenture SSO perimeter, running with each visiting colleague's session. A leaked `data:rows` token can read and change every row in one tile's database. Scope and TTL limit the blast radius; revocation does not undo script already published or rows already changed. Revoke suspected leaks, then republish known-good content.

## Verification

- Every PAT endpoint is one of the ten routes above and includes `pages/<slug>` where required; account-token calls use `mapi/u/`.
- An account token is used only when the work spans several tiles, creates tiles, edits, reads current content, or uses the workspace.
- Token slug and scopes match only used operations; row sync uses `data:rows`, not `data:write` plus `data:read`.
- Publication performs upload, finalize, then publish, checks each response, and ends with `published: true`.
- Pipeline calls end with `close`, bind every value, check each result for `error`, and make human-contested writes conditional.
- No account-token request carries a `declaration` field.
- CI cannot alter access, expiry, services, or credentials.
- Rotation, revocation, and log hygiene are documented.
