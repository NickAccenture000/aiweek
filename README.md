# SkyNet – Stakeholder Message Generator (hackathon v1)

During an incident the SMC operator has to tell ATCO supervisors, engineering and (for major incidents) management what is affected, degraded and still working, in German, French and English. This single-page app builds those messages from the incident record, proves that no message contradicts the record or another language version, and leaves the decision to send with the SMC operator.

**Drafts are simulated, the checks are live code.** There is no LLM and no backend: the draft text is pre-written in `src/data/drafts.js` and shown after a short fake "Writing drafts… → Checking…" status. Everything that decides whether a message is safe is real code in `src/lib/` (`checks.js`: `values_exact`, `no_free_facts`, `coverage`, `language_parity`, `up_to_date`). Facts only enter a message as `{{tokens}}` that are rendered from the record, and one draft (v2 × Engineering × FR) contains a deliberately planted error that the checks catch and "Use record term" repairs.

## Run

No Node, npm or build step. Plain HTML, CSS and JavaScript.

- **App:** double-click `index.html`. Use the "Demo" box (bottom right) → *Simulate record update* to go v1 → v2 → v3.
- **Tests:** double-click `tests.html`. The tab title and the heading show `PASS 42/42` when everything is green.
- Optional: `powershell -ExecutionPolicy Bypass -File serve.ps1` serves the folder on http://localhost:5173 (used for the in-app browser preview).

## Flow

1. **Inbox (left):** incoming incidents. INC00123 is the live one; the other two are placeholders.
2. **Incident:** the record as a status board, plus *Inform stakeholders* (or *Send update to stakeholders* / *Send resolution notice* after a record change, with a banner of what changed).
3. **Recipients:** who will be contacted, suggested from the role rules. Tick or untick people to add or remove them (carried over to later updates).
4. **Messages:** drafts are generated (Writing drafts… → Checking…), then each role card is expanded and approved on its own. *Send to outbox* is enabled once every role is approved and every check passes or is overridden with a reason.

Demo: *Inform stakeholders* → *Generate messages* → approve ATCO and Engineering → send ("Initial"). Use the Demo box (bottom right) → *Simulate record update*, then *Send update to stakeholders*; press `N` on the failing Engineering FR draft and click *Use record term*; approve and send ("Update 1"). Simulate once more for v3 and send ("Resolved").

## Also in the console

- **Severity** (Major or Minor, following the record) is shown on every incident in the inbox and in the incident header.
- **Delivery:** after sending, each recipient shows Sent, Delivered and Confirmed with times and a "x of y confirmed" count (also in the inbox). Delivery receipts are simulated; use *Mark confirmed* per recipient or the Demo box *Simulate confirmations*.
- **Stakeholders** (left rail): add, edit, deactivate or remove contacts. Changes apply to the recipient suggestions straight away.
- **Operator language** (left rail, EN/DE/FR): language of the review version of each role. If a role has no draft in that language, EN is used.

## Layout

```
index.html, tests.html, styles.css
src/data/   records, inbox, contacts, roleRules, glossary, drafts (JS files that assign to window.SkyNet.data)
src/lib/    recipients, render, checks, diff, label
src/ui/     app.js (state + actions), views.js (HTML views)
tests/      runner.js + *.test.js
```

The spec's React/Vite/Vitest stack was replaced by plain browser JavaScript so the project runs without installing anything; behaviour, data, checks and tests follow the spec.
