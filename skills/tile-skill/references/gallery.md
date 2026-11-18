# Gallery

Reference status: manually maintained  
Tile contract checked: 2026-10-13  
Applicable skill version: 0.6.x  
Canonical sources: api/src/gallery/, api/src/preview/, api/src/pages/preview_routes.rs, web/src/manage/GalleryCard.svelte, web/src/manage/PreviewCard.svelte

## Eligibility

A tile appears only while all are true: the author enabled listing, an app admin has not blocked it, mode is all-acn, it is unexpired, and it is published. Re-check the existing tile before proposing Gallery changes. Enabling listing on a tile that is not all-acn is 409.

If a tile is allowlisted or public, report the blocker. Do not widen access automatically or invent a personalized Gallery mode. If it is unpublished, listing has no effect until someone publishes it (see [Publishing](publishing.md)).

## Author choices

Listing, blocking, and downloadable bundle are separate flags; the author sets `gallery_enabled`, `gallery_description`, `gallery_tags`, and `gallery_downloadable` on the tile, and blocking is the app admin's. Listing publishes the title, description, tags, owner email, and derived owner name to signed-in colleagues. The wall shows the first lines of the description; the entry's detail panel shows all of it. Download opt-in lets any signed-in colleague keep a ZIP of the published bundle, with publish-time path rewrites undone so it runs locally; a copy cannot be recalled, and bundles over 64 MiB cannot be downloaded (413).

Tags come from the admin vocabulary; use no free-text substitute. A tile may use up to four active tags and a description up to 2,000 characters; an unknown or archived tag is 400.

Automatic previews are rendered from the bundle's own HTML and CSS by an engine that executes no JavaScript, with no viewer identity, no `svc/*` routes, and no external network access: any resource outside the bundle loads as empty. A client-rendered or data-driven tile therefore previews as its static shell. Offer a custom PNG, JPEG, or WebP preview (up to 10 MiB) for such tiles; Retry re-renders an automatic preview but not a custom one (400). Upload a custom preview only after listing is on and the tile is published: an unpublished tile refuses it (409), and an unlisted tile accepts it and discards it. A person's republish of a listed tile renders a new automatic preview in place of a custom one, so upload the custom image again afterwards.

## Verification

- The tile is private, all-acn, unexpired, and published.
- Author understands identity disclosure.
- Listing and download decisions are explicit and separate.
- Script-rendered tiles have a custom preview image or accept a static-shell preview.
- A block, opt-out, ACL narrowing, expiry, or unpublish removes listing, detail, preview, and Gallery download together.
