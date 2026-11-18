# File storage and saved values

Reference status: manually maintained  
Tile contract checked: 2026-11-06  
Applicable skill version: 0.6.x  
Canonical sources: web/src/sdk/tile.ts, web/src/lib/fileDocs.ts, web/src/lib/sdkDocs.ts, web/src/lib/scanDocs.ts, api/src/files/

Files works on private tiles only and is off on a new tile. A tile admin turns it on when publishing or in Manage → Services. Data stays in Tile's storage and is deleted when the tile is deleted, or when it is swept after its expiry grace period. Disabling the service blocks access but does not delete existing data.

## Choose the store

- tile.files: binary uploads and downloads (images, PDFs), and small JSON documents such as a viewer's saved filters or preferences. A JSON document is a file: put a JSON string with contentType "application/json", read it back with files.get and response.json().
- [SQLite](sqlite.md): structured or shared application data, and anything that needs queries, relationships, or concurrent writers.
- localStorage: device-only UI state such as a theme or a collapsed panel. It stays unencrypted on the viewer's device and every other tile served from the same address can read it, so keep sensitive or shared data in Files or SQLite.
- Intake that every viewer adds and only the owner reads (surveys, feedback, sign-ups) fits neither shared Files nor read-write SQLite: use [SQLite submit-only intake](sqlite-survey.md).

Files defaults to scope: "user", private to the signed-in viewer. scope: "shared" is one namespace every viewer of the tile can read, overwrite, and delete; last write wins. UI-hidden write controls are not authorization. Pass scope exactly: anything other than "shared" is treated as "user".

## Retired key-value store (tile.kv)

Tile's key-value store (tile.kv, svc/kv) was retired and switched off on 2026-11-04; it cannot be turned on. Store values in Files or SQLite instead. When editing a tile that still calls tile.kv, migrate it: per-viewer values become a user-scoped JSON file, shared or structured values become SQLite rows. Its calls now fail: writes and lists throw, and kv.get can resolve null, which reads as "nothing saved", so a tile left on KV silently loses its saved values. Existing KV data is not reachable from the tile; tell the owner that viewers start from defaults after the migration.

## SDK shapes

    await tile.files.put("prefs/filters.json", JSON.stringify(value), {
      scope: "user",
      contentType: "application/json"
    });
    const saved = await tile.files.get("prefs/filters.json", { scope: "user" });
    const value = saved.ok ? await saved.json() : null;  // 404: nothing saved yet, or Files off

    await tile.files.put("reports/q4.pdf", file, {
      scope: "shared",
      contentType: file.type,
      filename: file.name
    });                                                                  // { ok, key, bytes, contentType, filename, etag }
    const { items } = await tile.files.list({ scope: "shared", prefix: "reports/" });
    const meta = await tile.files.stat("reports/q4.pdf", { scope: "shared" }); // or null
    const response = await tile.files.get("reports/q4.pdf", { scope: "shared" });
    const href = tile.files.getUrl("reports/q4.pdf", { scope: "shared" });
    await tile.files.delete("reports/q4.pdf", { scope: "shared" });

files.list items and stat return { key, bytes, contentType, filename, updatedAt, updatedBy }. files.put sends the raw body; do not wrap it in JSON or multipart. contentType defaults to the Blob's own type, then application/octet-stream; filename defaults to the key.

files.get returns the raw Response and never throws on a non-2xx; check response.ok. getBlob throws TileSvcError. getUrl returns a relative svc/files/get URL for an img src, a link, or an embed. PDF, PNG, JPEG, GIF, and WebP are served inline; every other type, SVG included, downloads as an application/octet-stream attachment. stat and list keep the original contentType.

files.stat resolves null, and files.get answers 404, on any 404, so a store that is off for the tile reads as a missing file. Writes and lists on a disabled store throw 404; an app-wide kill switch answers 503.

## Setup and troubleshooting

If files or saved values do not respond, first confirm a private, published tile, then ask the admin to enable Files under Manage → Services. Include this step in the hand-off and show the setup hint on a disabled-service failure instead of only “Save failed”. A null lookup alone does not prove enablement; use a read-only list when that distinction matters, not a test write.

SQLite's “Any viewer can write” setting does not govern Files. Enabled user-scope storage is writable by its viewer; enabled shared scope is writable by every authorized viewer. Do not gate these saves on canWriteSqlite or tell viewers to request SQLite editor access. Use the actual failure status to distinguish disabled storage, quotas, and outages; preserve the unsaved value or selected file.

## Limits

Keys are 1–256 characters without control characters. Default quotas, which an app admin can change app-wide or per tile:

| | Files |
| --- | --- |
| Per file | 25 MiB |
| Per viewer (user scope) | 50 files, 100 MiB |
| Per tile (all scopes) | 1,000 files, 1 GiB |

An app-wide byte cap may also apply. Keep a viewer's saved values in a few fixed JSON files; one file per saved item soon fills the 50-file viewer quota.

413 means the file or request is too large; 429 means a file or byte quota is full. Do not retry either. Keep the tile usable and do not claim a failed save succeeded.

## Implementation example

For per-viewer saved filters plus shared PDFs, read [the storage example](../examples/storage.html).

## Verification

- Private tier and per-tile enablement are explicit; the hand-off and disabled-service UI explain enabling Files under Manage → Services.
- No tile.kv call remains; existing KV usage is migrated to Files or SQLite, and the hand-off says saved values start from defaults.
- File writes are not incorrectly gated on SQLite write permission.
- Data type selects Files, SQLite, or localStorage deliberately.
- Scope matches the intended reader and writer population.
- Shared scope copy states that every viewer can overwrite/delete through the service.
- A null from files.stat or a 404 from files.get is not treated as proof the store is on.
- files.get callers check response.ok.
- Failure leaves in-memory UI state or retryable upload state intact.
- SDK call signatures match this reference.
