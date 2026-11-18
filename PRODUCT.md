# Product

**SkyNet SMC console.** During an airspace incident the System Management Centre (SMC) operator tells ATCO supervisors, engineering and, for major incidents, management what is affected, degraded and still working, in German, French and English.

- **Surface mode:** Operate. One operator, under time pressure, completing a task they repeat on every incident update.
- **Principle:** agents write (simulated), code checks (real), the SMC decides. Nothing is sent without per-role approval.
- **Task flow:** incident arrives in the inbox, operator reviews the record, confirms recipients, reviews and approves generated messages, sends, then tracks delivery and confirmation.
- **Must stay true:** facts only enter messages as record-bound tokens; every send is logged with overrides and reasons; the operator can always see what changed since the last message.
- **Not in scope:** real sending, diagnosis, severity decisions, multiple concurrent incident workflows.
