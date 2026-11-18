# Access and retention

Reference status: manually maintained  
Tile contract checked: 2026-10-13  
Applicable skill version: 0.6.x  
Canonical sources: api/src/pages/mod.rs, api/src/pages/owner_quota.rs, api/src/slug.rs, api/src/config.rs, api/src/hosting/public.rs, api/src/sharelink/, api/src/pages/link_routes.rs, web/src/manage/AccessCard.svelte, web/src/manage/ShareLinksCard.svelte

## Choose once

The creation tier is immutable:

- Private: SSO at https://tile.accenture.com/view/<slug>/, with all-acn or an email allowlist.
- Public: outside SSO at https://tile.accenture.com/public/<slug>/, either open or protected by expiring share links.

Within private, all-acn and allowlist may change. A mode change across tiers is refused with 409; publishing bakes the serving prefix into the tile's files.

Public email/PIN gates and static public PINs are legacy-only: only tiles that already have one keep it, and Tile refuses them everywhere else. Do not offer them.

Access applies only to a published tile. An unpublished tile's address answers 404 to everyone, admins included; see [Publishing](publishing.md).

## Slugs and public addresses

A slug is 1–63 lowercase letters, digits, and interior hyphens, and is not a reserved word such as api, view, public, admin, or new.

An open public tile's address is its only protection. Tile's publish wizard appends `--` and a random 12-character suffix to public slugs. Creating a public tile whose slug lacks `--` requires an explicit guessable-address acknowledgment, recorded against the creator. A hand-typed `--` satisfies the check without adding entropy, so do not invent one; keep the generated suffix or use share links.

## Administration and expiry

The owner and co-admins manage content and access. Removing a co-admin revokes the tile access tokens that person minted for the tile, and their account tokens lose the tile. App admins can open and manage any tile; every such access is audited.

Private tiles default to 365 days. Public tiles default to, and are capped at, 30 days on create and on each renewal, with no limit on the number of renewals. Expired tiles return 410 during grace (private 30 days, public 7 days), then 404 until deletion. Republish does not renew expiry. Renewing an expired tile counts against its owner's live-tile limit and can be refused with 409 carrying limit and count.

## Team access

For team membership, team-linked viewer/co-admin grants, and analytics dashboards, read [Teams and analytics dashboards](teams-analytics.md). Keep dashboard administration, source-tile links, and the viewer's right to read analytics separate.

## Public share links

Minting the first link arms share_gated. The gate flag, not the number of live links, decides whether the tile is invitation-only.

- A link is shown once, supports multiple redeemers, expires, and can be revoked. Its address is the tile's `url` followed by `redeem?token=<token>`.
- Link life is 24 to 720 hours, clamped to the tile's own expiry; at most ten live links per tile. Over the cap, or on an expired tile, minting answers 409.
- A link may carry an optional password of 6–64 characters, set at mint only and case-sensitive. Redeemers must enter it before they get a session; send it separately from the link.
- Revoking or expiring the last link never opens the tile.
- Reopening requires an explicit `PATCH /api/pages/<slug>` with `{ "share_gated": false }`; on a private tile that field is a 409.
- Redemption removes the token from the address bar and sets a browser session scoped to that tile.
- Revocation blocks new redemption immediately; an issued session may remain valid for up to 24 hours.
- An expired link stays expired; extending only works on a live link.
- Every refusal is the same 403 invitation-only page, so a failed redemption does not say why. Ten failures within a 60-second window refuse that link until the window ends.

Tile admins manage links in Manage → Share links, or through `POST /api/pages/<slug>/links` with `{ hours, label?, password? }` (201 with `token`), `GET` to list, `PATCH …/links/<id>` with `{ hours }` to extend, and `DELETE …/links/<id>` to revoke. An agent with an account token uses the same routes under `/mapi/u/`.

Treat share tokens and passwords as secrets. Do not place them in source, logs, screenshots, or examples.

## Verification

- Tier, audience, administrators, and expiry are explicit.
- A public slug keeps its generated suffix, or the guessable-address risk was acknowledged by a person.
- Public invitation-only tiles have share_gated enabled before content is shared.
- Revoking the last link leaves the tile gated.
- Any access widening is an explicit human decision.
