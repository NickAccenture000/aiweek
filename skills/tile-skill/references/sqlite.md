# SQLite

Reference status: manually maintained  
Tile contract checked: 2026-11-06  
Applicable skill version: 0.6.x  
Canonical sources: web/src/sdk/tile.ts, web/src/lib/sqliteDocs.ts, web/src/lib/patDocs.ts, api/src/sqlite/, api/src/me/mod.rs, api/src/auth.rs, api/src/pages/mod.rs

SQLite works on private tiles only and is off by default on new tiles: a tile admin turns it on when publishing or later in Manage → Services → Database (SQLite). Until then every call answers 404. Outside submit-only mode, every authorized viewer can read every table. Writes are allowed to tile admins and named SQLite editors (write mode "editors", the default), or to every viewer when a tile admin chooses the "all-viewers" write mode. A third mode, "Viewers can only submit", lets every other viewer add rows to chosen tables and read nothing; read [SQLite submit-only intake](sqlite-survey.md) for surveys, feedback, sign-ups, polls, and any tile where everyone submits and only the owner reads. App admins have no write override.

Use (await tile.role()).canWriteSqlite to present editing controls and recheck it before each write action, including schema setup. It already reflects whether SQLite is on for the tile and app-wide. The server remains the authorization boundary; handle refusal even after a successful probe. Rows some viewers must not read belong in submit-only mode ([SQLite submit-only intake](sqlite-survey.md)) or a separately allowlisted tile; every other mode shows every row to every viewer. (await tile.role()).sqliteAccess reports "read-write", "read-only", "submit-only", or null; submit-only respondents read canWriteSqlite false.

## Setup and troubleshooting

Keep setup guidance visible in static HTML and include it in the hand-off:

- Database calls do not respond: first confirm a private, published tile, then ask the admin to enable Manage → Services → Database (SQLite). Use the error status to distinguish disabled SQLite from a temporary outage.
- Colleagues can read but cannot save: by default only tile admins and named SQLite editors may write. Ask the admin to add the intended editors or, only if every viewer should write, choose Manage → Services → Any viewer can write (under Write access, the all-viewers mode). Check (await tile.role()).canWriteSqlite and retain the draft on refusal.

Do not prescribe broader permissions as the default fix: canWriteSqlite can also be false because SQLite is disabled. This write-access setting applies to SQLite, not Files.

Follow the [visible service status](foundations.md#visible-service-status) contract. Render a database status such as “Checking database…”, “Database ready”, “Database ready — read-only”, or “Database unavailable” next to the data controls. Use the initial sqlite_master read (or another real read) to establish availability; canWriteSqlite alone is not a connection check. A reachable database with a missing table needs an initialization state, not a connection-failure state. Surface 404/setup, 503/network, and later refresh failures visibly with the appropriate recovery guidance; never render a failed read as an empty issue list.

## Rules

- Await every SQLite promise and handle its failure. watch() is synchronous and returns its cleanup function.
- Run writes from an explicit button or form submission, not from page load, keystrokes, or timers. Schema initialization is a write: offer a writer-only “Initialize database” action when the table is missing. Check window.__PAGES_EDIT__ and a fresh role before any write action; the editor must not seed, initialize, or save application data.
- Any successful write statement bumps the revision and republishes the whole database, even when it changes nothing (CREATE TABLE IF NOT EXISTS on an existing table, an UPDATE matching no rows). Read sqlite_master to detect a missing schema, then use CREATE TABLE IF NOT EXISTS only in the explicit initialization action; a reader's CREATE is refused even when the table exists.
- Bind user input through ? arguments; never interpolate SQL.
- Calls are stateless. BEGIN in one call and COMMIT in another do not form a transaction.
- tile.sqlite.batch() runs statements in order in one round trip, and other writers cannot interleave. The first failing statement stops the rest and batch() throws its error. Wrap the list in "BEGIN" … "COMMIT" for all-or-nothing: a failure then skips the COMMIT and Tile rolls the transaction back, so nothing is kept. A pipeline that ends inside an open transaction is always rolled back.
- Use a row revision plus tile.sqlite.applyIf() for human edits. applied:false is a conflict to reload and re-present; it is not blindly retried.
- tile.sqlite.rev() resolves { rev, bytes, updatedAt }. rev is a database-wide change counter, not a row version; polling it runs no query.
- tile.sqlite.watch(callback, { pollMs?, signal? }) calls back with the new revision number only, and only on a change; the callback re-runs its own query and catches its own errors. The live feed is off unless the operator enables it and is capped per tile, so expect watch() to poll rev() (every 5 seconds by default) while it keeps retrying the feed. Keep its stop function.
- ATTACH, DETACH, and VACUUM are refused for every caller. Tile maintains the database itself: writes keep query statistics current, and databases Tile creates reclaim deleted rows' space automatically, so deleting rows returns quota.
- Give every table an `id INTEGER PRIMARY KEY` column and never store rowid values: compacting can renumber implicit rowids.

## Errors

SQL errors and refused statements throw tile.TileSvcError with status 400; a write from a viewer without write access reads "write access denied: this tile's database is read-only for you". 413 is either a full database ("SQLite DB quota exceeded"; every write in that call is discarded) or a request body over 1 MiB ("request body too large"); preserve the user's draft and chunk large imports. 404 means SQLite is off for the tile; 503 means it is temporarily unavailable. In submit-only mode a respondent's execute(), batch(), and applyIf() throw tile.TileSqliteError with code SUBMIT_ONLY (403); the submit codes are in [SQLite submit-only intake](sqlite-survey.md#errors). The deployed database quota is 100 MiB per tile; an app admin can raise it per tile.

## SDK shapes

    const result = await tile.sqlite.execute(
      "SELECT id, title, row_version FROM issue WHERE status = ? ORDER BY id",
      ["open"]
    );

    const results = await tile.sqlite.batch([
      "BEGIN",
      { sql: "INSERT INTO issue (title) VALUES (?)", args: [title] },
      { sql: "UPDATE counter SET n = n + 1 WHERE name = ?", args: ["issues"] },
      "COMMIT"
    ]);

    const update = await tile.sqlite.applyIf(
      "UPDATE issue SET title = ?, row_version = row_version + 1 WHERE id = ? AND row_version = ?",
      [title, id, seenVersion]
    );

execute() resolves { columns, rows, rowsAffected, lastInsertRowid, rev }; rows are objects keyed by column name, lastInsertRowid is a string or null, and rev is the database revision after the call. batch() resolves one such result per statement. applyIf() resolves { applied, rowsAffected, rev }. Integers come back as numbers and blobs as Uint8Array.

The endpoint is Hrana v2 at svc/sqlite/v2/pipeline; @libsql/client/web pointed at new URL("svc/sqlite", document.baseURI).href also works, but pipelines must be close-terminated and interactive (baton) transactions are refused. Prefer tile.sqlite.

## Bring your own database

A tile admin can upload, download, or delete the whole .sqlite file on the Database (SQLite) row in Manage. CI can do the same with a tile access token or an account token (see [Automation](automation.md)). An upload replaces the database in full; a delete keeps SQLite on and the next write starts an empty database. Both bump the revision. The database is deleted with the tile; disabling SQLite stops serving it without deleting it.

The same row shows Database health (size, free space, tables without an `INTEGER PRIMARY KEY`, large tables without an index) and a Compact action. Compact rewrites the file to reclaim free space and switches an older or uploaded database to automatic reclaiming; it answers 409 listing the tables whose rowids would change unless that is accepted. Uploaded databases are stored as validated, not maintained, so compact one once after uploading if it has free space.

## Rows from outside the tile

A pipeline job, n8n workflow, or sync script can read and change rows without a browser session through a tile access token with the `data:rows` scope, at `POST https://tile.accenture.com/mapi/v1/pages/<slug>/sqlite/pipeline`. It speaks the same Hrana v2 pipeline, is limited to SELECT, INSERT, UPDATE, and DELETE, and writes as the token rather than as a viewer, so the tile's write mode does not apply. Its writes bump the revision like any other, so `watch()` and `rev()` see them. See [Automation](automation.md) for the request shape and errors.

## Implementation example

For a collaborative issue list, read [the SQLite example](../examples/sqlite-app.html). For a survey, read [the survey example](../examples/survey.html) after [SQLite submit-only intake](sqlite-survey.md).

## Verification

- SQLite enablement is stated as a prerequisite.
- Readers are not promised row or user isolation; confidential intake uses submit-only mode.
- Write UI uses canWriteSqlite and handles server refusal.
- Every write action rechecks canWriteSqlite, skips edit mode, and handles server refusal.
- Schema setup is explicit and writer-only; page load, keystrokes, and timers perform no writes.
- Disabled/read-only states show admin setup guidance without making all-viewer writes the default.
- Database status is visible on startup, failed reads/refreshes, and recovery; unavailable, read-only, missing schema, and a successfully empty result remain distinct.
- All input is bound.
- Multi-statement work that must land together uses one batch wrapped in BEGIN/COMMIT.
- Human edits use a row revision.
- Watch callbacks reload data, catch their errors, and are cleaned up.
