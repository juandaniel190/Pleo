# Handover — Pleo RevOps Performance Analyst Challenge

This document is for the next AI agent (or future me) to pick up the work.
Read it before touching anything. Last updated: 15 May 2026.

## Where this stands

The technical challenge has four parts. Three are **done end-to-end and verified**; one is **deferred**.

| Part | Deliverable | Status |
|---|---|---|
| 1 | Data model (schema, PKs/FKs, assumptions) | ✅ Done — `deliverables/01_data_model.md` |
| 2 | Dashboard for VP of Sales | ✅ Done — single-HTML React + Recharts (Perk pattern) at `dashboard/index.html` |
| 3 | Five-slide CRO/VP Sales deck (PPTX) | ⏳ **Deferred** — Daniel will produce after reviewing the analysis |
| 4 | SQL queries + Python script | ✅ Done — `deliverables/04_sql_queries/` (5 queries) + `deliverables/04_python_script.py` |

Plus: assumptions log, AI usage log, full Jupyter notebook with 10 analysis sections, and a Pleo-branded design system file.

The dbt build runs clean: `Done. PASS=49 WARN=0 ERROR=0`.

## Architecture in one paragraph

A local dbt project (`dbt_pleo/`) on DuckDB transforms the seven raw Excel tabs into seven facts/dims through three layers: **staging → intermediate → marts**. Staging is rename + cast only (the two macros `parse_date` and `parse_percent` handle messy source formats). All business logic — dedupe, label canonicalisation, ramp adjustment, stale-deal flagging, slippage tracking — lives in `intermediate/`. The marts power the Jupyter notebook (which generates 8 chart PNGs) and the single-HTML React dashboard (`dashboard/index.html`). The dashboard is deployable to GitHub Pages with no build step.

## File layout

```
Amezquita_Daniel_RevOps/
├── README.md                  # user-facing run instructions (venv + dbt + notebook + dashboard)
├── HANDOVER.md                # this file
├── PROJECT_PLAN.md            # the original plan
├── requirements.txt           # Python deps
│
├── dbt_pleo/                  # dbt project (DuckDB target)
│   ├── dbt_project.yml        # ← seeds force date/percent columns to varchar here
│   ├── profiles.yml           # DuckDB path: /tmp/pleo.duckdb (override with DBT_DUCKDB_PATH)
│   ├── packages.yml           # empty — no external packages
│   ├── seeds/                 # 7 CSVs extracted from the Excel
│   ├── macros/
│   │   ├── parse_date.sql     # handles ISO + DD/MM/YYYY + YYYY-MM in same column
│   │   ├── parse_percent.sql  # strips % and casts to int (with defensive cast to varchar)
│   │   ├── clean_string.sql   # trim + lower
│   │   └── normalize_label.sql # tiny mapping macro, used in intermediate only
│   └── models/
│       ├── staging/           # 7 stg_pleo__* views, all reading via ref() of seeds
│       ├── intermediate/      # 8 int_* views — all business logic
│       └── marts/core/        # 7 tables (2 dims + 5 facts)
│
├── analysis/
│   └── revops_analysis.ipynb  # 10 sections, 21 code cells, 8 figures
│
├── dashboard/
│   ├── index.html             # single-HTML React+Recharts dashboard
│   ├── app.jsx                # React component tree (loaded by index.html)
│   ├── build_dashboard.py     # regenerates index.html from /tmp/pleo.duckdb
│   ├── _data.json             # snapshot of dashboard data (debug aid)
│   └── assets/                # 8 PNG charts from the notebook
│
├── design/
│   ├── pleo_brand.md          # Pleo Telescope colour palette + typography rules
│   └── pleo_theme.css         # CSS variables (used by older HTML dashboard; legacy)
│
├── .claude/skills/            # 8 installed B2B RevOps skills (NEON-Rutger repo)
│
└── deliverables/              # everything to submit to Pleo
    ├── 01_data_model.md       # Part 1
    ├── 02_dashboard.html      # copy of dashboard/index.html
    ├── 03_deck.pptx           # ← TO BE BUILT (Part 3, deferred)
    ├── 04_sql_queries/        # Part 4 — 5 BigQuery-compatible queries
    ├── 04_python_script.py    # Part 4 — raw Excel→CSV (no transforms in Python)
    ├── analysis_notebook.ipynb
    ├── assumptions_log.md
    ├── ai_usage_log.md
    └── validation_report.json # output of 04_python_script.py
```

## Critical design rules (don't violate these without asking Daniel)

1. **Staging is rename + cast only.** Use the two macros (`parse_date`, `parse_percent`) for messy columns. No joins, no aggregations, no business logic in staging.
2. **All business logic in `intermediate/`.** This is the lesson from the prior project's feedback.
3. **No external dbt packages.** `packages.yml` is empty. Macros are local and ≤10 lines each.
4. **Per-model `.yml`** (descriptions only). Tests are minimal — only PK uniqueness on dims/facts.
5. **Per-model `config()` blocks**. staging=view, intermediate=view, marts=table.
6. **No `.md` docblock files in models/.** They were removed; descriptions live in the `.yml`.
7. **Seeds → staging via `ref()`** (not `source()`). This is what makes `dbt build` order the DAG correctly.
8. **`UK` as the market label**, not `UKI`. Pleo's source uses UKI; we rename it in `int_accounts_standardized` and `int_rep_quota_ramped`.
9. **No data transformations in Python.** `04_python_script.py` extracts Excel to CSV with raw values. All cleaning happens in dbt.
10. **Dashboard is a single self-contained HTML.** No build step, no npm install. CDN React + Babel + Recharts + Tailwind, all data hardcoded as JS literals.

## Headline findings (so the next agent knows the story)

- **Q2 2026 is RED.** Six weeks in, €0 closed of €310.6K ramp-adjusted target. Q2 weighted pipeline = €255K (capped upside).
- **34 stale open deals worth €1.34M** (€384K weighted) — no AE activity in 30+ days. Biggest single deal: Wise (UK Enterprise, J. Patel, €161K, 85 days silent).
- **9 deals slipped close date** last snapshot (€405K).
- **23 deals stuck >90 days in same stage** (€785K).
- **Every rep at 0% Q2 attainment** — system problem, not rep coaching.
- **Drift findings**: 2 accounts have market label drift (Pleo's CRM clean field disagrees with the canonical re-derivation). `segment_raw` has 11 distinct values for 3 canonical segments.

**Automation opportunities:**
1. Weekly stale-deal alert → +€44K recovered ARR in 45 days (15% re-engage × 22% historical win rate).
2. Lock CRM picklists on segment/market/demand_source/stage → kill the recurring data hygiene tax.

## What's left to do

### 1. PPTX deck (Part 3) — the main remaining piece

Five slides, audience = CRO + VP Sales. Brief says:
- Lead each slide with a **finding**, not a chart title
- Every recommendation includes a **euro value and a timeframe**
- Audience is not technical

**Suggested slide skeleton:**
1. **Q2 RAG: RED.** Pace €0/€310.6K, six weeks in. Two consecutive quarters of <30% attainment.
2. **Stale pipeline is the largest controllable lever.** 34 deals · €1.34M · UK Mid-Market concentrates €296K.
3. **Velocity is breaking down.** Initial Meeting (83d), Qualified (79d), Contracting (79d). Slip rate trending 3% → 19% over 6 months.
4. **Demand-source mix matters.** Partnerships ASP €93K vs SDR Outbound €32K — invest in Partnerships and Marketing volume.
5. **Two automation wins this week.** Stale-deal alerting (+€44K/45d) and CRM picklist hardening.

All numbers are already in `dashboard/_data.json` and the marts. Build via the `pptx` skill (already in the project at `.claude/skills/pptx/SKILL.md` if installed, or available via Claude's built-in skills).

### 2. Nice-to-haves (not required by the brief)

- A `dbt-docs` deployment step (currently optional — runs locally via `dbt docs serve`)
- A `requirements-dev.txt` separating notebook deps from warehouse deps
- A GitHub Action to rebuild the dashboard on every push and publish to Pages

## How to pick up the work (terminal session)

```bash
# 1. Get to a working environment
cd Amezquita_Daniel_RevOps
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# 2. Rebuild the warehouse to confirm the current state works
python deliverables/04_python_script.py
cd dbt_pleo
DBT_PROFILES_DIR=. dbt build --full-refresh   # expect: PASS=49 ERROR=0
cd ..

# 3. Re-run the notebook
jupyter nbconvert --to notebook --execute analysis/revops_analysis.ipynb \
    --output revops_analysis.ipynb

# 4. Rebuild the dashboard from current marts
python dashboard/build_dashboard.py
open dashboard/index.html   # macOS; or just open in your browser

# 5. (When ready) build the PPTX deck
# Use the pptx skill — every figure already exists as a PNG in dashboard/assets/
# and every number is in dashboard/_data.json
```

## Key technical "gotchas" (lessons learned, will save the next agent time)

1. **DuckDB CSV sniffer disagrees with column_types.** If you change a seed CSV, columns with mixed date formats will fail to load unless `dbt_project.yml` types them as varchar. The config is already there — don't remove it.
2. **`dbt build` requires `ref()` from staging to seeds**, not `source()`. With `source()`, dbt has no DAG edge to the seed and runs them in parallel with the views, causing race conditions.
3. **`parse_percent` macro casts input to varchar first.** Defensive — works even if DuckDB decides the column is INTEGER for some reason.
4. **The DuckDB file is at `/tmp/pleo.duckdb`** by default (override with `DBT_DUCKDB_PATH`). If you get `IO Error: Could not remove file ".wal"`, the file is locked by another process — close it and `rm /tmp/pleo.duckdb*`.
5. **The `_seeds.yml` properties file was removed** in favour of `+column_types` in `dbt_project.yml`. Don't reintroduce it — it caused conflicts on Daniel's local machine.
6. **The dashboard's data is hardcoded as JS literals** inside `index.html`. To refresh, re-run `python dashboard/build_dashboard.py`. The script reads from `/tmp/pleo.duckdb`, so make sure dbt has been built first.
7. **The notebook is fully executed and saved on disk.** If you re-run it, use `jupyter nbconvert --to notebook --execute --output revops_analysis.ipynb` so outputs are persisted.

## Submission format

Files should be labelled `Surname_Firstname_RevOps` (already done — the folder is `Amezquita_Daniel_RevOps`). The brief asks to send all files to the Pleo recruiting contact. Once the deck is built, zip the `deliverables/` folder and send.

## If something looks wrong

The `README.md` "Troubleshooting" table at the bottom covers the three errors we hit during development. Anything beyond that — look at `target/run_results.json` after a failed `dbt build`, or ask Daniel.
