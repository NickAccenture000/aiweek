# Project Context: Stakeholder Message Generator

**Card:** 03 • VERSO
**Theme:** Cognitive load in critical situations
**Project:** Stakeholder message generator

## The challenge

During an incident, the SMC (the team running incident response) tells three groups what is happening:

- ATCO supervisors
- Engineering
- Management (for major incidents only)

Each message covers:

- What is affected
- What still works
- What is degraded
- What to expect

Messages are written in **German, French and English**, under time pressure. Today this is partly done through a **manual SMS procedure**.

**Goal:** build a way to produce these messages from the **incident record**, so that each message is:

1. **Correct**: it matches the incident record.
2. **Fitted to its audience**: supervisors, engineering and management need different content.
3. **Consistent across languages**: the DE, FR and EN versions say the same thing.

The solution must also **prove** two things:

- No message contradicts the incident record or another language version.
- The SMC decides what is sent. Nothing goes out without the SMC's decision.

## The pain today

- About nine messages are written by hand during one incident (3 audiences × 3 languages).
- They are written while the incident record keeps changing, so messages can go stale or contradict each other.

## Out of scope

- Actually sending SMS or email
- Diagnosis and severity
- The shift handover (card 04)
- Incident reports and closing documentation

## Key requirements (summary)

| Requirement | Meaning |
|---|---|
| Source of truth | Messages are generated from the incident record, not written freehand |
| Audience fit | Content and level of detail are tailored per audience |
| Multilingual | German, French and English, kept consistent with each other |
| Verifiable | Evidence that no message contradicts the record or another language version |
| Human in control | The SMC reviews and decides what is sent |
| Handles change | The record keeps changing, so messages must be regenerated or flagged when it does |

## Open questions

- What fields does the incident record contain, and how does it change over time?
- What exactly differs between the supervisor, engineering and management messages?
- What does "prove" look like in practice (automated checks, side-by-side review, an audit trail)?
- Does the SMC approve each message separately, or approve a set of messages together?
