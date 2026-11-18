# SMC stakeholder message generator

Drafts incident messages for ATCO supervisors, engineering and management in English, German and French from a single incident record, checks them, and lets the SMC approve each one before a simulated send. Graduate Academy AI Week, SkyNet case, card 03.

## Try it

Open `index.html` in Edge or Chrome. Without Tile it runs in **demo mode**: rule-based drafts and bundled reference translations for two fictional incidents (one major, one minor).

1. Read a message until **Approve** unlocks, tick any notes, approve. The view moves on to the next language.
2. Choose **Simulate send** for an audience once all its languages are approved.
3. Choose **Apply record update** and watch only the affected audiences redraft.
4. Turn on **Show sources** to see which record item each point comes from. Open **Verification and activity log** at the bottom for the full trail.

For AI drafting, translation review and similarity, publish it as a private Tile with AI enabled. See [CLAUDE.md](CLAUDE.md#running-and-checking).

## Repo map

- [index.html](index.html): the generator
- [context/](context/README.md): scope, requirements, background
- [skills/](skills/): the team's shared skills
- [CLAUDE.md](CLAUDE.md): rules for anyone (human or Claude) changing the code
