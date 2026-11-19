# SMC stakeholder message generator

Drafts incident messages for ATCO supervisors, engineering and management in English, German and French from a single incident record, checks them, and lets the SMC approve each one before a simulated send. Graduate Academy AI Week, SkyNet case, card 03.

## Test it

**Open the live tool:** https://tile.accenture.com/view/stakeholder-message-generator/

Sign in with your Accenture account. If you see an access error, ask the team to add you. The live tile shows the version last published with `publish.ps1`.

1. **Pick an SMC profile.** Luc Bürki, Chiara Mercurio and Mansur Kagermann work in German; Hugo Zweifel and Nicolas Ammann in French; Tiago Hungerland and Robert Seggewiss in English. Messages open in that language; the incident record stays in English.
2. Start with the **SKYFORGE · major** incident (selector in the top bar). All three audiences are informed. Open **Recipients** to see who gets each message, in which language and channel, and untick anyone who shouldn't. The gear next to it opens **Manage stakeholders**: type a name to add someone from the organisation (group, language, channel and role fill in automatically), or remove someone.
3. For each audience, read the message until **Approve** unlocks, then approve. You approve your own language only; the other two follow it. Choose the **i** next to the audience name to see retrieval and translation accuracy.
4. Choose **Simulate send**. Under **Also sent in** you can read the other two languages.
5. Choose **Edit**, change a number or add a point with the **+** next to a subsection, and save. A pop-up confirms that the other two languages were updated. Approve your message again.
6. Choose **Apply record update** and check that only the affected audiences are redrafted and need approval again. Your edits stay; a note flags any edited point whose record item changed.
7. Switch to the **METEOFLOW · minor** incident: management is not informed.
8. Open **Verification and activity log** at the bottom. The flow shows the record feeding each English message and each English message feeding German and French. The log shows which profile did what; each simulated send has **Show sent message** with the exact text in that language.

Things to look for: wrong or missing facts, translations that don't match, and anything that slows you down under time pressure.

**Without Tile AI** (the current state, and when you open `index.html` directly in Edge or Chrome): English comes straight from the record and German and French from bundled reference translations. Edits that only change numbers, times or codes carry over to the other languages. Any other new wording shows "Real LLM required → implementation phase" in the other languages; real translation, also live while typing, comes with an LLM in the implementation phase.

## Repo map

- [index.html](index.html): the generator
- [context/](context/README.md): scope, requirements, background
- [skills/](skills/): the team's shared skills
- [CLAUDE.md](CLAUDE.md): rules for anyone (human or Claude) changing the code
