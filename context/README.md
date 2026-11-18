# Context

What you need to know before changing anything in this repo.

## Where this project sits

SkyNet (Swiss air traffic control) went through an earlier engagement: a skill assessment of its System Monitoring Control (SMC) function, followed by a concept for a unified SMC Support Platform. **That phase is finished.** The problems it found are treated as understood, and the platform concept as delivered.

This phase implements individual use cases from that concept. Ours is one use case only: the **stakeholder message generator** (card 03 · VERSO, theme "cognitive load in critical situations"). Nothing else from the SkyNet case is in scope: no user-manual redesign, no AeroDoc replacement, no workforce topics, no shift handover.

## Files, in reading order

| File | Role | Authority |
|---|---|---|
| [01-project-context.md](01-project-context.md) | The challenge card: who gets messages, what they contain, what must be proven | **Scope** |
| [02-requirements-v01.md](02-requirements-v01.md) | Our team's requirements, assumptions, features and out-of-scope list | **Scope**. Wins over 01 where they differ |
| [03-skynet-background.md](03-skynet-background.md) | Converted slides from the original SkyNet engagement | Background only |

## Decisions that close the open questions in 01

The open questions at the end of `01-project-context.md` are answered by `02-requirements-v01.md` or by the decisions below.

| Open question | Answer |
|---|---|
| What fields does the incident record contain, and how does it change? | The record is in English and arrives pre-extracted into the four WHATs (affected / still works / degraded / what to expect). Each item has an ID, a section, its text, and the audiences it is relevant to. Every change raises the revision number. The record is read-only for the SMC; in the prototype, changes arrive as scripted record updates. |
| What differs between supervisor, engineering and management messages? | Each record item is tagged with the audiences it matters to. ATCO supervisors get operational impact. Engineering gets technical detail. Management gets the business-level summary and **only for major incidents**. |
| What does "prove" look like? | Three layers: (1) rule-based checks that always run (every bullet cites a record item, every relevant item is covered, no out-of-audience item, numbers and system codes match across languages, same structure, current revision); (2) an AI reviewer score per message, where anything under 100% is flagged; (3) an audit trail with a SHA-256 hash of the text the SMC approved, compared again at simulated send. |
| Approve each message separately, or as a set? | **Each message separately.** There is no approve-all. The approve button stays locked until the SMC has had the message on screen long enough to read it and has acknowledged every flag. |

## Synthetic data rules

- All incident data, people and systems are fictional. System names come from the SkyNet case (SKYFORGE, METEOFLOW, SENTINELWATCH, ECHOVOX…).
- No real names, emails or phone numbers. A Tile upload requires a declaration that the content has no personal data.
- Ship at least one **minor** incident (no management message) and one **major** incident (management included), so the routing difference can be demonstrated.
