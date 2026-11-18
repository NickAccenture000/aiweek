# Engagement analytics

Reference status: manually maintained  
Tile contract checked: 2026-10-13  
Applicable skill version: 0.6.x  
Canonical sources: web/src/lib/analyticsDocs.ts, web/src/sdk/analytics/, api/src/analytics/, api/src/upload.rs

## Use it for

Aggregate measurement of attention, depth, section reach, and meaningful actions on private and public tiles. It never identifies who clicked, and it never changes how the tile behaves. It is the only tile.* facade that works on a public tile; load /vendor/tile.js as described in [Foundations](foundations.md) for either tier.

## Reading analytics and building dashboards

This reference covers collecting events. To display existing team or per-tile analytics, compare editions, configure team links, or diagnose a dashboard access failure, read [Teams and analytics dashboards](teams-analytics.md). The dashboard uses documented same-origin GET endpoints, not the event-collection SDK.

## Instrument in this order

1. Inventory links, buttons, form controls, and programmatic actions.
2. Classify meaningful actions by business intent:
   - engagement: reading, exploring, sharing, or playing content;
   - activation: registering, booking, contacting, applying, or starting the next step;
   - intentionally unmeasured: ordinary navigation or utility controls with no reporting value.
3. Choose stable labels before editing. They match ^[a-z0-9][a-z0-9._-]{0,63}$ and remain stable across editions. Exclude names, emails, clients, matter numbers, URLs, dates, DOM positions, and display copy.
4. Load the SDK and call tile.analytics.start() once, from the tile's own inline script. Loading the script alone collects nothing.
5. Instrument important controls with tile-cta or both data-tile-cta and data-tile-goal. Use tile.analytics.track for an action with no suitable clickable element.
6. Put data-tile-section on programme-level sections only. After inserting new sections, call the controller's refreshSections().
7. During development, run tile.analytics.audit() in the console and account for every row.

## Click behavior

| Control without explicit tagging | Result |
| --- | --- |
| http/https anchor outside this tile, another tile included | outbound engagement |
| mailto or tel anchor | outbound activation |
| Anchor within this tile, fragment, javascript:, data:, or blob: | unmeasured |
| Button, role button, JS control | unmeasured |

Automatic capture sends no URL or DOM text. Explicitly tag important links that need stable labels.

Both manual attributes are required. A data-tile-cta without a valid data-tile-goal records nothing; it never falls back to automatic capture. Put them on the anchor itself, not on a wrapper around an anchor.

Preferred markup:

    <tile-cta label="register-workshop" goal="activation">
      <button type="button">Register</button>
    </tile-cta>

The component, defined by start(), places the attributes on a wrapped anchor itself and is display: contents. A missing or invalid label or goal is refused in the console and records nothing; it never defaults the goal or derives a label from text. For a non-click action:

    tile.analytics.track("demo-completed", { goal: "engagement" });

track(label, { goal, outbound? }) throws a TypeError for an invalid label or goal; that is an authoring error to fix, not to catch. A track() before start() records nothing.

## Controller and audit

start() returns { flush(), stop(), refreshSections() }. It is synchronous and idempotent per document: a second call returns the same controller, and a call after stop() returns the stopped one. stop() is permanent for the document. Never call start() from a render loop or an effect that re-runs.

audit() returns rows of { reason, text, html, element } with reason "untagged", "invalid-label", or "invalid-goal", and prints a console table. It sends nothing and works before start(). Internal links appear as untagged; leave them when intentionally unmeasured.

## Limits and fixed semantics

- At most 64 distinct labels per tile for its whole life; CTA, track, and section labels share the cap. A tile re-created at the same slug starts a new count. A batch adding a 65th label is dropped (HTTP 422) and the rest keeps reporting.
- Only the published root index.html carries the instance marker. start() on any other HTML document in the bundle, or on a workspace draft, measures nothing and warns.
- Capture is silent inside Tile's editor, so editing never inflates the counters.
- At most 20 distinct sections are observed per document; extra or invalid section labels are ignored without an error.
- Active time stops 10 minutes after the last trusted interaction and credits at most 2 minutes past it; hidden-tab time and dispatched events never count. Depth milestones are 30, 60, and 180 seconds of active time. None of these is configurable.
- Per tile, at most 100,000 events are accepted per UTC day; an exhausted cap stops collection for that document.
- Telemetry is aggregate, quota-bound, and lossy under failure or tab close. It stores nothing in cookies, web storage, IndexedDB, or the URL; a document open longer than 24 hours stops reporting.

The SDK posts to _tile/analytics/start and _tile/analytics/events relative to the tile. Never call them directly.

## Failure behavior

Analytics can be disabled per tile (Manage → Analytics) or app-wide; both routes then answer 204 and record nothing. Failures never throw into tile code. Network loss, rejected batches, blocked JavaScript, or a lost close beacon must leave the tile fully usable. Never delay navigation, claim exact delivery, or present aggregate click totals as person-level conversion.

Apply the [SDK outcome checks](foundations.md#sdk-outcome-checks) without inventing delivery guarantees: start(), track(), and flush() provide no per-event delivery acknowledgment or SDK health probe. Use non-blocking operator-facing status to describe analytics as best-effort/unconfirmed and surface known configuration or instrumentation problems. audit() finds markup gaps, not network delivery failures. Validate reporting during verification, but a previously reported event does not prove the next one arrived; disclose this observability limit in the hand-off.

## Implementation example

When implementing or reviewing instrumentation, read [the complete analytics example](../examples/analytics.html).

## Verification

- tile.analytics.start() appears once after the SDK is available.
- Every meaningful control is tagged or explicitly classified as intentionally unmeasured.
- Every explicit CTA carries both the label and goal.
- Labels pass the pattern and contain no free text or sensitive identifiers.
- Programme sections, not every card, carry data-tile-section.
- Dynamic section insertion calls refreshSections().
- tile.analytics.audit() returns no accidental gaps.
- Navigation and core behavior work when measurement is unavailable.
- Operator-facing status and the hand-off describe best-effort/unconfirmed delivery; audit or successful local calls are not presented as server acknowledgments.
