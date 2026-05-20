# Pleo RevOps Performance Analyst — Technical Challenge

**Author:** Daniel Amezquita · **Stack:** dbt + DuckDB → Jupyter → React + Recharts

## Deliverables

- **Part 1 — Data model:** [→ dbt Data Model](deliverables/01_data_model.md) · [assumptions_log.md](deliverables/assumptions_log.md)
- **Part 2 — Dashboard:** [→ Dashboard](https://juandaniel190.github.io/Pleo/)
- **Part 3 — Deck:** [→ Deck](https://juandaniel190.github.io/Pleo/deliverables/05_executive_deck.html)
- **Part 4 — SQL + Python:** [→ Queries](deliverables/04_sql_queries/) · [04_python_script.py](deliverables/04_python_script.py)
- **AI usage log:** [→ AI log](deliverables/ai_usage_log.md)

## What's here

```
Amezquita_Daniel_RevOps/
├── README.md
├── requirements.txt
├── dbt_pleo/                  # dbt project — staging → intermediate → marts on DuckDB
├── dashboard/
│   ├── index.html             # the dashboard — open this
│   ├── app.jsx                # React component tree
│   ├── queries.js             # DuckDB-WASM runtime queries
│   ├── build_dashboard.py     # exports parquet + regenerates index.html
│   └── data/                  # parquet exports of each mart
├── design/
│   └── pleo_theme.css         # Pleo Telescope design tokens
└── deliverables/
    ├── 01_data_model.md
    ├── 05_executive_deck.html
    ├── 04_sql_queries/        # 5 BigQuery-compatible queries
    ├── 04_python_script.py
    ├── analysis_notebook.ipynb
    ├── assumptions_log.md
    ├── validation_report.json
    └── ai_usage_log.md
```

## Run it locally

```bash
# 1. Install dependencies
python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt

# 2. Build the warehouse
cd dbt_pleo && dbt build && cd ..

# 3. Export parquets + rebuild dashboard
python dashboard/build_dashboard.py

# 4. Serve (CDN scripts require HTTP — don't open index.html directly)
python3 -m http.server 8000 --directory dashboard
# → http://localhost:8000
```

## dbt design

- **Staging → Intermediate → Marts** — every business rule in `intermediate/`. Staging is rename + cast only.
- **Two local macros:** `parse_date` (ISO + DD/MM/YYYY + YYYY-MM in one column) and `parse_percent` (strips `%`, casts to int).
- **Mixed-format columns force-typed to `varchar` at seed layer** so DuckDB's sniffer doesn't fight the macros.
- **UK** as the canonical market label (source `UKI` renamed in intermediate).

## Headline findings

- **Q2 2026 is RED.** Six weeks in, €0 closed of a €310.6K ramp-adjusted target.
- **34 open deals worth €1.34M (€384K weighted) are stale** — no AE activity in 30+ days.
- **9 open deals worth €405K slipped** close date at the last snapshot.
- **23 deals stuck >90 days in stage** — €785K of frozen pipeline.
- **Automation #1:** weekly stale-deal alert → +€44K recovered ARR in 45 days (15% re-engage × 22% win rate).
- **Automation #2:** lock CRM picklists — `segment_raw` has 11 distinct values for 3 canonical segments.

