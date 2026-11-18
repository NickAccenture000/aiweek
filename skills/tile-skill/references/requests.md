# Requests

Reference status: manually maintained  
Tile contract checked: 2026-10-27  
Applicable skill version: 0.6.x  
Canonical sources: api/src/requests/kinds.rs, api/src/requests/mod.rs, api/src/requests/apply.rs, api/src/admin/requests.rs, web/src/requests/RaiseForm.svelte

Use the management request workflow when a tile admin needs an app-admin decision. Only people who administer at least one tile can raise requests (except `power_user`, which anyone signed in may raise), from the Requests screen in the Tile UI or with `POST /api/requests` (`/mapi/u/requests` with an account token).

| Kind | Scope | Payload |
| --- | --- | --- |
| ai_access | Person: permission to enable AI | none |
| ai_model | Tile | `{ models: [...] }`, 1–8 model IDs |
| quota | Tile | `{ target, value }`; API targets also need `connection` |
| api_host | Tile | `{ base_url, name? }`, an exact host |
| page_quota | Person: the tile limit | `{ value }`, a new maximum of live tiles above the current one, at most 10,000 |
| power_user | Person: become a tech power user, who may mint account tokens | none; raised from the Profile screen; refused while publishing is paused |
| bug, feature, other | Free text | none |

Quota targets are `kv_<knob>`, `file_<knob>`, `sqlite_dbBytes`, `ai_daily_budget` (US dollars), `api_requests`, and `api_bytes`. Vector document limits are not requestable; use other.

Send `{ kind, slug, payload, body }`; slug is required for tile kinds and must name a tile the caller administers. body is the justification: required, at most 4,096 characters. A created request answers 201 with its id. One open request per typed target is enforced; a duplicate is a 409 carrying the existing request's id. Free-text kinds allow ten open requests per person (429 beyond). Open requests may be withdrawn with `DELETE /api/requests/<id>`, which deletes them. `GET /api/requests` lists the caller's own.

An app admin may approve a different value from the one requested. Typed approval applies the grant and records the decision atomically; a failed grant leaves the request open. An ai_model grant adds to the tile's effective model list and is refused when the tile has no model restriction. Approving a bug, feature, or other request records the decision and writes no configuration. Rejection requires a note.

For missing AI approval, direct the tile admin to **Request AI access** in Tile (kind ai_access). This grants the person permission to enable AI only after an app admin approves it; the admin must still turn AI on for the target tile under Manage → Services. See [AI setup](ai.md#setup-and-troubleshooting). Changing HTML or requesting access does not bypass either step.

There is no email notification in either direction. Requesters and admins discover status through the Tile UI.

Do not bypass this workflow by editing HTML, calling an app-admin route as a tile admin, or claiming a request itself grants access.
