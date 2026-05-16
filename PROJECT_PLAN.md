# Pleo RevOps Challenge — Project Plan

**Author:** Daniel Amezquita
**Date:** 2026-05-14
**Reference quarter for analysis:** Q2 2026 (current)
**File label convention:** `Amezquita_Daniel_RevOps_*`

---

## 1. Objective

Take the seven raw GTM tables Pleo provided, model them like a production warehouse, and produce outputs (dashboard, analysis, SQL/Python, data model) that let the CRO and VP of Sales make decisions on Monday morning. The deck is out of scope for this round and will be built later from the same marts.

The challenge is being approached as four parts (per the brief):
1. **Data model** — production schema with PKs, FKs, relationships, assumptions
2. **Dashboard** — HTML, insight-first, two-tier (CRO hero + drilldowns), for the VP of Sales
3. **Deck** — 5-slide PPTX for CRO + VP of Sales (deferred to the next session)
4. **SQL + Python** — BigQuery-compatible SQL queries (≥2-table joins) and a Python script that cleans/validates

---

## 2. Technical approach

A local **dbt project on DuckDB** (no Supabase) replicating the structure of the previous `analytics_engineering` project, but with the specific fixes called out in feedback from that project.

### 2.1 Fixes vs. previous project's feedback

| Previous feedback | How it's addressed here |
|---|---|
| Missing an intermediate transformation layer | Dedicated `models/intermediate/` folder with ~8 models. Every join, standardization, dedupe, and ramp adjustment happens here — staging stays pure. |
| Currency conversion in staging | All ARR is already in EUR in the source — no FX needed. If FX were needed, it would live in `intermediate/`. Staging is rename + cast only. |
| Jinja in staging | Staging models are plain SQL with no Jinja, no macros, no joins. |
| Documentation not structured (no docblocks, multiple models per file) | One `.yml` schema file **per model** + one `.md` docblock file per model using `{% docs %}…{% enddocs %}`. |
| No config blocks → everything materializes as views | Every model has an explicit `{{ config(materialized='...') }}` block. Staging = view, intermediate = view, marts = table. Folder defaults also set in `dbt_project.yml`. |
| Overly complex currency macro | Macros are single-purpose, ≤10 lines each. No multi-adapter branching (DuckDB only). |

### 2.2 Warehouse choice

**DuckDB**, local file (`pleo.duckdb`). Reasons: zero setup, fast for the data volume (~1k rows total), reproducible from a fresh clone, BigQuery-compatible SQL dialect for the deliverable queries.

---

## 3. Folder structure

```
Amezquita_Daniel_RevOps/
├── README.md                          # how to run end-to-end
├── PROJECT_PLAN.md                    # this file
├── requirements.txt
│
├── dbt_pleo/                          # dbt project (local DuckDB)
│   ├── dbt_project.yml                # folder-level materializations
│   ├── profiles.yml                   # duckdb only
│   ├── packages.yml
│   ├── seeds/                         # CSVs exported from the Excel
│   │   ├── raw_accounts.csv
│   │   ├── raw_opportunities.csv
│   │   ├── raw_pipeline_snapshots.csv
│   │   ├── raw_funnel_events.csv
│   │   ├── raw_sales_targets.csv
│   │   ├── raw_rep_roster.csv
│   │   ├── raw_activity_data.csv
│   │   └── _seeds.yml
│   ├── macros/
│   │   ├── clean_string.sql           # trim + lower helper (kept simple)
│   │   └── normalize_label.sql        # one mapping macro, one purpose
│   └── models/
│       ├── staging/                   # views — pure rename/cast, NO Jinja, NO joins
│       │   ├── _sources.yml
│       │   ├── stg_pleo__accounts.{sql,yml,md}
│       │   ├── stg_pleo__opportunities.{sql,yml,md}
│       │   ├── stg_pleo__pipeline_snapshots.{sql,yml,md}
│       │   ├── stg_pleo__funnel_events.{sql,yml,md}
│       │   ├── stg_pleo__sales_targets.{sql,yml,md}
│       │   ├── stg_pleo__rep_roster.{sql,yml,md}
│       │   └── stg_pleo__activity_data.{sql,yml,md}
│       ├── intermediate/              # views — ALL business logic lives here
│       │   ├── int_accounts_standardized.{sql,yml,md}
│       │   ├── int_opportunities_deduped.{sql,yml,md}
│       │   ├── int_opportunities_enriched.{sql,yml,md}
│       │   ├── int_pipeline_stage_history.{sql,yml,md}
│       │   ├── int_funnel_events_standardized.{sql,yml,md}
│       │   ├── int_rep_quota_ramped.{sql,yml,md}
│       │   ├── int_activity_outcomes_filled.{sql,yml,md}
│       │   └── int_opportunity_last_activity.{sql,yml,md}
│       └── marts/
│           └── core/
│               ├── dim_accounts.{sql,yml,md}            # table
│               ├── dim_reps.{sql,yml,md}                # table
│               ├── fct_opportunities.{sql,yml,md}       # table
│               ├── fct_pipeline_health.{sql,yml,md}     # table, incl. stale flags
│               ├── fct_rep_attainment.{sql,yml,md}      # table, monthly + QTD
│               ├── fct_funnel_conversion.{sql,yml,md}   # table
│               └── fct_quarterly_arr.{sql,yml,md}       # table, pace vs target
│
├── analysis/
│   └── revops_analysis.ipynb          # connects to DuckDB, reads marts, produces figures
│
├── design/
│   ├── pleo_brand.md                  # palette + type rules (researched online)
│   └── pleo_theme.css                 # CSS variables consumed by dashboard
│
├── dashboard/
│   ├── index.html                     # insight-first, two-tier layout
│   └── assets/                        # charts (PNG/SVG) embedded or linked
│
└── deliverables/
    ├── 01_data_model.md               # Part 1 — schema, PKs/FKs, assumptions
    ├── 02_dashboard.html              # Part 2 — copy of dashboard/index.html
    ├── 03_deck.pptx                   # Part 3 — placeholder, built later
    ├── 04_sql_queries/                # Part 4 — BigQuery-compatible SQL
    ├── 04_python_script.py            # Part 4 — Python validation/cleaning
    ├── analysis_notebook.ipynb        # copy of analysis/revops_analysis.ipynb
    ├── assumptions_log.md
    └── ai_usage_log.md
```

---

## 4. Model layer responsibilities

### 4.1 Sources (Excel → CSVs in `seeds/`)

Seven CSVs, one per Excel tab. A Python script in `04_python_script.py` does the extraction and basic validation (row counts, primary-key uniqueness, FK referential integrity warnings) before `dbt seed`.

### 4.2 Staging (`stg_pleo__*`) — materialized as **view**

Strict rules:
- One staging model per source table
- **Only**: rename columns to snake_case, cast types, trim whitespace
- **No** joins, **no** Jinja, **no** aggregations, **no** business logic
- Use `*_raw` columns where the Excel ships both raw and clean — staging carries both forward so the intermediate layer can re-derive cleanly

### 4.3 Intermediate (`int_*`) — materialized as **view**

Where every business rule lives:

| Model | What it does |
|---|---|
| `int_accounts_standardized` | Resolve `market`, `region`, `segment`, `country` inconsistencies using `*_raw` fields. Derived `market` is the source of truth from here on. |
| `int_opportunities_deduped` | Remove the one intentional duplicate set (keep earliest `created_at`). |
| `int_opportunities_enriched` | Join deduped opportunities to standardized accounts and rep roster. Derive canonical stage, demand source, and forecast category. |
| `int_pipeline_stage_history` | Calculate stage age, slippage between snapshots, and stage transitions per opp. |
| `int_funnel_events_standardized` | Normalize demand source labels so funnel events and opportunities are joinable on the same canonical values. |
| `int_rep_quota_ramped` | Apply ramp factor to monthly quota for REP-009 / REP-016. Handle REP-004's market change (Oct 2025) by splitting attribution before/after that date. |
| `int_activity_outcomes_filled` | Fill ~10% missing outcomes with `Unknown`; include in volume counts but exclude from outcome ratios. |
| `int_opportunity_last_activity` | Per-opportunity most recent activity date and days-since-last-activity (feeds the stale flag). |

### 4.4 Marts (`dim_*` / `fct_*`) — materialized as **table**

Consumption layer for the notebook and dashboard:

| Model | Grain | Purpose |
|---|---|---|
| `dim_accounts` | account_id | Clean account dimension |
| `dim_reps` | rep_id | Clean rep dimension with ramp metadata |
| `fct_opportunities` | opportunity_id | One row per opp, fully enriched, with stale flag |
| `fct_pipeline_health` | opp × snapshot_month | Stage-aging, slippage, stale-deal flags |
| `fct_rep_attainment` | rep × month | Closed-won ARR vs ramp-adjusted target, attainment % |
| `fct_funnel_conversion` | demand_source × segment × market × month | Stage-to-stage conversion rates and volumes |
| `fct_quarterly_arr` | quarter × market × segment | Closed ARR vs target, EUR gap, pace |

---

## 5. Data quality decisions (to log in `assumptions_log.md`)

The brief intentionally ships `*_raw` and `*_clean` pairs (accounts, opportunities, funnel events). Approach: **trust nothing, re-derive the clean values** in the intermediate layer using `*_raw`, then cross-check my derivation against Pleo's provided `*_clean` to surface where their cleaning is inconsistent.

Decisions to commit to and document:
- Dedupe opportunities — keep earliest `created_at`, drop later record(s)
- Market normalization: `DK / Denmark / DNK → DK`, `DE / Germany / DACH → DACH`, etc.
- Segment normalization: `SMB / Small Business → SMB`, `MM / Mid-Market → Mid-Market`, etc.
- Demand source: build a single mapping table used by both opportunities and funnel events
- Stale flag: open opp with no activity in ≥30 days from `current_date`
- Rep ramp: REP-009 ramping Oct 2025 → full Apr 2026, REP-016 Feb 2026 → full Aug 2026 — apply `ramp_factor` from `Sales Targets` rather than re-deriving
- REP-004 market change Oct 2025 — split attribution by `activity_date` against `market_change_date`
- Missing activity outcomes (~10%) — treat as `Unknown`, count in volume but exclude from outcome ratios

---

## 6. Dashboard strategy ("double level" — CRO hero + supporting detail)

Insight-first. Each headline section leads with a finding stated in plain English, with the EUR value and a verdict, followed by the supporting chart underneath.

### Tier 1 — CRO / VP Sales hero (above the fold)

Single screen, four cards:
1. **Q2 2026 ARR — Pace vs target.** Headline finding + EUR gap + one-line verdict.
2. **Pipeline at risk.** Stale-deal EUR total + count + biggest single-segment concentration.
3. **Rep attainment.** Count below 70% (ramp-adjusted) and count above 100%, with the bottom 3 named.
4. **Funnel conversion.** Top + bottom converting `segment × demand source` pair, with absolute conversion %.

### Tier 2 — Supporting detail (scroll)

- Pipeline health table by region × segment (EUR + deal count + stale share)
- Rep scorecard (attainment %, ramp-adjusted target, deals closed, deals open)
- Funnel by demand source (volumes + conversion rates per stage)
- Weekly stage-aging chart (slippage trend)
- **Action items table** — every recommendation in this format:
  > "DACH Mid-Market has 14 open deals totalling €312K that have had no AE activity in 30+ days. At a 28% historical win rate, re-engaging this week generates an estimated €87K in new ARR within 45 days. Owner: Regional Sales Lead. Action: Pipeline review call by Friday."

Brand styling driven by `design/pleo_theme.css` (CSS variables), populated from Pleo's public brand palette (researched at start of execution).

---

## 7. Automation opportunity to surface

The brief says "There is at least one obvious one in this dataset. Find it." Candidates I'll evaluate during analysis (and pick the strongest with a quantified EUR impact):

- **Stale-deal alerting** — auto-flag any open opp with no activity in ≥30 days, route to rep + manager weekly
- **Source-data hygiene** — the `*_raw` vs `*_clean` mismatch in Pleo's own data suggests upstream entry isn't validated; recommend a CRM picklist constraint
- **Snapshot generation** — Pipeline Snapshots is monthly; weekly would catch slippage earlier
- **Ramp-adjusted target reporting** — currently it appears `monthly_arr_target_eur` and `adjusted_monthly_target_eur` co-exist and aren't always used consistently; standardize on adjusted

---

## 8. Execution sequence

1. Quick web check for Pleo's public brand colors → `design/pleo_brand.md` + `pleo_theme.css`
2. Full Excel inspection (headers, dtypes, null counts, sample values) — commit to final schema before writing models
3. Scaffold dbt project (`dbt_project.yml`, `profiles.yml`, folders, `packages.yml`)
4. Extract seeds from Excel to CSV via Python (this Python script becomes the Part 4 deliverable)
5. Write staging models + per-model `.yml` + `.md` (pure rename/cast)
6. Write intermediate models + per-model `.yml` + `.md` (every business rule)
7. Write marts + per-model `.yml` + `.md` (consumption layer)
8. `dbt build` end-to-end, fix any test failures
9. Write Jupyter analysis notebook — load marts, surface specific findings with EUR / timeframe / owner
10. Build HTML dashboard (CRO hero + drilldown tier) using Pleo theme
11. Write Part 1 data model deliverable, Part 4 SQL queries (≥2-table joins, BigQuery-compatible), AI usage log, assumptions log
12. **Verification pass**: re-run `dbt build`, re-run notebook end-to-end, open the dashboard, cross-check every headline EUR figure against the underlying marts

---

## 9. Out of scope this round

- **Slide deck (Part 3).** Will be built later from the same marts/notebook outputs once you've reviewed the analysis.
- **Supabase / Postgres targets.** DuckDB only, per your instruction.
- **Looker Studio.** Dashboard is HTML.

---

## 10. Open assumptions (will revisit during execution)

- "This quarter" = Q2 2026 (Apr–Jun 2026) since today is 2026-05-14
- Pleo brand colors will be sourced from public material (pleo.io, press kit) and pinned in the design folder before any styling
- Currency: all ARR in EUR per `arr_eur` columns — no FX conversion required
