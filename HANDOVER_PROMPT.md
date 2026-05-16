# Kickoff prompt for the next agent

Paste this into your terminal session with Claude Code (or another agent) at the start of a new conversation. It briefs the agent on what's done, the conventions to respect, and what to work on next.

---

```
I'm continuing work on the Pleo RevOps Performance Analyst technical challenge.
The project is in this folder. Read HANDOVER.md FIRST before doing anything —
it tells you exactly where things stand, the design rules, and the open work.

In short:
- Parts 1, 2, 4 of the challenge are done and verified (data model, dashboard,
  SQL/Python).
- Part 3 (a five-slide PPTX deck for the CRO and VP of Sales) is the main
  outstanding piece. Skeleton and headline numbers are in HANDOVER.md.

Conventions to respect (full list in HANDOVER.md, section "Critical design
rules"):
- dbt staging is rename + cast only — use the parse_date / parse_percent macros
- All business logic lives in models/intermediate/
- Per-model .yml only (no .md docblocks)
- Use ref() not source() when reading seeds in staging
- 'UK' is the market label, not 'UKI'
- All data cleaning in dbt — NEVER in the Python ingestion script

Verify the project builds before making changes:

  source .venv/bin/activate
  python deliverables/04_python_script.py
  cd dbt_pleo && DBT_PROFILES_DIR=. dbt build --full-refresh
  # expect: Done. PASS=49 WARN=0 ERROR=0

Then ask me which task to start on. Most likely it's the PPTX deck — every
figure already exists in dashboard/assets/ and every number is in
dashboard/_data.json, so you don't need to re-derive anything.
```

---

## Optional one-liner if the session is short

If you just want the next agent to build the deck and stop:

```
Read HANDOVER.md and then build deliverables/03_deck.pptx — five slides for
the CRO and VP of Sales. Use the pptx skill. Every figure is in
dashboard/assets/, every number is in dashboard/_data.json. Follow the slide
skeleton in HANDOVER.md section "What's left to do". Lead each slide with a
finding (not a chart title); every recommendation must have a EUR value and a
timeframe.
```
