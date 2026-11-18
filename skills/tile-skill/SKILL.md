---
name: tile-skill
description: Use when building or publishing HTML on Tile, extending or automating existing tiles, or working with the Tile SDK (tile.js), tile access tokens (PATs), account tokens, the personal workspace, analytics dashboards, teams, AI, vector search, storage, SQLite, surveys and other intake forms, API connections, Gallery, reporting groups, tile access, or edit-mode hand-offs.
---

# Tile

API routes, token prefixes, and some header, cookie, and error names contain `pages` (`/mapi/v1/pages/<slug>`, `pages_access_<slug>`, `pgs_`, `X-Pages-Source-Hash`, `PAGES_SQLITE_ROWS_ONLY`); write them exactly as documented and never rename them to `tiles`.

Build and operate tiles against the supported platform contract. Determine the tile tier first, read the relevant capability references before editing, and do not invent SDK methods or service routes.

## Workflow

1. Confirm that the task targets Tile. Do not introduce Tile capabilities into unrelated HTML or web projects.
2. Read [Foundations](references/foundations.md) for every Tile task.
3. Determine whether the tile is private or public. Load the SDK from /vendor/tile.js for either tier. If the tier is unknown, avoid private services until the tier is confirmed.
4. Read only the capability references needed for the request. For tasks that combine capabilities, read every applicable reference before changing code. When authoring or changing HTML, always read [Edit mode](references/editing.md) as well so authored content stays editable and the editor cannot trigger writes.
5. State the audience, roles, enablement requirements, persistence, data egress, quotas, and unavailable-service behavior for each capability. Include concrete admin setup instructions in the hand-off and actionable disabled-service or read-only messages in the tile; distinguish service enablement, SQLite write permission, and AI approval. For every SDK integration, implement the [visible service status and SDK outcome checks](references/foundations.md#visible-service-status), including SDK loading, identity/roles, database, storage, AI/vector, API calls, streams, subscriptions, cache helpers, and analytics. Account for every observable failure or unconfirmed outcome rather than silently dropping it; disclose best-effort delivery where the SDK cannot confirm it.
6. Preserve the existing framework, controls, styling, and build structure unless the user asks to change them.
7. Implement only the requested capabilities. Keep optional improvements as short suggestions instead of silently adding them.
8. Run the project checks and the verification checklist from every selected reference. Exercise the failure path of every SDK integration, not only its happy path.

## Platform boundaries

- Private tiles run under `/view/` and may use enabled SDK services. Public tiles run under `/public/` and support analytics only.
- The private/public tier is immutable. If a public tile needs a private service, propose a private companion tile instead of wiring a `svc/*` route directly.
- Load the SDK as a classic script. Do not import it as an ES module or use top-level `await`; use an async IIFE or async event handler.
- Do not hardcode a tile slug, hosted `/view/` path, credential, token, model ID, arbitrary upstream URL, or undocumented API.
- Hosted JavaScript is same-origin and unsandboxed. Keep secrets out of uploaded bundles and treat uploaders as trusted code publishers.
- Client-side role checks control presentation only. The server remains the authorization boundary.
- Optional services need an honest fallback. Do not automatically retry quota failures such as HTTP 429.
- Republishing replaces all of the tile's content, including edits saved in Tile's editor. Before re-uploading from source, carry saved edits into the source.
- A token's finalize takes the tile offline. A token deployment is upload (or upload-from-draft), finalize, then `publish`; it is done only when `publish` answers `{ published: true }`.

## Capability routing

| Need | Read |
| --- | --- |
| SDK loading, tiers, identity, shared safety rules | [Foundations](references/foundations.md) |
| HTML or ZIP bundles, publish, republish, asset paths | [Publishing](references/publishing.md) |
| Private/public access, administrators, expiry, share links | [Access and retention](references/access.md) |
| Collect engagement and activation events | [Engagement analytics](references/analytics.md) |
| Read analytics, build team dashboards, compare editions, or configure team access | [Teams and analytics dashboards](references/teams-analytics.md) |
| Completion, structured output, chat, models, embeddings | [AI](references/ai.md) |
| Document ingestion, retrieval, cited answers | [Vector search and RAG](references/vector.md) |
| Files, per-viewer saved values, user/shared scopes, or a tile still calling the retired `tile.kv` | [File storage and saved values](references/storage.md) |
| Collaborative relational data and concurrency | [SQLite](references/sqlite.md) |
| Surveys, feedback, sign-ups, polls, RSVPs, and other forms where everyone submits and only the owner reads | [SQLite submit-only intake](references/sqlite-survey.md) |
| Approved external API connections and streams | [External API broker](references/api.md) |
| Internal discovery, previews, tags, downloads | [Gallery](references/gallery.md) |
| Client or industry reporting metadata | [Reporting groups](references/reporting.md) |
| App-admin approvals and quota or connection requests | [Requests](references/requests.md) |
| Edit-mode saves, change notes, and hand-off packages | [Edit mode](references/editing.md) |
| CI publishing, SQLite row sync, upload and compact, and agent work with tile access tokens (PATs) or account tokens | [Automation](references/automation.md) |
| Draft artifacts, versions, and the agent edit loop | [Personal workspace](references/workspace.md) |

## Implementation examples

Use examples only after reading the corresponding reference:

- [Analytics instrumentation](examples/analytics.html)
- [Team edition dashboard](examples/team-dashboard.html)
- [AI chat](examples/ai-chat.html)
- [Vector RAG](examples/vector-rag.html)
- [Saved values and file storage](examples/storage.html)
- [SQLite collaboration](examples/sqlite-app.html)
- [Submit-only survey](examples/survey.html)
- [External API streaming](examples/external-api.html)

## Completion check

Before finishing, confirm that the implementation uses only documented surfaces, matches the tile tier, exposes no secret or sensitive identifier, handles disabled services and quotas, preserves existing behavior, and satisfies every selected reference's verification section.
