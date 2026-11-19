# SMC stakeholder message generator

Drafts incident messages for ATCO supervisors, engineering and management in English, German and French from a single incident record, checks them, and lets the SMC approve each one before a simulated send. Graduate Academy AI Week, SkyNet case, card 03.

## Test it

**Open the live tool:** https://tile.accenture.com/view/stakeholder-message-generator/

Sign in with your Accenture account. If you see an access error, ask the team to add you. The top bar shows **AI on** when drafting, translation review and similarity run through Tile AI.

1. Start with the **SKYFORGE · major** incident (selector in the top bar). All three audiences are informed.
2. For each audience, read the message until **Approve** unlocks, tick any notes, then approve. Switch between English, German and French with the language control.
3. Choose **View similarity** to compare English with each translation.
4. Choose **Simulate send** once all languages of an audience are approved.
5. Choose **Apply record update** and check that only the affected audiences are redrafted and need approval again.
6. Try **Edit** and **Reject** on a message, and switch to the **METEOFLOW · minor** incident: management is not informed.

Things to look for: wrong or missing facts, translations that don't match the English, and anything that slows you down under time pressure.

**Offline fallback:** open `index.html` from the zip in Edge or Chrome. It runs in demo mode: English is taken from the record, translations are bundled references, and there is no AI review or similarity.

## Repo map

- [index.html](index.html): the generator
- [context/](context/README.md): scope, requirements, background
- [skills/](skills/): the team's shared skills
- [CLAUDE.md](CLAUDE.md): rules for anyone (human or Claude) changing the code
