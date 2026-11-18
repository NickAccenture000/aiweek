> **Stack note:** this repo implements the spec below as plain HTML/CSS/JS (no Node, React, Vite or Vitest). Tests run in the browser via `tests.html`. See README.md.

# Master Prompt – SkyNet Stakeholder Message Generator (Hackathon v1)

> Paste this into Claude Code, or save it as `CLAUDE.md` in the repo root.

## 1. Context

SkyNet manages Swiss airspace. During an incident, the SMC operator has to tell ATCO supervisors, engineering and, for major incidents, management what is affected, what still works, what is degraded and what to expect. They have to do this in German, French and English while the incident record keeps changing. Today this means up to 9 hand-written messages.

Build a **single-page web app** that produces these messages from the incident record. The app must **prove** that no message contradicts the record or another language version, and that **the SMC decides what is sent**.

**Principle:** *Agents write (simulated), code checks (real), the SMC decides.*

There is **no LLM API**. Draft text is pre-written in a content pack and shown after a short simulated "generating" status. **The checks are real code** and must genuinely catch errors.

## 2. Scope

**In scope:** one incident, 3 record versions, recipients from contacts and role rules, drafts per role × language, live checks, per-role approval, outbox, history.

**Out of scope (do not build):** actually sending SMS or email, diagnosis and severity (`major` is an input), shift handover, incident reports, multiple incidents, dark mode, login, a backend, real AI calls, token counters, vector similarity, a "what changed" line inside messages, flags for empty record fields.

Keep it simple. No state library, no router, no backend. Local JSON plus React state.

## 3. Stack and setup

- Node 20, Vite, React 18, TypeScript (`resolveJsonModule: true`)
- Tailwind v4 via `@tailwindcss/vite`
- Vitest (`environment: jsdom`) + React Testing Library + `@testing-library/user-event`

```
src/
  data/        record.v1.json, record.v2.json, record.v3.json,
               contacts.json, roleRules.json, glossary.json, drafts.json
  lib/         recipients.ts, render.ts, checks.ts, diff.ts, label.ts
  components/  RecordPanel, MessagesPanel, RecipientSummary, StatusStrip,
               DraftCard, OverrideDialog, HistoryView
  App.tsx
tests/         *.test.ts(x)
```

**Write the tests for `lib/` first, make them pass, then build the UI.**

## 4. Data

### 4.1 Record fields

| Field | Meaning |
|---|---|
| `affected` | Systems that have failed (status UNAVAILABLE) |
| `degraded` | Systems running at reduced quality (status DEGRADED) |
| `working` | Systems fully operational (status OPERATIONAL) |
| `expected` | Estimated recovery time, local Swiss time, 24h `HH:MM`. `null` only when resolved. |
| `major` | Major-incident flag (input, not decided by us) |
| `resolved` | Incident resolved |

A system appears in **exactly one** of `affected` / `degraded` / `working`.

### 4.2 Record versions (full JSON)

**record.v1.json**
```json
{ "id": "INC00123", "title": "Primary radar failure", "version": 1,
  "major": false, "resolved": false, "updatedAt": "2026-11-20T13:05",
  "affected": ["primary_radar"],
  "degraded": ["surveillance_data"],
  "working": ["voice_comm", "backup_radar", "datalink"],
  "expected": "14:00" }
```

**record.v2.json**
```json
{ "id": "INC00123", "title": "Primary radar failure", "version": 2,
  "major": true, "resolved": false, "updatedAt": "2026-11-20T13:40",
  "affected": ["primary_radar", "datalink"],
  "degraded": ["surveillance_data"],
  "working": ["voice_comm", "backup_radar"],
  "expected": "16:00" }
```

**record.v3.json**
```json
{ "id": "INC00123", "title": "Primary radar failure", "version": 3,
  "major": true, "resolved": true, "updatedAt": "2026-11-20T15:50",
  "affected": [], "degraded": [],
  "working": ["primary_radar", "datalink", "surveillance_data", "voice_comm", "backup_radar"],
  "expected": null }
```

### 4.3 Contacts (`contacts.json`)

`{ "id", "name", "role", "lang", "active" }`

| id | Name | Role | Lang | Active |
|---|---|---|---|---|
| c1 | Anna Müller | ATCO_SUPERVISOR | DE | true |
| c2 | Claire Dubois | ATCO_SUPERVISOR | FR | true |
| c3 | Emma Collins | ATCO_SUPERVISOR | EN | true |
| c4 | Thomas Keller | ENGINEERING | DE | true |
| c5 | Julien Morel | ENGINEERING | FR | true |
| c6 | Sarah Brunner | MANAGEMENT | DE | true |
| c7 | James Carter | MANAGEMENT | EN | true |
| c8 | Marco Rossi | ENGINEERING | DE | false |

### 4.4 Role rules (`roleRules.json`)

| Role | Notified | Required systems (not resolved) | Tone |
|---|---|---|---|
| ATCO_SUPERVISOR | always | affected + degraded + working | Operational impact, what still works |
| ENGINEERING | always | affected + degraded + working | Technical |
| MANAGEMENT | only if `major` | affected + degraded | 1–2 short lines, business impact |

**When not resolved:** every role also requires `{{time:expected}}` and `{{time:next_update}}`.

**When resolved:** every role requires all systems in `working`, and **must not** contain `{{time:expected}}` or `{{time:next_update}}`.

### 4.5 Glossary (`glossary.json`)

| Key | EN | DE | FR |
|---|---|---|---|
| sys.primary_radar | Primary radar | Primärradar | Radar primaire |
| sys.backup_radar | Backup radar | Backup-Radar | Radar de secours |
| sys.surveillance_data | Surveillance data | Überwachungsdaten | Données de surveillance |
| sys.voice_comm | Voice communication | Sprechfunk | Communications vocales |
| sys.datalink | Datalink | Datalink | Liaison de données |
| status.unavailable | UNAVAILABLE | NICHT VERFÜGBAR | HORS SERVICE |
| status.degraded | DEGRADED | EINGESCHRÄNKT | DÉGRADÉ |
| status.operational | OPERATIONAL | IN BETRIEB | OPÉRATIONNEL |
| label.initial | Initial | Erstmeldung | Message initial |
| label.update | Update | Update | Mise à jour |
| label.resolved | Resolved | Behoben | Résolu |
| h.expected | Expected recovery | Erwartete Behebung | Rétablissement prévu |
| h.next_update | Next update by | Nächstes Update bis | Prochaine mise à jour à |

### 4.6 Tokens

Facts appear **only** as tokens. The message uses a **label format, not full sentences**, so French and German grammar can't break.

| Token | Renders as |
|---|---|
| `{{id}}` | `INC00123` |
| `{{label}}` | `Initial` / `Update 2` / `Resolved` (in the target language, see §5 label) |
| `{{fact:<sys>}}` | System name + **its status taken from the record**. EN/DE: `Primary radar: UNAVAILABLE`. FR: `Radar primaire : HORS SERVICE` (space before the colon). |
| `{{h:expected}}` / `{{h:next_update}}` | Heading word from the glossary |
| `{{time:expected}}` | `record.expected` |
| `{{time:next_update}}` | Value from the "Next update by" input in the UI |

Because `{{fact:…}}` takes the status from the record, a draft **cannot** state a wrong status through a token.

### 4.7 Drafts (`drafts.json`)

```json
[{ "recordVersion": 1, "role": "ATCO_SUPERVISOR", "lang": "EN", "template": "..." }]
```

- Each line of the template is either a token line or a short free-text audience line, e.g. *"Apply reduced-capacity procedures."* Free text must **never** name a system or a status.
- **Every role always has an EN draft.** It's the SMC's review version, even when no English recipient exists.
- Write drafts for:
  - v1: ATCO in EN/DE/FR, ENG in EN/DE/FR
  - v2: ATCO in EN/DE/FR, ENG in EN/DE/FR, MGMT in EN/DE
  - v3: same set as v2

Example (v2, ATCO, EN):
```
[{{id}}] {{label}}
{{fact:primary_radar}}
{{fact:datalink}}
{{fact:surveillance_data}}
{{fact:voice_comm}}
{{fact:backup_radar}}
Apply reduced-capacity procedures.
{{h:expected}}: {{time:expected}}
{{h:next_update}}: {{time:next_update}}
```

**Planted error (required):** in `v2 × ENGINEERING × FR`, replace `{{fact:surveillance_data}}` with the free text `Données de surveillance : HORS SERVICE`. The record says DEGRADED. All other drafts must be clean.

## 5. Logic (`src/lib`)

**`recipients.ts`**
- `getRecipients(record, contacts, rules, overrides?)` returns active contacts whose role is notified (MANAGEMENT only if `major`). It applies the SMC's manual adds and removes (`overrides = { added: id[], removed: id[] }`), which **carry over** to later updates.
- `getDraftKeys(recipients)` returns, for each notified role, **EN plus every recipient language** (de-duplicated).
- Expected: v1 gives 6 keys, v2 gives 8 keys.

**`render.ts`**
- `render(template, lang, record, glossary, ctx)` takes `ctx = { label, nextUpdate }`.
- It returns `{ text, segments }`, where `segments: {type: 'text' | 'chip', value, sourceField?}[]` and `sourceField` is e.g. `"degraded"` or `"expected"`.

**`label.ts`**
- If the history is empty: `Initial`.
- Else if `record.resolved`: `Resolved`.
- Else: `Update N`, where N = number of history entries.

**`diff.ts`**
- `diffRecords(lastSent, current)` returns `[{field, from, to}]` for `affected`, `degraded`, `working`, `expected` and `major`.
- A system that moves between lists is reported with its old and new status.

**`checks.ts`**
- `runChecks(draft, enDraftSameRole, record, glossary, role)` returns `[{id, pass, message, fix?}]`.

| Check | Fails when |
|---|---|
| `values_exact` | A `fact` key isn't in the record, a token key isn't in the glossary, or a `time` token appears in a resolved draft |
| `no_free_facts` | A glossary `sys.*` or `status.*` term in **any language** appears in text outside tokens. Matching is case-insensitive and whole-word, longest term first. `fix` replaces the span from the system term to the end of the next status term on the same line (or just the system term if there's no status term) with `{{fact:<key>}}`. |
| `coverage` | A required system or time token for this role and record state is missing |
| `language_parity` | The draft's token multiset ≠ the EN draft of the same role (EN is compared to itself and always passes this check) |
| `up_to_date` | `draft.recordVersion !== record.version` |

**Expected:** the planted draft fails `no_free_facts`, `coverage` **and** `language_parity`. After applying `fix`, it passes all checks.

## 6. UI

### Layout (one screen = the incident view)

**Left:** the record. Every value is a chip. Values changed since the last sent message are highlighted with "was …".

**Right:** the **Stakeholder messages** panel, from top to bottom:
1. **Header:** the label ("Initial" / "Update N" / "Resolved"). If something changed since the last sent message, a banner lists the changes from `diff.ts`.
2. **Recipient summary:** e.g. "7 recipients · Management added". Click to expand the list, with checkboxes to add or remove people.
3. **Status strip:** e.g. "✅ 7 ready · ❌ 1 needs you", a **Next issue (N)** button, and a compact role × language mini-grid.
4. **One card per role, collapsed by default.**
   - Expanded, it shows the **EN** review version with chips.
   - Below that, each other language appears as "DE ✅ same facts" or "FR ❌ 3 issues", and can be expanded to view the text.
   - A failing language shows the check messages and **Use record term** (if a `fix` exists), **Edit** and **Override…**.
   - The card shows "EN · review only" if nobody receives English.
5. **Footer:** a "Next update by" time input (default: now + 30 min, hidden when resolved) and **one primary button** for the current state.

### Rules

| Topic | Rule |
|---|---|
| Approve | One **Approve** button per role card. It's disabled until the card has been expanded once. Approving a role covers all its languages. |
| Send to outbox | Enabled only when every role is approved, every draft passes or is overridden, no draft is outdated, and "Next update by" is set (unless resolved) |
| Primary button | "Fix N issues" (jumps to the first issue) → "Approve remaining roles" (jumps to the first unapproved role) → "Send to outbox" |
| Override | A dialog requires a reason of at least 10 characters. It applies to that draft's failing checks and is logged. |
| Edit | A textarea over the raw template, with a hint: *"Facts are locked as {{…}} tokens. Edit wording only."* Saving re-runs the checks. Edits apply to that language only. |
| Use record term | Applies `fix` and re-runs the checks |
| Generating | One status line, "Writing drafts… → Checking…", lasting about 2 s in total |
| Record update | If nothing is expanded, approved, edited or overridden: regenerate automatically. Otherwise show a banner, mark drafts outdated, disable Send, and show **Regenerate drafts**. Regenerating resets approvals, edits and overrides. |
| Outbox / history | Each send adds an entry with: label, time, record version, approver "SMC operator", overrides with reasons, and a list of **recipient → rendered message in their language**. EN review-only drafts aren't sent. The last-sent version moves to this record. |
| Demo control | A small "Demo" box in the bottom-right with **Simulate record update** (v1 → v2 → v3) |
| Keyboard | `N` jumps to the next issue. No keyboard shortcut for sending. |
| Style | Clean and neutral, large readable type. Status always shown as colour + icon + word. |

## 7. Demo script (build exactly this)

1. **v1 loads.** Drafts are generated for 6 drafts and 5 recipients, all ✅. Expand and approve ATCO and ENG, then **Send to outbox**. "Initial" is added to the history.
2. **Simulate record update.** The banner shows: expected 14:00 → 16:00, datalink operational → unavailable, now major. Management is added (7 recipients).
3. **Drafts are generated.** The strip shows "✅ 7 ready · ❌ 1 needs you". Press **N**: ENG FR shows "Données de surveillance : HORS SERVICE is not a record term". Click **Use record term** and it turns ✅.
4. Approve all three roles and send. "Update 1" is added to the history.
5. **Simulate record update** to v3. Approve the roles, send, and "Resolved" is added to the history. There's no "Next update by" field.

## 8. Tests (Vitest; all must pass)

**`recipients.test.ts`**
- v1 has 5 recipients and 6 draft keys, including ENG EN as review-only.
- v2 has 7 recipients and 8 draft keys.
- Marco Rossi (inactive) is never included.
- A manually removed contact stays removed after the update to v2.

**`render.test.ts`**
- `{{fact:surveillance_data}}` renders as `Données de surveillance : DÉGRADÉ` in FR (v2) and `Überwachungsdaten: EINGESCHRÄNKT` in DE.
- The same token in v3 renders as OPERATIONAL.
- Chips carry the correct `sourceField`.
- The label renders as Initial / Update 1 / Resolved.

**`checks.test.ts`**
- **Zero-contradiction proof:** loop over every draft in `drafts.json` against its own record version. All pass, **except** the planted v2 ENG FR draft, which is the only failing draft.
- The planted draft fails `no_free_facts`, `coverage` and `language_parity`. After `fix`, it passes all checks.
- A `{{fact:radar_x}}` token that isn't in the record fails `values_exact`.
- Removing a token from a DE draft fails `language_parity`.
- Removing a required system from both EN and DE fails `coverage` for both.
- A v3 draft containing `{{time:expected}}` fails `values_exact`.
- A v1 draft checked against the v2 record fails `up_to_date`.

**`diff.test.ts`**
- v1 → v2 reports `expected` 14:00 → 16:00, `major` false → true, and datalink working → affected.

**`App.test.tsx`** (React Testing Library, fake timers)
- Approve is disabled until the card is expanded.
- Send is disabled while a check fails. It becomes enabled after an override with a reason of at least 10 characters (and is still blocked if the reason is shorter).
- **Full demo path:** v1 send → update → fix the FR issue → send → v3 → send. The history shows Initial, Update 1 and Resolved.
- An update mid-review shows the banner and disables Send. **Regenerate** resets approvals and overrides.
- The history entry has no message for an EN review-only draft.

## 9. Done when

- `npm test` is green and `npm run dev` runs the demo script without errors.
- No fact appears as free text in any draft except the planted error.
- The README explains in one paragraph that **drafts are simulated and the checks are live code**.
