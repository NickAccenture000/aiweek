# CLAUDE.md

## Project goal

Build the **SMC stakeholder message generator** for SkyNet (Swiss air traffic control), Graduate Academy AI Week, card 03 · VERSO.

During an incident, the SMC on shift has to inform ATCO supervisors, engineering and (for major incidents only) management, in German, French and English. The tool drafts those messages from the **incident record**, translates them, checks them, and lets the SMC approve each one before a simulated send.

This is the **only** focus. The wider SkyNet case (user manuals, AeroDoc, workforce, shift handover) is background, not scope. Read [context/README.md](context/README.md) first.

## Repository layout

| Path | What it is |
|---|---|
| `index.html` | The generator. One self-contained file: markup, CSS, JS, synthetic data |
| `context/` | Project context, requirements and SkyNet background. `02-requirements-v01.md` is the authority on scope |
| `skills/` | Project copies of the skills this team uses (see below) |
| `CLAUDE.md` | This file |

## Non-negotiable product rules

These come from the requirements. Do not weaken them without an explicit decision from the team.

1. **The incident record is the single source of truth.** It is in English and **read-only** in the UI: it changes only through record updates ("Apply record update" simulates one arriving). Every English bullet cites the record item IDs it is based on. No freehand facts.
2. **Routing:** ATCO supervisors and engineering get a message for every incident. Management is included **only** when severity is `major`. Severity comes from the record; the tool never decides it.
3. **Audience fit:** each record item carries the audiences it is relevant to. A message only uses items tagged for its audience.
4. **Three languages, one meaning.** DE and FR are translated from the approved English master, with the same sections and bullet count. Numbers, times, sector, node and system codes must match exactly. A rule check enforces this.
5. **The SMC decides.** Every message (all three languages, all audiences) is approved **individually**. There is **no approve-all**, and none may be added. Approve stays locked until the message has been on screen long enough to read and every flag is ticked. Blocking issues (stale record, empty bullet, translation from an outdated English text) cannot be overridden.
6. **Prove it.** Each audience card shows its scores side by side: **Retrieval accuracy · EN** (English vs record) and **Translation accuracy · DE / FR** (translation vs English), plus a **View similarity** button that opens the embedding similarity (EN→DE / EN→FR, Tile AI only) in a dialog. Accuracy is the stricter of the rule checks and the AI review; anything below 100% is flagged. Use these labels, never "rules / AI". Approval stores a SHA-256 hash of the exact text; simulated send recomputes and compares it. Every step is in the audit trail.
7. **Record changes:** a record update redrafts only the audiences whose items changed and withdraws their approvals. Unchanged audiences keep their approvals.
8. **Out of scope:** real SMS/email sending, diagnosis and severity assessment, shift handover (card 04), incident reports and closing documentation.

## Technical conventions

- **Single file, no build, no dependencies.** Everything stays inline in `index.html`. No CDN scripts, no web fonts, no frameworks. Tile requires bundled assets.
- **Target platform: a private Tile.** The SDK loads as a classic script from `/vendor/tile.js` exactly as written. No `type="module"`, no top-level `await`. Follow `skills/tile-skill` (read `references/foundations.md`, `ai.md`, `editing.md` before touching SDK code).
- **AI only through `tile.ai`:** `available()`, `object()` for drafts, translations and review, `embed()` for similarity. Never hardcode a model ID or a provider URL. Prefer an EU-resident chat model from `available().models`, otherwise use the tile default. Never auto-retry a 429.
- **Demo mode must keep working.** When the SDK is missing or AI is off, the tool falls back to rule-based English drafts and the bundled reference translations in `SCENARIOS`. Opening `index.html` directly in a browser must give a working demo.
- **Every AI result is validated before it is shown:** schema shape, bullet counts, source IDs. Failures fall back visibly and are logged. No silent fallbacks.
- **Rendering:** build DOM with the `h()` helper and `textContent`. Never `innerHTML` with record, AI or user text. No `eval`.
- **Edit mode:** respect `window.__PAGES_EDIT__`. No AI calls or sends while it is set.
- **Synthetic data only.** Fictional people (initials and surname, role, language), no emails or phone numbers, no real incidents. Tile uploads declare "no personal data".
- **Visible status:** every SDK-dependent feature shows its state in text (checking / ready / demo / failed), never just colour.
- Keep functions small and named by what they do (`generateAudience`, `checksFor`, `simulateSend`). Comment the *why* for non-obvious rules (reading gate timing, hash checks).

## Style rules

**Visual (follow `skills/frontend-design`):**
- Direction: clean and minimal, in the spirit of apple.com. Light grey page (`#f5f5f7`), white rounded cards, generous spacing, one blue for actions, smooth but short transitions. Cut anything that doesn't help the SMC decide.
- **The message is shown exactly as the stakeholder receives it:** one message per audience and language, with the four subsections (Affected, Still works, Degraded, What to expect) as headings inside it. Never split a message into separate boxes. One language at a time, switched with the segmented control.
- Colour carries meaning, nothing else: each subsection has one dot colour (red affected, green still works, orange degraded, blue expect), used identically in the record and the message. Amber = needs your attention, red = blocking or major, green = approved, blue = the next action. Everything else stays neutral grey.
- Verification table and activity log stay collapsed at the bottom. They are for logging, not for the main flow.
- Colours are tokens on `:root`; use them, don't add one-off hex values.
- Type: the system UI stack (SF Pro on Apple, Segoe UI Variable on Windows); mono only for IDs and hashes. System fonts only.
- Record and message text stay short: one line per point where possible.
- Quality floor: works at 390 px wide without page-level horizontal scroll, visible keyboard focus, `prefers-reduced-motion` respected, state always stated in text.
- Charts (the similarity vector spaces) follow the dataviz rules: a fixed colour per language (EN blue, DE orange, FR aqua), a legend, hover/focus tooltip, a table view.

**Copy:**
- Write for the SMC under time pressure: short, plain, active voice, sentence case.
- Buttons say what happens: "Approve", "Simulate send", "Apply record update". An action keeps its name through the flow: Approve → "Approved".
- Times are `HH:MM UTC`. Systems and codes are upper case, as in the record (SKYFORGE, ZRH-E, FDP-ZH-02).
- Errors say what happened and what to do next. No apologies, no vague "something went wrong".
- Never call the simulated send a real send. Always say "simulated".

**Docs and commits:**
- Docs follow `skills/documentation`: write for the reader, most useful information first, link instead of copying.
- Commit messages: imperative subject under 72 characters, body explaining why.

## Skills in this project

Copies live in `skills/` so every teammate works from the same version. Installed copies (`~/.claude/skills`) are what Claude Code actually loads; `skills/` is the shared reference.

| Skill | Use it for |
|---|---|
| `skills/tile-skill` (`/tile-skill`) | Anything touching the Tile SDK, AI calls, publishing the tile, admin setup and the edit-mode hand-off |
| `skills/frontend-design` (`/frontend-design`) | Any new or reshaped UI. Keep the visual direction above unless the team changes it |
| `skills/code-review` (`/code-review`) | Before every merge. Pay particular attention to: escaping of AI and record text, approval-gate bypasses, hash compare at send, SDK error paths |
| `skills/documentation` (`/documentation`) | README, demo script, hand-off and rollout notes |

## Running and checking

- **Local demo:** open `index.html` in Edge or Chrome, or run `serve.ps1` (http://localhost:5173). The top bar says "Demo mode".
- **With AI:** publish `index.html` as a **private** tile. A tile admin then needs: Request AI access (if not yet approved) → app-admin approval → Manage → Services → enable AI and acknowledge provider egress → reload. The top bar then shows "AI on" with call/token/cost counters (input for the tokenomics slide); hover it for the model.
- **Republishing:** `publish.ps1 -Slug <slug>` with `$env:TILE_TOKEN` set to a `content:write` tile access token (Manage → Automation). Never commit the token. Republishing replaces edits saved in Tile's editor.
- **No descriptive filler in the UI.** Status lines appear only when they ask for an action (for example the admin AI setup hint).
- **Similarity** is shown only in the "View similarity" dialog: English and each translation side by side in one shared 2D projection of the embeddings (per-language centred, PCA), with a table view.
- **Before you call a change done:** both incidents load; approve is locked until read; send blocks when text changed after approval; "Apply record update" withdraws only affected approvals; the minor incident has no management group; the browser console shows no errors.
