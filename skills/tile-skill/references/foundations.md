# Foundations

Reference status: manually maintained  
Tile contract checked: 2026-10-13  
Applicable skill version: 0.6.x  
Canonical sources: web/src/sdk/tile.ts, web/src/sdk/cache.ts, web/src/sdk/errors.ts, web/src/lib/sdkDocs.ts, api/src/hosting/, api/src/me/, api/src/cross_site.rs, deploy/nginx.conf

## Establish the boundary

| Tier | Hosted address | Browser capabilities |
| --- | --- | --- |
| Private | https://tile.accenture.com/view/<slug>/ | SDK identity and role, AI, vector, files, SQLite, approved APIs, analytics |
| Public | https://tile.accenture.com/public/<slug>/ | Analytics only |

The tier is chosen when the tile is created and cannot change. If a public tile needs a private service, keep the public tile as a landing surface and create a private companion tile; never invent a public svc route.

Take a tile's address from the `url` field the management API returns; do not compose it from the slug. An unpublished tile answers 404 to every caller, admins included, for its index.html and every svc route.

## Load the SDK

The SDK is a classic script that creates window.tile. Load it from the same root-absolute path for private, public, and tier-unknown tiles:

    <script src="/vendor/tile.js"></script>

Keep /vendor/tile.js exactly as written; it is a platform asset, not a file to bundle or resolve relative to the tile. Replace legacy SDK locations when updating existing tiles. Use only tile.js and the window.tile (tile.*) API for SDK integrations, including when updating existing tiles. Do not add type="module" or import the SDK as an ES module. Classic scripts do not support top-level await; put awaited initialization in an async IIFE or an async event handler. Await SDK promises inside try/catch, or attach an explicit rejection handler; an unhandled svc failure only reaches the console. This applies to every write. Not every tile.* call returns a promise: sqlite.watch() returns a stop function, files.getUrl() returns a string, and analytics and cache controls are synchronous. Consume chat() and api.stream() with for await…of.

Publishing injects the tile's base URL. Use relative svc paths, which resolve against it, or the tile facade; do not hardcode a slug or /view/<slug>. Give every bundled asset a relative URL (./… from the entry document; relative to the containing file in CSS or nested documents). Static root-absolute asset references are rewritten at publish time, but URLs assembled in JavaScript are not. The platform SDK and documented vendor paths above are deliberate root-absolute exceptions.

Tile also serves htmx, mustache, and the htmx json-enc and client-side-templates extensions under /apps/pages/vendor/; with htmx loaded, tile.js enables both extensions on body unless body already has an hx-ext attribute. These load on private tiles only; a public tile must bundle its own copy.

## Trust and data

Hosted JavaScript runs same-origin without a sandbox. Treat uploaders as trusted and keep secrets out of HTML. Role probes hide or show affordances; the server remains the authorization boundary.

Use the SDK for tile services and event collection. Private analytics dashboards may also make same-origin GET requests to the three read-only endpoints documented in [Teams and analytics dashboards](teams-analytics.md): `/api/teams/<team-id>/pages`, `/api/teams/<team-id>/analytics`, and `/api/pages/<slug>/analytics`. These use the viewer's own SSO session, not the uploader's permissions. Keep other management `/api/*` calls out of hosted tiles; use the management UI or documented automation plane for configuration. Mutating /api/* requests from another origin are refused with 403.

Before adding a capability, state:

- who can read and write;
- whether the tile admin or app admin must enable it;
- whether data persists after the call;
- whether content egresses to an external model provider or upstream;
- which quota or budget can refuse it;
- what the tile does when it is unavailable.

## Authoring safety

- Keep authored text, images, and links in static index.html markup so admins can save changes through Manage → Edit; render live service data dynamically. Read [Edit mode](editing.md) when authoring HTML.
- Make application writes explicit button or form-submit actions, including database initialization. Keystrokes and timers may update local UI or refresh reads, not persist changes. Analytics is a separate SDK-managed measurement lifecycle.
- Skip load-time side effects when window.__PAGES_EDIT__ is set. Also guard mutating handlers so interacting with the editor cannot save application data.
- Bundle scripts, styles, fonts, and images locally rather than fetching them from third-party sites. Keep the documented Tile SDK/vendor paths; use the API broker for approved service calls.
- Use textContent for untrusted data. If markup is necessary, use a trusted sanitizer or context-appropriate escaping for every interpolated value; validate link protocols separately. Keep code static rather than using eval or new Function, and keep passwords, API keys, and other credentials out of the bundle.
- For CSV exports, prefix cells starting with =, +, -, or @ with an apostrophe before CSV quoting; also handle leading tabs, carriage returns, or whitespace that could hide a formula prefix. CSV quoting alone does not prevent spreadsheet formula execution.

## Identity and roles

Both probes work on private tiles only.

- tile.me() returns { email, isAppAdmin, canEnableAi }. canEnableAi means the person may turn AI on for tiles they administer; it does not mean AI is usable here. aiAllowed is a deprecated alias of canEnableAi; do not use it.
- tile.role() calls svc/me and returns { email, isPageAdmin, isAppAdmin, canWriteSqlite, sqliteAccess } for this tile. sqliteAccess is "read-write", "read-only", "submit-only", or null when SQLite is off; a release without submit-only mode omits the field (see [SQLite submit-only intake](sqlite-survey.md#availability)). isPageAdmin is the raw tile admin role, so an app admin who does not administer the tile reads false; gate on isPageAdmin || isAppAdmin only when app admins should see the control. canWriteSqlite already folds in whether SQLite is on. It is not cached; wrap it in tile.cached() if needed.
- tile.ai.available() decides AI affordances. Never infer AI from tile.me().

Neither probe secures anything: any viewer can read the bundle and call services directly.

## Visible service status

Every SDK-backed feature must show a persistent, visible status near the affected controls. This covers SDK loading, identity/roles, SQLite, Files, AI/vector, API calls, streams, subscriptions, cache helpers, and analytics. Background helpers report through their owning feature's status, not a separate badge for every call. Status must reflect what the SDK actually exposes; best-effort or unconfirmed delivery is not confirmed success:

- Start with a checking state, then show ready, read-only, disabled/not configured, or temporarily unavailable as supported by the actual result. A configured service is not proof that a call succeeded; mark it ready only after a successful availability probe or real read. Use documented SDK methods rather than inventing a connection API or issuing a test write.
- On a missing connection or failed request, show a plain-language warning and the appropriate next step, such as admin enablement or a read-only Retry action. A console log, empty table, or success-looking local fallback is not a failure indication.
- Keep failures visible until a successful recheck; update status after later read, refresh, and write failures too. Keep action feedback such as “Saved” separate so it cannot hide an unavailable-service warning. If previously loaded data stays on screen, label it stale; show “No records” only after a successful empty read.
- Disable controls that cannot safely work while the service is unavailable, retain unsaved input, and state when changes are local/not saved. Keep unrelated features usable.
- Use text as well as any color/icon and an accessible status region (for example role="status" with aria-live="polite").
- Every user-triggered operation has pending and confirmed-success, failed, cancelled, or unconfirmed feedback. Mark success only when the operation's documented result confirms it, not merely because a handler returned or cleanup ran. Empty catches and console-only errors do not satisfy this contract. Use bounded UI waits for finite requests; where cancellation is unsupported, a UI timeout does not cancel the request or prove a write failed.

### SDK outcome checks

Apply every applicable row; try/catch alone does not cover non-throwing failures.

| SDK surface | Required handling |
| --- | --- |
| SDK loading and initialization | Keep a static unavailable/checking message visible until initialization succeeds. Handle script load failure and a missing window.tile before calling it; a broken SDK must not leave dead controls without explanation. |
| Identity and roles: me(), role() | Show session/access/probe errors. Treat unknown permission as unknown, not confirmed read-only or allowed; keep restricted controls unavailable until the probe succeeds. |
| Promise-based operations: SQLite, Files writes and lists, AI, vector, svc(), request(), retry(), cached() | Await/catch every returned promise, including work started by event handlers or callbacks. Handle synchronous throws too. Show rejection, refused writes, and quota failures; preserve drafts and distinguish an uncertain write outcome from a confirmed failure. |
| Non-throwing results | Inspect ai.available().ok/reason; sqlite.applyIf().applied:false is a visible conflict. files.stat() returning null can mean missing data or disabled storage, not proven health. Inspect response.ok/status for files.get(), api.fetch(), and request(); also inspect X-Svc-Error for broker responses. |
| AI and API streams | Handle errors before opening, iteration failures, in-band AI error chunks, API svcError frames, and upstream non-2xx status frames. Show cancelled/incomplete output. Require AI's done chunk before claiming completion; an unexpected end is not success. API streams use their upstream protocol's completion semantics, not an invented AI-style done frame. |
| SQLite watch and cache subscriptions | Catch async callback failures and update the owning feature's status. Keep cleanup functions and unsubscribe on teardown. watch() can silently poll/reconnect and does not expose a health callback: a returned stop function or missing notification is not proof of a healthy live connection. Provide a read-only refresh/recheck to establish data freshness. |
| Synchronous helpers and cached/local data | getUrl(), cache operations, analytics controls, and cleanup functions are not delivery acknowledgments. Show resource load errors for SDK-generated image/file links where the browser exposes them. Label stale or local-only data; cache writes/invalidation do not persist remote data. |
| Analytics | Follow [analytics failure behavior](analytics.md#failure-behavior). Audit instrumentation and disclose best-effort/unconfirmed delivery in non-blocking operator-facing status. start(), track(), and flush() do not acknowledge server receipt; unavailable or dropped telemetry may not be observable to tile code. Keep core behavior usable and never claim zero loss. |

Verify disabled services, missing SDK, permission/session refusal, offline/503, quota/429, non-2xx responses, conflicts, stream errors/early end, callback rejection, stale data, and recovery wherever applicable. Record SDK observability limits in the hand-off rather than claiming undetectable drops are prevented.

## Failures, retry, and caching

Most JSON methods throw tile.TileSvcError with status and error. SQLite refusals that carry a code throw its subclass tile.TileSqliteError, which adds code and column. Exceptions are documented by their capability: ai.available never throws, files.stat resolves null for a missing key, files.get and api.fetch return Response, sqlite.applyIf resolves applied:false on conflict, and analytics is not a svc broker. A svc 404 can mean the service is off or the tile is unpublished; 410 means the tile has expired.

For retryable work, use tile.retry(fn) instead of a handwritten retry loop: by default it retries 503 and network errors with backoff and never 429 or another 4xx. Retry reads or operations safe to repeat; a lost write response may mean the write already committed, so do not automatically replay non-idempotent writes. tile.cached(key, fn, { staleTime }) takes an array key and dedupes concurrent calls in memory; call tile.cache.invalidate(key) after a write, which also invalidates longer keys sharing that prefix.

## Foundation verification

- Tier and audience are explicit.
- Public HTML contains no svc integration and no tile.me() or tile.role().
- SDK loads from /vendor/tile.js regardless of tier; available capabilities still depend on the tier.
- No slug, credential, token, or arbitrary upstream URL is embedded.
- Hosted management API reads are limited to the three documented analytics GET endpoints in [Teams and analytics dashboards](teams-analytics.md); other management routes stay outside hosted tile code.
- Every SDK promise is awaited or caught; synchronous return values and async iterators are used according to their contract.
- Application writes require an explicit action and are blocked in edit mode.
- Bundled assets use relative paths, untrusted content is rendered safely, and CSV exports neutralize formula cells.
- Retries use tile.retry or are absent; 429 is never retried.
- Every SDK integration satisfies the visible service status contract and applicable SDK outcome checks on initial load, later failures, and recovery; optional services retain a usable fallback.
- Failure paths are exercised; best-effort/unconfirmed outcomes and SDK observability limits are disclosed instead of claimed as confirmed delivery.
- Existing framework, build, and file structure remain intact.
