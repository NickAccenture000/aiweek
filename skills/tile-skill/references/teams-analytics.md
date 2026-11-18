# Teams and analytics dashboards

Reference status: manually maintained
Tile contract checked: 2026-11-03
Applicable skill version: 0.6.x
Canonical sources: web/src/lib/teamsDocs.ts, api/src/teams/routes.rs, api/src/teams/store.rs, api/src/pages/team_routes.rs, api/src/analytics/team.rs, api/src/auth.rs, docs/guides/team-engagement-dashboard.md

## Choose collection or reporting

Use this reference to read existing analytics, build a team dashboard, compare editions, or configure team links. For collecting reading time and clicks in the source tiles, use [Engagement analytics](analytics.md). Reporting groups are optional metadata, configured as described in [Reporting groups](reporting.md).

Publish the dashboard as a private tile. The source tiles may be private or public. The dashboard makes documented same-origin GET requests with the viewer's own SSO session; send no bearer token, credential, email header, or uploader identity. The uploader's permissions are not inherited by viewers. Changing who uploads identical HTML cannot grant its viewers analytics access.

## Setup and authorization

Keep these three operations separate:

1. **Team membership:** any colleague can create a team under account menu → Teams. Team owners add members and promote owners. An ordinary member can read team analytics; ownership is needed to manage the roster, not to read the numbers. Copy the team ID from the team's address or displayed API endpoint. A team name or reporting-group ID is not a team ID.
2. **Source-tile links:** an admin of each tile being measured links that tile under Manage → Access → Teams, chooses a grant, and clicks Save changes. The person linking must both administer the source tile and belong to the target team. A team owner does not automatically administer every source tile.
3. **Dashboard access and maintenance:** give intended viewers access to the dashboard. To let colleagues replace its HTML, add them as co-admins, or link the dashboard to a team with Full co-admin. Merely opening or administering the dashboard does not confer membership in the data team. Linking the dashboard does not link the source tiles or grant its viewers their analytics.

All three source-tile grants include analytics:

| UI grant | API value | Team members may |
| --- | --- | --- |
| Analytics only | `engagement` | Read analytics, but not open the tile through this grant |
| Viewer | `view` | Open the private tile and read analytics |
| Full co-admin | `edit` | Fully administer the tile, open it, and read analytics |

Viewer links are private-tier only. Public source tiles can be linked with Analytics only. Choose the least authority needed: Full co-admin includes replacing/deleting content, changing access, and minting tokens; all current and future team members receive it. Explain that risk before recommending it. Preserve Viewer grants when opening the source tile is intended; they already include analytics.

The team endpoints require actual membership even for app admins. Missing teams and callers outside the team get the same 404. A disabled team feature also answers 404. The per-tile analytics endpoint has its own tile-admin/team analytics authorization. Reporting groups grant no rights.

## Supported browser reads

These three GET endpoints are the narrow exception to the hosted management-API restriction in [Foundations](foundations.md). Call them under `/api/`. Asset URLs remain relative, and returned tile `url` values are authoritative.

| Endpoint | Use |
| --- | --- |
| `GET /api/teams/<team-id>/analytics` | One aggregate request for every linked tile, with optional edition windows |
| `GET /api/teams/<team-id>/pages` | Linked-tile metadata and each tile's analytics path; optional for an edition dashboard |
| `GET /api/pages/<slug>/analytics` | Detail for one tile, such as its heatmap; not a per-tile loop to reconstruct team totals |

Configure the team ID explicitly with the human. Use fetch with the same-origin session and check HTTP status and the JSON shape before rendering. No AI approval, service credential, app-admin uploader, or per-dashboard Analytics service toggle is needed to read existing team analytics. Event collection on each source tile is a separate concern.

The team analytics query accepts:

- `from` / `to`: calendar dates, default last 30 days; `granularity=day|week|month`; `tz=<IANA zone>`.
- `industry_group=<id>,<id>` and/or `client_group=<id>,<id>`: filter the source-tile set before all calendar aggregations, label trends, and edition selection.
- `group_by=industry_group|client_group`: add `groups[]`, including unique people counted distinctly within each group.
- `edition_days=N` (1–365): add `editions[]`, each tile over its own first N UTC days. The window starts on its first canonical visit, falling back to its creation day when there are no visits. It is not clipped to the calendar `from` / `to` range. Use `window_complete` to label editions still inside their window.

## Response shapes and date ownership

`GET /api/teams/<team-id>/pages` returns `{ pages: [...] }` with these fields per tile:

```text
slug, title, tier, mode, grant, expires_at, url, analytics, report_group
```

That page list has **no `published_at`**, totals, or engagement fields. `analytics` is a path such as `api/pages/<slug>/analytics`, relative to the API base, not the hosted document's injected content base.

`GET /api/teams/<team-id>/analytics` returns:

```text
range, totals, tier, engagement, engagement_prev, timeline, pages, filter
```

Its `pages[]` rows carry `slug, title, url, grant, report_group, totals, tier, engagement, engagement_prev`. These rows also have no `published_at`.

With `edition_days=N`, the same response adds `edition_days` and `editions[]`:

```text
slug, title, url, report_group, published_at, first_visit_on,
window: { from, to }, window_complete,
totals: { opens, identified_unique }, engagement, curve
```

Render editions directly when possible: they already carry title, URL, reporting group, date, and metrics. If a separate page-list request is necessary, join by `slug`; read the date from `edition.published_at`, not the page-list row. The API currently names the tile's creation timestamp `published_at`; the measurement window's start is `window.from`, not necessarily that timestamp.

- Use `totals.opens` for opens and `engagement.average_active_seconds` for average active time. `engagement` also includes `instrumented_visits`, `active_seconds`, `depth["30"|"60"|"180"]` with count/rate, and `clicks.activation` (plus engagement/outbound counts).
- `curve[]` contains dense per-day counts for the edition window. It is not a second independent total to add to the edition totals.
- Team rates come from summed counts. Use returned team totals/rates rather than averaging tile rates or summing per-tile unique people; a person can visit multiple tiles.
- `report_group` can be null, a client group (`depth: 0`), or an industry group (`depth: 1`, with `parent`). Include an explicit ungrouped/client-group state unless the user requested an industry-only view.
- Format full timestamps directly. For a `YYYY-MM` month key, construct a complete date using `month + "-01T00:00:00Z"` before formatting.
- Zero tracked visits is not proof of broken instrumentation: the tile may have no visits. Distinguish empty data from a failed request.

## Failures and diagnostics

Keep fetch, response validation, and initial rendering inside the same error boundary. A successful fetch followed by a render exception must produce a visible error rather than a hidden dashboard or endless loading message. Handle event-handler failures too. Build UI from textContent and validate link protocols as in Foundations.

- **404:** explain that team analytics are unavailable; check the configured ID, current viewer's membership, and whether teams are available in the deployment. A 404 does not prove the dashboard needs a team link or an upload by a particular colleague.
- **401 / sign-in redirect:** ask the viewer to sign in and reload. A redirect may return HTML rather than JSON; check the response content type so a login page is not treated as analytics.
- **400:** surface the server's request-validation message and check parameters. This status alone is not evidence that edition analytics are unsupported.
- **429, 5xx, offline:** show a visible unavailable state and a manual read-only retry; do not silently substitute demo numbers or automatically retry 429.
- **Missing `editions`:** say the response lacks the requested edition data; check parameters/deployment. Do not claim a permission diagnosis or silently label missing data as zero visits.

Read [the complete team dashboard example](../examples/team-dashboard.html) before authoring one. It uses one request, reads dates from editions, displays all linked grants, and keeps errors visible. Demo fixtures must match the real response shapes: no publication date on page-list rows and no exclusion of Viewer grants. Initialize helpers before starting asynchronous boot code.

## Verification

- The capability router loads this reference for reading analytics, not just the collection reference.
- Viewers have dashboard access and data-team membership; source-tile links are saved independently.
- Analytics only, Viewer, and Full co-admin all appear in results; maintenance permissions are not required for reading.
- An API-shaped response without publication dates on `pages[]` renders using `editions[].published_at`.
- Dates, empty results, null groups/rates, incomplete edition windows, and returned tile URLs render honestly.
- Failed fetches, non-JSON login responses, malformed/missing edition data, and rendering errors show visible status; a successful retry clears it.
- Any demo has the same schema and grant behavior as production, and is explicitly selected/labeled.
