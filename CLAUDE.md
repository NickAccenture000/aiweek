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

1. **The incident record is the single source of truth.** It is in English and **read-only** in the UI: it changes only through record updates ("Apply record update" simulates one arriving). Every English point cites the record item IDs it is based on. The SMC may add points while editing; those cite no record item, are flagged ("Every point comes from the record"), and must be ticked before Approve unlocks.
2. **Routing:** ATCO supervisors and engineering get a message for every incident. Management is included **only** when severity is `major`. Severity comes from the record; the tool never decides it.
3. **Audience fit:** each record item carries the audiences it is relevant to. A message only uses items tagged for its audience.
4. **Three languages, one meaning.** Each audience holds one list of points with the text in all three languages, so the sections and point count are always identical. Drafts start in English from the record; DE and FR are translated from it. **The signed-in SMC's own language is what matters:** when they edit, the change is translated into the other two. With Tile AI that is a real translation. With the local AI, verified text comes first (reference wording, number/code swaps) and the model translates only the rest; those points carry a note ("Machine translations checked") the SMC must tick. Without any AI, only reference wording and number/code swaps carry over; any other new wording shows a placeholder in that language ("Real LLM required → implementation phase", "Echtes LLM erforderlich → Umsetzungsphase", "LLM réel requis → phase de mise en œuvre") (implementation-phase work, as is live translation while typing). Numbers, times, sector, node and system codes must match exactly. A rule check enforces this.
5. **The SMC decides.** The SMC approves the message in **their own language**, for each audience individually. There is **no approve-all**, and none may be added. The other two languages follow the approved text and need no approval; they can be read under "Also sent in". Approve stays locked until the message has been on screen long enough to read and every note is ticked. Blocking issues (stale record, empty point, a placeholder in the SMC's own language) cannot be overridden.
6. **Prove it.** The "i" button next to each audience name opens its scores: **Retrieval accuracy · EN** (English vs record) and **Translation accuracy · DE / FR** (translation vs English). Accuracy is the stricter of the rule checks and the AI review; anything below 100% is flagged on the message and turns the "i" amber. Use these labels, never "rules / AI". Approval stores the exact text; simulated send compares it again and blocks on any difference. Every step is in the activity log with the signed-in SMC profile, and each simulated send keeps the exact text sent in each language (expandable in the log, included in the JSON export).
7. **Record changes:** a record update touches only the audiences whose items changed and withdraws their approvals. Unchanged audiences keep their approvals. **SMC edits survive a record update:** unedited points take the new record wording, edited and added points stay as written, and a note ("Your edits match the current record") flags any edited point whose source item changed.
8. **Stakeholder management** (gear next to Recipients) adds people from the fictional organisation directory `ORG` or removes them. Group, language, channel and role always come from the directory, never typed by hand. Changes last for the session only and are logged.
9. **Out of scope:** real SMS/email sending, diagnosis and severity assessment, shift handover (card 04), incident reports and closing documentation.

## Technical conventions

- **Single file, no build, no dependencies.** Everything stays inline in `index.html`. No CDN scripts, no web fonts, no frameworks. Tile requires bundled assets.
- **Target platform: a private Tile.** The SDK loads as a classic script from `/vendor/tile.js` exactly as written. No `type="module"`, no top-level `await`. Follow `skills/tile-skill` (read `references/foundations.md`, `ai.md`, `editing.md` before touching SDK code).
- **AI only through `tile.ai` on Tile:** `available()`, `object()` for drafts, translations and review. Never hardcode a model ID or a provider URL. Prefer an EU-resident chat model from `available().models`, otherwise use the tile default. Never auto-retry a 429.
- **Local AI (outside Tile only):** when the Tile SDK is not loaded, `LocalAI` in `index.html` talks to Ollama at `http://localhost:11434` with the same `object()` shape, so results go through the same validation. It is never used when the SDK is present. The chat model is picked from what is installed (override with `?model=`). **Locally the model only translates new wording** (SMC edits, added points): English stays the record wording, DE/FR come from the bundled references, and there is no AI review, because with a 3B model no automatic meaning check was reliable (its own review, cross-language embedding similarity and back-translation were each measured and misjudged good and bad translations both ways). The SMC ticks a "Machine translations checked" note instead. Tile AI keeps drafting, translating and reviewing. Calls run one at a time; the timeout starts when a call is sent. Drafts use one schema field per record item, so a model cannot skip or merge items. Answers stream, so while the SMC waits the message placeholder and the Approve hint show the place in the queue, then points done, tokens and seconds (with Tile AI: seconds only).
- **Demo mode must keep working.** When neither Tile AI nor a local LLM is available, the tool falls back to rule-based English drafts and the bundled reference translations in `SCENARIOS`. Opening `index.html` directly in a browser must give a working demo.
- **Every AI result is validated before it is shown:** schema shape, bullet counts, source IDs. Failures fall back visibly and are logged. No silent fallbacks.
- **Rendering:** build DOM with the `h()` helper and `textContent`. Never `innerHTML` with record, AI or user text. No `eval`.
- **Edit mode:** respect `window.__PAGES_EDIT__`. No AI calls or sends while it is set.
- **Synthetic data only.** Stakeholders are fictional (initials and surname, role, language, channel) with no contact details. The SMC sign-in profiles use the team's own names at the team's request, with `@skynet.example` addresses (a reserved domain that never delivers) so the activity log shows who acted. No phone numbers, no real incidents. Tile uploads declare "no personal data".
- **Visible status:** every SDK-dependent feature shows its state in text, never just colour. Each message's note says where its text came from (record, reference translation, Tile AI or local AI, your edit). The footer shows AI usage counters only while AI is on; without AI it stays empty, by team decision.
- Keep functions small and named by what they do (`generateAudience`, `checksFor`, `simulateSend`). Comment the *why* for non-obvious rules (reading gate timing, the text compare at send).

## Style rules

**Visual (follow `skills/frontend-design`):**
- Direction: clean and minimal, in the spirit of apple.com. Light grey page (`#f5f5f7`), white rounded cards, generous spacing, one blue for actions, smooth but short transitions. Cut anything that doesn't help the SMC decide.
- **The message is shown exactly as the stakeholder receives it:** one message per audience and language, with the four subsections (Affected, Still works, Degraded, What to expect) as headings inside it. Never split a message into separate boxes. The SMC sees their own language on the card; the other two open read-only, one at a time, from "Also sent in".
- Colour carries meaning, nothing else: each subsection has one dot colour (red affected, green still works, orange degraded, blue expect), used identically in the record and the message. Amber = needs your attention, red = blocking or major, green = approved, blue = the next action. Everything else stays neutral grey.
- Verification (the record → English → DE/FR flow) and the activity log stay collapsed at the bottom. They are for logging, not for the main flow.
- Colours are tokens on `:root`; use them, don't add one-off hex values.
- Type: the system UI stack (SF Pro on Apple, Segoe UI Variable on Windows); mono only for IDs and codes. System fonts only.
- Record and message text stay short: one line per point where possible.
- Quality floor: works at 390 px wide without page-level horizontal scroll, visible keyboard focus, `prefers-reduced-motion` respected, state always stated in text.

**Copy:**
- Write for the SMC under time pressure: short, plain, active voice, sentence case.
- Buttons say what happens: "Approve", "Send", "Apply record update". An action keeps its name through the flow: Approve → "Approved".
- Times are `HH:MM UTC`. Systems and codes are upper case, as in the record (SKYFORGE, ZRH-E, FDP-ZH-02).
- Errors say what happened and what to do next. No apologies, no vague "something went wrong".
- Never call the simulated send a real send. The send button reads "Send" (team request); its tooltip and screen-reader name, the banner, the status and the log still say "simulated".

**Docs and commits:**
- Docs follow `skills/documentation`: write for the reader, most useful information first, link instead of copying.
- Commit messages: imperative subject under 72 characters, body explaining why.

## Skills in this project

Copies live in `skills/` so every teammate works from the same version. Installed copies (`~/.claude/skills`) are what Claude Code actually loads; `skills/` is the shared reference.

| Skill | Use it for |
|---|---|
| `skills/tile-skill` (`/tile-skill`) | Anything touching the Tile SDK, AI calls, publishing the tile, admin setup and the edit-mode hand-off |
| `skills/frontend-design` (`/frontend-design`) | Any new or reshaped UI. Keep the visual direction above unless the team changes it |
| `skills/code-review` (`/code-review`) | Before every merge. Pay particular attention to: escaping of AI and record text, approval-gate bypasses, text compare at send, SDK error paths |
| `skills/documentation` (`/documentation`) | README, demo script, hand-off and rollout notes |

## Running and checking

- **Local demo:** open `index.html` in Edge or Chrome, or run `serve.ps1` (http://localhost:5173). Pick an SMC profile on the sign-in screen.
- **With local AI:** install [Ollama](https://ollama.com), run `ollama pull qwen2.5:3b`, then open the page through `serve.ps1` (http://localhost:5173). The footer shows "Local AI on". Opening the file directly (`file://`) usually fails Ollama's origin check; if you need it, set `OLLAMA_ORIGINS=*` before starting Ollama.
- **With AI:** publish `index.html` as a **private** tile. A tile admin then needs: Request AI access (if not yet approved) → app-admin approval → Manage → Services → enable AI and acknowledge provider egress → reload. The footer then shows "Tile AI on" with call/token/cost counters (input for the tokenomics slide); hover it for the model.
- **Republishing:** `publish.ps1 -Slug <slug>` with `$env:TILE_TOKEN` set to a `content:write` tile access token (Manage → Automation). Never commit the token. Republishing replaces edits saved in Tile's editor.
- **No descriptive filler in the UI.** Status lines appear only when they ask for an action (for example the admin AI setup hint).
- **Before you call a change done:** both incidents load; approve is locked until read; send blocks when text changed after approval; "Apply record update" withdraws only affected approvals and keeps SMC edits; the minor incident has no management group; an edit updates the other two languages and shows the pop-up; the log shows each sent text; the browser console shows no errors.
