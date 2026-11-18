**Message Generator Format**

# Target User of Tool

- SMC: operates the process and decides what is sent

# Other Users with which the tool interacts

- ATCO supervisors
- Engineering
- Management (major incidents only)

# Requirements provided

- Generate messages from the incident record
- State:
  - what is affected
  - what still works
  - what is degraded
  - what to expect
- Correctness of message generated
- Correct target audience for each message (depends on item in incident record and its severity whether all stakeholders are involved or whether management is omitted)
- Languages (consistent across each other and with incident record):
  - German
  - English
  - French
- No message contradicts the record or another language version (provable)
- Prove that the SMC decides what is sent
- Fast enough under time pressure, as the record changes
- UI feature forcing the SMC to read the AI generated text and intentionally approve it
- The content and language needs to be adjusted to each stakeholder individually

# Nice to Have

- Vector similarity calculation to prove language translation accuracy
  - This could be an additional tab/ pop-up
  - If this is included, additional to a basic similarity metric, a visual vector similarity would be a bonus

# Assumptions

- The incident record is in English
- A message needs to be sent to everyone except management for each incident record item; for major incidents, everyone is always informed with their relevant information
- The initial incident record is provided in a format where the following things have been pre-extracted from multiple systems: what is affected, what still works, what is degraded, what to expect
- The SMC on shift in theory can draft messages in EN, DE, FR as this used to be their way of working. With the tool, a translation is provided which they can understand relatively with ease such that they can reject, approve or edit in case of AI errors.

# Out of Scope

- Actually sending SMS or email
- Diagnosis and severity (synthetic data should contain different levels of severity to demonstrate the difference of including vs not including management level as a stakeholder to be contacted)
- The shift handover (card 04)
- Incident reports and closing documentation

# Features for the implementation of the tool

- Generated message in English language in bullet format covering the four WHATs but containing only information relevant to the target audience (e.g. ATCO vs engineering has different information requirements)
  - Based on the initial incident record (which we assume as single source of truth on which our tool is built)
- Mapping of function (ATCO, engineering, mgmt.) to specific people including their preferred language (EN vs DE vs FR)
- Proposed translation of initial generated message in English language to the preferred language of the person to be contacted
- Button for human in the loop to approve the message, reject the message, or edit it in every language version
  - Every message needs to be approved individually, there is no approve all at once button
  - This includes translated messages as well as the English message based on incident record information retrieval
- Each role contains multiple people (they can have different preferred languages); by default the message in the correct language will be sent to them. There is the option to unselect specific persons whom the proposed message should not be sent to
- A button to simulate a send
- A translation accuracy reviewer agent which has the task to validate translation accuracy across all languages to be consistent and to ensure they are all consistent with the initial incident record
  - Output a quantitative score of translation accuracy between English → German AND English → French
  - For initial English synthetic outputs a quantitative confidence score of information retrieval accuracy from the incident record should be provided
  - Any gaps should be flagged (below 100% confidence) for the human to review closely and, if necessary, edit

# Other Information for later reference (not included in tool)

- Tokenomics included in presentation of tool building
