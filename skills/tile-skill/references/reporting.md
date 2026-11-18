# Reporting groups

Reference status: manually maintained  
Tile contract checked: 2026-10-13  
Applicable skill version: 0.6.x  
Canonical sources: api/src/pages/edition_routes.rs, api/src/report/, web/src/manage/EditionCard.svelte, web/src/lib/GroupPicker.svelte

Reporting group is management metadata, never an HTML meta tag, SDK call, or tile access token field.

A tile admin may assign either an active client group or an active industry group whose client group is active. Assignment is optional and must never block publication. Set it in Manage → Engagement tracking; the publish wizard does not ask.

`GET /api/report/groups` lists the active groups with id, label, parent_id, and depth (0 client group, 1 industry group). `POST /api/pages/<slug>/edition` with `{ "group_id": "<id>" }` assigns or replaces it (201); send only group_id. An unknown or archived group, or one under an archived client group, is a 400. `GET` on the same route reads `{ edition }` (null when unset) and `DELETE` clears it.

Republishing content does not change the assignment. A tile access token has no route to write it; an account token can, through the same route under `/mapi/u/`. The assignment belongs to this tile instance, so a deleted tile whose slug is reused starts unassigned. If a group is archived, the historical assignment remains visible but a new assignment must select an active group.

For grouping and filtering analytics by these fields, read [Teams and analytics dashboards](teams-analytics.md); reporting metadata alone grants no access.

Verification: no bundle markup declares the group, no PAT recipe changes it, and publish remains successful if the optional assignment fails.
