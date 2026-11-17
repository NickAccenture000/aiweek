# SkyNet – Stakeholder Message Generator (hackathon v1)

During an incident the SMC operator has to tell ATCO supervisors, engineering and (for major incidents) management what is affected, degraded and still working, in German, French and English. This single-page app builds those messages from the incident record, proves that no message contradicts the record or another language version, and leaves the decision to send with the SMC operator.

**Drafts are simulated, the checks are live code.** There is no LLM and no backend: the draft text is pre-written in `src/data/drafts.js` and shown after a short fake "Writing drafts… → Checking…" status. Everything that decides whether a message is safe is real code in `src/lib/` (`checks.js`: `values_exact`, `no_free_facts`, `coverage`, `language_parity`, `up_to_date`). Facts only enter a message as `{{tokens}}` that are rendered from the record, and one draft (v2 × Engineering × FR) contains a deliberately planted error that the checks catch and "Use record term" repairs.

## Run

No Node, npm or build step. Plain HTML, CSS and JavaScript.

- **App:** double-click `index.html`. Use the "Demo" box (bottom right) → *Simulate record update* to go v1 → v2 → v3.
- **Tests:** double-click `tests.html`. The tab title and the heading show `PASS 31/31` when everything is green.
- Optional: `powershell -ExecutionPolicy Bypass -File serve.ps1` serves the folder on http://localhost:5173 (used for the in-app browser preview).

## Demo script

1. v1 loads, 6 drafts for 5 recipients, all ✅. Expand and approve ATCO and Engineering, then *Send to outbox* → "Initial".
2. *Simulate record update*: banner shows expected 14:00 → 16:00, datalink operational → unavailable, now major; Management is added (7 recipients).
3. "✅ 7 ready · ❌ 1 needs you". Press `N`, then *Use record term* on Engineering FR.
4. Approve all three roles, send → "Update 1".
5. *Simulate record update* to v3 (no "Next update by" field), approve, send → "Resolved".

## Layout

```
index.html, tests.html, styles.css
src/data/   records, contacts, roleRules, glossary, drafts (JS files that assign to window.SkyNet.data)
src/lib/    recipients, render, checks, diff, label
src/ui/     app.js (state + actions), views.js (HTML views)
tests/      runner.js + *.test.js
```

The spec's React/Vite/Vitest stack was replaced by plain browser JavaScript so the project runs without installing anything; behaviour, data, checks and tests follow the spec.
