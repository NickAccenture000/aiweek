# SQLite submit-only intake (surveys and forms)

Reference status: manually maintained  
Tile contract checked: 2026-11-06  
Applicable skill version: 0.6.x  
Canonical sources: web/src/sdk/tile.ts, web/src/sdk/errors.ts, web/src/lib/sqliteDocs.ts, api/src/sqlite/broker.rs, api/src/sqlite/submit.rs, api/src/me/mod.rs, web/src/manage/services/SqliteServiceRow.svelte

Read [SQLite](sqlite.md) first; this reference covers the **submit-only** write mode. It is the mode for **intake**: every viewer adds rows and only the tile's admins and SQLite editors read them. Surveys, feedback forms, sign-up sheets, polls and votes, RSVPs, idea boxes, and nominations are intake.

## Choose the mode

| Tile shape | Database (SQLite) write mode |
| --- | --- |
| Intake: everyone adds, only the owner reads | "Viewers can only submit" (this reference) |
| Shared or collaborative data every viewer may read and change | "Any viewer can write" ([SQLite](sqlite.md)) |
| Read-mostly data maintained by a few people | "Only editors can write", the default ([SQLite](sqlite.md)) |
| Intake on a public tile, or anonymous intake | Unsupported. Say so before building. |

Submit-only exists on private tiles only. A public tile has no database, and Tile records who submitted. When a request needs public or truly anonymous intake, state that Tile does not support it and offer a private submit-only tile that is at most "anonymous to the owner" (see [Anonymity](#anonymity-and-residuals)). Do not approximate confidential intake with "Any viewer can write" plus a hidden results view, a shared Files namespace, an API-broker relay, or a public tile posting to a private one: each lets respondents read or overwrite each other's answers, or has no supported route.

Respondents cannot edit or withdraw an answer. With `UNIQUE (tile_submitted_by)` a second submit is refused. A correction is a request to the owner, who can change the row through SQL.

## Availability

Submit-only ships in newer Tile releases. On a release without it, `(await tile.role())` has no `sqliteAccess` field (`undefined`, while a release with it reports `null` when SQLite is off) and `tile.sqlite.submit` is not a function. On such a release, keep the form closed and show that confidential intake is unavailable; never fall back to "Any viewer can write", which lets every respondent read every answer.

## Server enforcement

`tile.role()` resolves `sqliteAccess` as `"read-write"`, `"read-only"`, `"submit-only"`, or `null` (SQLite off for the tile or app-wide). In submit-only mode:

- Tile admins (including members of a team linked with Full co-admin) and named SQLite editors are `"read-write"`. They keep the full pipeline (`execute`, `batch`, `applyIf`, `rev`, `watch`), and `tile.sqlite.submit()` answers 404 for them, so test the form from a colleague's account.
- Every other viewer is `"submit-only"`. `execute()`, `batch()`, and `applyIf()` throw 403 `SUBMIT_ONLY`; `rev()` and `watch()` answer 404 because both would reveal when others answer, and a feed opened before the switch closes. Their one call is `tile.sqlite.submit(table, values)`.
- A successful submit resolves `undefined`: no rowid, revision, or count, so a respondent cannot count or time other respondents. Never show "you are respondent #n".

The protection is the server's refusal, not the page. Hiding the results view from respondents is presentation only; a page that filters rows by email in JavaScript protects nothing.

## Owner setup

Put these steps in the hand-off and as static guidance in the tile:

1. Publish the tile as private (All of Accenture or specific people).
2. Enable Manage → Services → Database (SQLite).
3. Open the tile as a tile admin and run its explicit "Create survey table" action, which runs `CREATE TABLE IF NOT EXISTS`. The table picker in step 4 lists only tables that already exist.
4. In Manage → Services → Database (SQLite) → Write access, choose "Viewers can only submit", tick the intake tables, and choose Save write access. A greyed-out table names the unique index that blocks it (see the schema rules).
5. Test the form from a colleague's account.

Switching into submit-only does not take back rows viewers already read. Switching out of it makes every submitted row readable to every viewer at once. Under "Any viewer can write", every viewer is `"read-write"` and the page shows them the results view; the page cannot tell the modes apart for an admin, so the setting is the protection.

## Schema rules

- **Stamps.** Optional columns `tile_submitted_by` (the respondent's lowercased sign-in email) and `tile_submitted_at` (server UTC ISO-8601 time) are filled by the server when the table has them. A respondent cannot supply them.
- **One answer each.** `UNIQUE (tile_submitted_by)` means one answer per person; a repeat throws `ALREADY_SUBMITTED` and the first row stays. `UNIQUE (tile_submitted_by, item_id)` means one answer per person per item. Any `ON CONFLICT REPLACE` or `IGNORE` clause is overridden: a repeat is always refused.
- **Every unique index includes the stamp.** That covers `UNIQUE` constraints, `CREATE UNIQUE INDEX` (partial ones too), and a non-rowid or composite `PRIMARY KEY`. One without a real, non-generated `tile_submitted_by` makes the whole table not submittable (409 `SUBMIT_UNIQUE`), because it would let respondents probe others' values through conflict errors. A rowid table's `id INTEGER PRIMARY KEY` needs no stamp.
- **Server-owned columns.** Respondents cannot set the primary key, generated columns, or the stamps (`SUBMIT_COLUMN`). Use `id INTEGER PRIMARY KEY`, as in [SQLite](sqlite.md).
- **Scalar values.** Values are strings, numbers, booleans (stored as 0/1), or null. `JSON.stringify` arrays and objects into a TEXT column; a nested value is `SUBMIT_INVALID`.
- **Validation lives in the schema.** `NOT NULL` and `CHECK` constraints refuse a bad row with `CONSTRAINT` and SQLite's message; mirror them in the form so respondents rarely meet them.
- **Foreign keys.** A foreign key to a questions or items table works, but a `CONSTRAINT` refusal tells a respondent whether that parent row exists, so reference only rows the form shows anyway. Respondents cannot read the parent table: put question text in static HTML.
- **Triggers.** Owner triggers run on every submit. A trigger that copies answers into another table's unique column, or fails depending on other rows, leaks answers. A unique violation inside a trigger reads as `ALREADY_SUBMITTED`. Keep triggers off intake tables.
- **Size and rate.** A submit body is at most 64 KiB (`SUBMIT_TOO_LARGE`). Each viewer may submit 30 times an hour per tile by default (`SUBMIT_THROTTLED`); refused attempts count too. Every submit republishes the database, so keep intake databases small.

## SDK shape

    const { sqliteAccess } = await tile.role();
    await tile.sqlite.submit("answers", {
      score: 4,
      areas: JSON.stringify(["delivery", "teamwork"]),
      comment: null
    }); // resolves undefined; you send no SQL

## Errors

Coded refusals throw `tile.TileSqliteError`, a `tile.TileSvcError` subclass with a short `.code`, the server's `.error` message, `.column` (set for `SUBMIT_COLUMN`, otherwise null) and `.index` (the blocking index for `SUBMIT_UNIQUE`, otherwise null). Check `error instanceof tile.TileSqliteError` before reading `.code`. Nothing is written for any refusal. Keep the respondent's draft for every outcome except success and `ALREADY_SUBMITTED`.

| Code | Status | Meaning | Tile response |
| --- | --- | --- | --- |
| `ALREADY_SUBMITTED` | 409 | This respondent already answered | Close the form; say the answer is already recorded and cannot be changed |
| `CONSTRAINT` | 400 | `NOT NULL`, `CHECK`, foreign key, or trigger refused the row | Show `error.error`; let the respondent fix the answer |
| `SUBMIT_THROTTLED` | 429 | Per-viewer hourly cap reached | Ask them to try later; never retry automatically |
| `SUBMIT_TOO_LARGE` | 413 | Body over 64 KiB | Ask them to shorten the answer |
| `SUBMIT_TABLE` | 400 | Table not ticked, missing, or blocked by a trigger | Survey not accepting answers; owner must finish setup |
| `SUBMIT_UNIQUE` | 409 | Unique index `error.index` lacks `tile_submitted_by` | Owner must fix the schema |
| `SUBMIT_COLUMN` | 400 | `error.column` is unknown, a key, generated, or a stamp | Form and table disagree; owner must fix |
| `SUBMIT_INVALID` | 400 | Malformed body or nested value | Form bug; owner must fix |
| `SUBMIT_ONLY` | 403 | SQL from a respondent | Results are for admins and editors only |

A full database is 413 without a code. A plain 404 means SQLite is off, the tile is unpublished, or the viewer is not a respondent (an admin calling submit). A 503 or network failure is an unconfirmed outcome: the row may have landed. With `UNIQUE (tile_submitted_by)` a manual resend is safe, since a landed first attempt turns it into `ALREADY_SUBMITTED`; say so instead of claiming failure.

## Page pattern

Build one private tile that branches on a fresh `sqliteAccess`:

- `"submit-only"`: the form. Question text, labels, and the privacy notice live in static markup so admins can edit them. Recheck `tile.role()` and `window.__PAGES_EDIT__` inside the submit handler, then call `submit()` once per click.
- `"read-write"`: the results view. Detect the table through `sqlite_master`; offer the writer-only "Create survey table" action when it is missing; read summaries and rows with `execute()` or `batch()`; offer a read-only Refresh; chart counts and export CSV with formula neutralization ([Foundations](foundations.md#authoring-safety)). Render every answer with `textContent`: it is other people's input running in the admin's session.
- `"read-only"`: the survey is not open yet (the owner has not switched modes or ticked tables).
- `null`: the database is off; show the Manage → Services → Database (SQLite) step.
- Field missing: the release has no submit-only mode (see [Availability](#availability)).

Follow the [visible service status](foundations.md#visible-service-status) contract: a checking state, then open, closed, not-open-yet, or unavailable; separate action feedback; a Check again action after a failed probe; stale labels on retained results after a failed refresh.

## Similar intake shapes

| Shape | Schema hint |
| --- | --- |
| Feedback box or idea box | No unique index for many entries per person; omit `tile_submitted_by` for "anonymous to the owner" |
| RSVP or sign-up sheet | `UNIQUE (tile_submitted_by)`; capacity checks cannot read other rows, so the owner reviews overflow |
| Vote or poll, one vote each | `UNIQUE (tile_submitted_by)` with a `CHECK` on the option; tallies appear only in the owner view |
| Nominations | `UNIQUE (tile_submitted_by, category)` for one nominee per category |
| Multi-question survey | One row per answer, `question_id` referencing a questions table, `UNIQUE (tile_submitted_by, question_id)`; submit each answer separately or one row with a JSON TEXT column |
| Per-item ratings | `UNIQUE (tile_submitted_by, item_id)`, `CHECK (rating BETWEEN 1 AND 5)` |

A multi-row answer is not atomic: one `submit()` adds one row and spends one unit of the hourly cap, so a refused third answer leaves the first two. Prefer one row per respondent with a JSON TEXT column when answers must land together. Live results for respondents (a public tally) are out of reach: respondents read nothing.

## Anonymity and residuals

Submit-only is confidential, not anonymous. Tile's audit log names every respondent, and Tile app admins can read every database. Omitting `tile_submitted_by` keeps the email out of the table, which makes the survey at most "anonymous to the owner"; without the stamp there is no one-answer-each rule. State this in the tile and the hand-off. The owner controls the page's JavaScript, so respondents trust the owner with their answers as with any tile.

## Implementation example

For a one-answer-each survey with a results view, read [the survey example](../examples/survey.html).

## Verification

- The tile is private, and the hand-off lists the owner setup steps in order, including the colleague-account test.
- Public or anonymous intake is reported as unsupported, not approximated.
- The page branches on `sqliteAccess`, including `null` and a missing field; respondents make no `execute`, `batch`, `rev`, or `watch` calls.
- The schema uses `id INTEGER PRIMARY KEY`, optional stamps, and only unique indexes that include `tile_submitted_by`.
- `submit()` values are scalars, never stamps, keys, or generated columns.
- Every error code, 404, uncoded 413, and 503/network shows visible text; drafts survive; 429 and uncertain outcomes are not retried automatically.
- Table creation is an explicit, writer-only action blocked in edit mode; no write runs on page load.
- Answers render with `textContent`; CSV exports neutralize formula cells.
- Copy promises confidentiality from other respondents, never anonymity.
