# Pleo RevOps Performance Analyst — Master Reference

**Author:** Daniel Amezquita · **Email:** daniel.amezquita@affinity.co  
**Stack:** dbt + DuckDB → Jupyter Notebook → React + Recharts  
**Data as of:** 14 May 2026 · Q2 2026 (day 44 of 91 · **48% through the quarter**)  
**Dashboard:** [juandaniel190.github.io/Pleo/](https://juandaniel190.github.io/Pleo/)

---

## Table of Contents

1. [One-Sentence Framing](#1-one-sentence-framing)
2. [Project Overview](#2-project-overview)
3. [Technical Architecture](#3-technical-architecture)
4. [Q2 2026 Performance — The Scoreboard](#4-q2-2026-performance--the-scoreboard)
5. [Historical Performance by Quarter](#5-historical-performance-by-quarter)
6. [Open Pipeline — Gross, Weighted, and At Risk](#6-open-pipeline--gross-weighted-and-at-risk)
7. [Stage Velocity](#7-stage-velocity)
8. [Slippage Trend](#8-slippage-trend)
9. [Pipeline by Market × Segment](#9-pipeline-by-market--segment)
10. [Rep Attainment](#10-rep-attainment)
11. [Funnel Conversion](#11-funnel-conversion)
12. [Demand Source Analysis](#12-demand-source-analysis)
13. [Monday Actions](#13-monday-actions)
14. [Automation Opportunities](#14-automation-opportunities)
15. [Data Quality Findings](#15-data-quality-findings)
16. [Data Model & Technical Architecture Detail](#16-data-model--technical-architecture-detail)
17. [Key Assumptions & Business Definitions](#17-key-assumptions--business-definitions)
18. [AI Usage](#18-ai-usage)

---

## 1. One-Sentence Framing

> **Q2 is six weeks in and the scoreboard reads zero. Every single rep is at 0% — this is a systems failure, not a coaching problem: stale pipeline, no urgency signals, and close dates slipping month after month. The fix is specific and actionable.**

---

## 2. Project Overview

**Challenge:** Take seven raw GTM tables Pleo provided, model them like a production warehouse, and produce outputs that let the CRO and VP of Sales make decisions on Monday morning.

**Four deliverables:**

| Part | Deliverable | Status |
|---|---|---|
| 1 | Data model — schema, PKs/FKs, assumptions | ✅ Done — `deliverables/01_data_model.md` |
| 2 | Dashboard for VP of Sales | ✅ Done — single-HTML React + Recharts at `dashboard/index.html` |
| 3 | Five-slide CRO/VP Sales deck (PPTX) | ⏳ Deferred |
| 4 | BigQuery-compatible SQL queries + Python validation script | ✅ Done — `deliverables/04_sql_queries/` + `deliverables/04_python_script.py` |

**dbt build result:** `Done. PASS=49 WARN=0 ERROR=0`

**Source data:** 7 raw tables from Excel (~1,300 rows total)
- `raw_accounts` (~40 rows)
- `raw_opportunities` (~130 rows, 1 intentional duplicate)
- `raw_pipeline_snapshots` (~185 rows)
- `raw_funnel_events` (~275 rows)
- `raw_sales_targets` (~464 rows)
- `raw_rep_roster` (16 rows)
- `raw_activity_data` (~237 rows)

---

## 3. Technical Architecture

### Layer structure

```
seeds/ (raw CSVs)
  └── staging/     (rename + cast only — views)
        └── intermediate/   (all business logic — views)
              └── marts/core/   (consumption layer — tables)
```

**Staging** — pure rename and type-cast. No joins, no aggregations, no Jinja. Two macros:
- `parse_date` — handles ISO + DD/MM/YYYY + YYYY-MM in the same column
- `parse_percent` — strips `%` and casts to INT (input forced to varchar first)

**Intermediate** — every business rule lives here:

| Model | What it does |
|---|---|
| `int_accounts_standardized` | Resolve market, segment, country inconsistencies from `*_raw` fields |
| `int_opportunities_deduped` | Remove OPP-127 duplicate (keep earliest `created_at`) |
| `int_opportunities_enriched` | Join opps to accounts and reps; derive canonical stage, demand source, forecast category |
| `int_pipeline_stage_history` | Stage age, slippage between snapshots, stage transitions per opp |
| `int_funnel_events_standardized` | Normalize demand source labels for consistent joins |
| `int_rep_quota_ramped` | Apply ramp factor to monthly quota (REP-009, REP-016); handle REP-004 market change Oct 2025 |
| `int_activity_outcomes_filled` | Fill ~10% null outcomes with `Unknown`; add `is_outcome_known` flag |
| `int_opportunity_last_activity` | Per-opp most recent activity date + days-since-last-activity (feeds stale flag) |

**Marts** — tables, consumed by notebook and dashboard:

| Model | Grain | Purpose |
|---|---|---|
| `dim_accounts` | account_id | Clean account dimension |
| `dim_reps` | rep_id | Clean rep dimension with ramp metadata |
| `fct_opportunities` | opportunity_id | One row per opp, fully enriched, with stale flag |
| `fct_pipeline_health` | opportunity_id (open only) | Stage age, slippage, weighted ARR |
| `fct_rep_attainment` | rep × month | Closed-won vs ramp-adjusted target, QTD totals |
| `fct_funnel_conversion` | demand_source × segment × market × month | Stage-to-stage conversion rates |
| `fct_quarterly_arr` | quarter × market × segment | Closed ARR vs target, EUR gap, attainment % |

**Dashboard** — single self-contained HTML file. CDN React 18 + Babel + Recharts + Tailwind. All data hardcoded as JS literals. No build step, no npm install. Deployable to GitHub Pages directly.

---

## 4. Q2 2026 Performance — The Scoreboard

> **Q2 runs 1 Apr → 30 Jun (91 days). As of 14 May 2026 we are on day 44 — 48% through the quarter.**

| KPI | Value | Verdict |
|---|---|---|
| Q2 ramp-adjusted target | **€310,600** | What the team committed to close by 30 June |
| Q2 closed-won so far | **€0** | Nothing booked in Q2 yet |
| Gap to target | **–€310,600** | The full target remains open |
| Q2-closing pipeline (gross) | **€854,000** | Open opps with a Q2 close date — face value |
| Q2-closing pipeline (weighted) | **€255,350** | Same × each deal's close probability |
| Gap even if weighted lands 100% | **–€55,250** | Weighted alone is not enough to hit target |
| Recovery upside from re-engaging stale | **+€44,000** | Conservative floor (see Section 14) |

**The story in one read:** Q2 is RED. Even if every probability-weighted deal closes on time — which they are not — we still miss the target by €55K. The weighted pipeline is deteriorating as close dates slip. The single biggest controllable lever this week is the stale pipeline.

---

## 5. Historical Performance by Quarter

**Quarterly totals — target vs closed ARR:**

| Quarter | Target | Closed ARR | Deals | Attainment |
|---|---:|---:|---:|---:|
| Q1 2024 | €480,000 | €309,000 | 5 | **64.4%** |
| Q2 2024 | €480,000 | €81,000 | 2 | 16.9% |
| Q3 2024 | €480,000 | €45,000 | 1 | 9.4% |
| Q4 2024 | €480,000 | €14,000 | 1 | 2.9% |
| Q1 2025 | €480,000 | €155,000 | 4 | 32.3% |
| Q2 2025 | €480,000 | €162,000 | 1 | 33.8% |
| Q3 2025 | €480,000 | €157,000 | 2 | 32.7% |
| Q4 2025 | €480,000 | €24,000 | 1 | 5.0% |
| Q1 2026 | €480,000 | €117,000 | 1 | 24.4% |
| **Q2 2026** | **€310,600** | **€0** | **0** | **0%** |

**Key pattern — closed-won by day 44 of the quarter:**

| Quarter | By day 44 | Full quarter | Observation |
|---|---|---|---|
| Q2 2024 | 1 deal · €27K | 2 deals · €81K | Slow start, weak finish |
| Q3 2024 | 0 deals · €0 | 1 deal · €45K | Slow start, late close |
| Q4 2024 | 1 deal · €14K | 1 deal · €14K | Whole quarter in first half |
| Q1 2025 | 1 deal · €16K | 4 deals · €155K | Slow start, strong finish |
| Q2 2025 | 1 deal · €162K | 1 deal · €162K | One big deal carried the quarter |
| Q3 2025 | 0 deals · €0 | 2 deals · €157K | Slow start, strong finish |
| Q4 2025 | 1 deal · €24K | 1 deal · €24K | Anaemic |
| Q1 2026 | 1 deal · €117K | 1 deal · €117K | Whole quarter in first half (K. Nguyen) |
| **Q2 2026** | **0 deals · €0** | ? | **Worst start of any quarter in the dataset** |

> **Headline:** By day 44 of every recent quarter, at least one deal had closed. Q2 2026 is the first quarter in two years with zero deals at this checkpoint.

**Structural pattern:** Q1 2026 at 24% attainment looks like a recovery from Q4 2025's 5%, but it was entirely from one rep (K. Nguyen, one deal, €117K). Strip K. Nguyen out and every other rep collectively closed zero in Q1. Q2 is confirming that pattern.

**Q2 2026 target breakdown by market and segment:**

| Market | Segment | Target |
|---|---|---:|
| UK | Enterprise | €58,000 |
| UK | Mid-Market | €34,000 |
| DE | Enterprise | €32,000 |
| NL | Enterprise | €28,000 |
| DK | Enterprise | €26,000 |
| SE | Enterprise | €26,000 |
| ES | Enterprise | €24,000 |
| DE | Mid-Market | €20,000 |
| NL | Mid-Market | €16,000 |
| ES | Mid-Market | €14,000 |
| UK | SMB | €10,000 |
| DE | SMB | €10,000 |
| ES | SMB | €8,000 |
| SE | Mid-Market | €4,600 |
| **Total** | | **€310,600** |

---

## 6. Open Pipeline — Gross, Weighted, and At Risk

**All open opportunities (47 total):**

| Metric | Value |
|---|---:|
| Total open opportunities | 47 |
| Total gross ARR | **€1,832,000** |
| Total weighted ARR | **€534,100** |
| Q2-closing opportunities | 28 |
| Q2-closing gross ARR | **€854,000** |
| Q2-closing weighted ARR | **€255,350** |

**At-risk pipeline:**

| Problem type | Deals | ARR | Meaning |
|---|---:|---:|---|
| **Stale** (no activity ≥30 days) | **34** | **€1,341,000** | Deals dying in silence |
| **Slipped** (close date pushed later) | **9** | **€405,000** | Actively deferred by rep |
| **Stuck >90 days in same stage** | **23** | **€785,000** | Structurally unlikely to close this quarter |

**Reading weighted vs gross:** The weighted/gross ratio across the full open book is **29%** (€534K / €1,832K). In healthy pipelines, weighted coverage of 3–4× target with a ratio above 40% is normal. Here, the 29% ratio signals either over-pipelining or systematically pessimistic close probabilities — both are forecast quality problems.

**The biggest single deal at risk:**
> **Wise · J. Patel · UK Enterprise · €161,000 · 85 days with zero AE activity.** Single largest at-risk deal in the whole book. Manager touch before any other action this week.

---

## 7. Stage Velocity

Average days an open deal has been sitting in its current stage (as of May 2026):

| Stage | Avg Days Stuck |
|---|---:|
| Initial Meeting | **114.8 days** |
| Contracting | **110.7 days** |
| Qualified | **98.8 days** |
| Business Validation | 90.2 days |
| Discovery | 64.7 days |
| Evaluation | 50.3 days |
| Negotiation | 25.5 days |

**Critical nuance:** This is not "how long does a deal take to move between stages" — it is "how long have the current open deals been sitting in each stage right now." It measures how stuck deals are today, not a historical cycle time benchmark.

**The insight:** If the average deal in "Initial Meeting" has been there for 114 days, and a healthy end-to-end sales cycle is 60–90 days total, then many of these deals have already spent their entire allotted sales cycle in a single early stage. They are structurally unlikely to close this quarter.

**Where to act first:** Initial Meeting (114d) and Qualified (99d) are the two heaviest stages and also hold the bulk of the stale pipeline. A stage-exit-criteria review — what specifically defines "Initial Meeting" and what must be true to call something "Qualified" — would compress the cycle most.

---

## 8. Slippage Trend

**Slippage rate** = % of open opportunities per snapshot where the expected close date was pushed to a later period. A rising slip rate means reps are not committing to close dates and is the leading indicator of future forecast misses.

| Snapshot | Deals Slipped | Total Open | Slip Rate |
|---|---:|---:|---:|
| Sep 2025 | 0 | 1 | 0.0% |
| Jan 2026 | 0 | 3 | 0.0% |
| Feb 2026 | 1 | 34 | 2.9% |
| Mar 2026 | 4 | 43 | 9.3% |
| Apr 2026 | 8 | 53 | **15.1%** |
| May 2026 | 9 | 47 | **19.1%** |

**This is the single most worrying trend in the data.** Slip rate went from 0% to 19% in four months. Forecast quality is deteriorating month-over-month, not just at one point in time. At 19%, roughly 1 in 5 open deals will roll to the next month at every snapshot. Combined with zero new closes in Q2, the pipeline is actively decaying.

---

## 9. Pipeline by Market × Segment

### Stale ARR (€) by Market × Segment

| Market | SMB | Mid-Market | Enterprise | **Total** |
|---|---:|---:|---:|---:|
| **UK** | 18,000 | **296,000** | **161,000** | **475,000** |
| **NL** | 30,000 | **199,000** | 95,000 | **324,000** |
| **ES** | 17,000 | **151,000** | — | **168,000** |
| **DE** | 17,000 | **141,000** | — | **158,000** |
| **DK** | 28,000 | 49,000 | **110,000** | **187,000** |
| **SE** | 29,000 | — | — | **29,000** |
| **Total** | **139,000** | **836,000** | **366,000** | **€1,341,000** |

**Read:** Mid-Market is where the stalled money lives — €836K, **62% of all stale ARR**. UK and NL Mid-Market together = €495K, a third of the entire stale pool in just two cells. That is the surgical re-engagement target.

### Open Pipeline — Gross ARR (€) / Weighted ARR (€)

| Market | SMB | Mid-Market | Enterprise | **Total** |
|---|---|---|---|---|
| **UK** | 38K / 10K | 296K / 117K | 231K / 53K | **565K / 180K** |
| **DE** | 51K / 14K | 276K / 160K | — | **327K / 174K** |
| **NL** | 30K / 7K | 199K / 29K | 95K / 10K | **324K / 46K** |
| **ES** | 17K / 2K | 177K / 26K | 167K / 33K | **361K / 61K** |
| **DK** | 28K / 7K | 49K / 10K | 110K / 50K | **187K / 67K** |
| **SE** | 29K / 6K | 39K / 2K | — | **68K / 8K** |
| **Total** | **193K / 46K** | **1,036K / 344K** | **603K / 146K** | **1,832K / 536K** |

**Three things this table tells you:**
1. **Mid-Market is the engine** — 57% of gross pipeline (€1,036K of €1,832K).
2. **The weighted/gross ratio is collapsing.** Overall 29% — in some cells as low as 10–15%. The pipeline looks large on paper; in reality most of it is low-confidence.
3. **UK Mid-Market** (€117K weighted) is the only cell with meaningful Q2-closable weight. If those deals go dark, the quarter collapses entirely.

---

## 10. Rep Attainment

**Q2 2026: Every single rep is at 0% attainment.**

| Rep | Market | Segment | Team | Q2 QTD Target (to May) | Q2 Closed | Attainment |
|---|---|---|---|---:|---:|---:|
| S. Andersen (REP-001) | UK | Enterprise | Team UKI | €30,000 | €0 | 0% |
| N. Walsh (REP-002) | UK | Enterprise | Team UKI | €28,000 | €0 | 0% |
| M. Eriksson (REP-003) | UK | Mid-Market | Team UKI | €18,000 | €0 | 0% |
| L. Dubois (REP-004) | UK | Mid-Market | Team UKI | €16,000 | €0 | 0% |
| J. Patel (REP-005) | UK | SMB | Team UKI | €10,000 | €0 | 0% |
| N. Weber (REP-006) | DE | Enterprise | Team DACH | €32,000 | €0 | 0% |
| T. Brauer (REP-007) | DE | Mid-Market | Team DACH | €20,000 | €0 | 0% |
| E. Lindqvist (REP-008) | SE | Enterprise | Team Nordics | €26,000 | €0 | 0% |
| S. Muller (REP-009) | SE | Mid-Market | Team Nordics | €4,600 | €0 | 0% (ramping) |
| P. Van Berg (REP-010) | NL | Enterprise | Team Benelux | €28,000 | €0 | 0% |
| F. Jacobs (REP-011) | NL | Mid-Market | Team Benelux | €16,000 | €0 | 0% |
| C. Rossi (REP-012) | DK | Enterprise | Team Nordics | €26,000 | €0 | 0% |
| I. Garcia (REP-013) | ES | Mid-Market | Team South | €14,000 | €0 | 0% |
| O. Svensson (REP-014) | ES | SMB | Team South | €8,000 | €0 | 0% |
| A. Kowalski (REP-015) | DE | SMB | Team DACH | €10,000 | €0 | 0% |
| K. Nguyen (REP-016) | ES | Enterprise | Team South | €24,000 | €0 | 0% |

**This is a system problem, not a coaching problem.** When one rep underperforms, you set up a coaching call. When 16 reps from 6 markets across 3 segments all sit at 0% simultaneously, the question is not "which rep is weak?" — it's "what is the system doing to them?"

**The answer:** reps are sitting on stale pipeline with no urgency signal and no clear exit criteria to move deals forward. The weekly review should shift from rep-level coaching to deal-by-deal triage of the 34 stale opportunities.

**Q1 2026 context:** K. Nguyen closed €117K at 325% of their monthly target in Q1. That was one person closing one deal. Strip it out and every other rep was at zero in Q1 too.

---

## 11. Funnel Conversion

**Monthly volumes — trailing 6 months (all markets, all segments):**

| Month | Leads | MQL | SQL | Demo | Opp | Won |
|---|---:|---:|---:|---:|---:|---:|
| Dec 2025 | 5 | 2 | 0 | 1 | 1 | 1 |
| Jan 2026 | 3 | 0 | 3 | 0 | 4 | 1 |
| Feb 2026 | 4 | 2 | 1 | 1 | 0 | 0 |
| Mar 2026 | 6 | 2 | 1 | 2 | 0 | 0 |
| Apr 2026 | 1 | 3 | 3 | 1 | 1 | 0 |
| May 2026 (MTD) | 3 | 2 | 3 | 1 | 0 | 1 |

**Stage diagnosis:**

| Stage | Signal | Diagnosis |
|---|---|---|
| Lead generation | Thin since Mar (1–3/mo vs 4–6 before) | **Top of funnel is starving** |
| Lead → MQL | Holds up when leads arrive | Marketing quality is not the problem |
| MQL → SQL | Stable | SDR qualification is working |
| Demo → Opp | Feb/Mar produced demos, zero new opps | Sales-stage issue — demos not converting |
| Opp → Won | Zero or one per month for 6 straight months | Consistent with system-level attainment story |

**Key insight:** The Demo → Opp collapse in Feb/Mar is the most actionable signal. Demos were happening but no new opportunities were being created from them. Either the ICP qualification upstream of demos is off, or the demo itself isn't generating enough internal urgency with the prospect to formalize a deal.

---

## 12. Demand Source Analysis

**Average Selling Price (ASP) by demand source — all closed-won deals:**

| Demand Source | Avg ARR | Total Won ARR | Deals Won |
|---|---:|---:|---:|
| **Partnerships** | **€93,600** | €468,000 | 5 |
| **Marketing (inbound)** | **€68,000** | €340,000 | 5 |
| SDR Outbound | €32,200 | €161,000 | 5 |
| AE Outbound | €31,667 | €95,000 | 3 |

**The implication for resource allocation:** Outbound generates more deal volume but at 34% of the contract value of partnerships. If the goal is to hit a €310K quarterly target with fewer, larger deals, the ROI points toward growing Partnership and Marketing-sourced pipeline — not more SDR volume.

**Partnership deals convert at the highest rate and carry the highest ASP.** A 3× ASP difference (€93.6K vs €31.7K) means one partnership-sourced deal is equivalent to three SDR-sourced deals in ARR terms. Marketing (inbound) at €68K is similarly high-value relative to outbound.

---

## 13. Monday Actions

Five actions, each specific, owned, time-bound, and with a EUR value:

| # | Action | Owner | EUR Value | When |
|---|---|---|---|---|
| 1 | Manager phone call on **Wise** (J. Patel · UK Enterprise · €161K · 85 days silent) | UK Sales Lead | €161K at-risk deal | **This week** |
| 2 | **UK Mid-Market re-engagement sprint** — 6 deals · €296K stale · block AE diaries for opp reviews | UK Sales Lead | ~€10K recovered ARR | **45 days** |
| 3 | Automated **weekly stale-deal alert** — auto-flag open opps with no activity in ≥30 days, route to rep + manager | RevOps | +€44K recovered ARR (model) | **45 days** |
| 4 | **Lock CRM picklists** on segment, market, demand source, and stage — `segment_raw` currently has 11 values for 3 canonical segments | RevOps + Sales Ops | Analyst time saved + forecast trust | **This sprint** |
| 5 | **Open Q2 contingency review with Finance** — flip the RAG to RED, €310K target at risk with 47 days left | CRO | €310K target awareness | **This week** |

**Framing for the room:** *"We are not here to diagnose — we already know what is wrong. We are here to put names next to these five lines and leave with owners."*

---

## 14. Automation Opportunities

### Automation 1 — Weekly stale-deal alerting

**The problem:** 34 open deals worth €1,341,000 have had no AE activity in 30+ days. These deals are dying in silence. No one is being alerted.

**The automation:** At the end of every week, query `fct_opportunities` for any open opp where `days_since_last_activity >= 30`. Send a digest to the owning rep and their manager with: deal name, ARR, days silent, last known stage, and the next step on file (if any).

**The math:**
- Stale ARR at risk: €1,341,000
- Assumed re-engagement rate: 15% (1 in 7 stale deals responds and re-enters the funnel — conservative)
- Historical win rate on re-engaged deals: ~22% (from all closed-won since 2024)
- **Recovered ARR: €1,341,000 × 15% × 22% = ~€44,000 in 45 days**

€44K is a conservative floor, not a ceiling. The real value of re-engagement is protecting Q3: act now and a slipping deal stays in the forecast; do nothing and it silently disappears.

### Automation 2 — CRM picklist hardening

**The problem:** `segment_raw` has **11 distinct values** for what should be 3 canonical segments (SMB, Mid-Market, Enterprise). Market and country fields have similar drift. This means:
- Pipeline reports by segment are directionally wrong
- Every analyst has to reconcile labels before producing a number — recurring waste
- Forecast calls using segment rollups are dirty

**The automation:** Lock the CRM entry picklists at the source — force reps to choose from a fixed list when creating or updating an account, opportunity, or contact. Takes one sprint to implement; eliminates a class of data quality debt permanently.

**Evidence:** 2 of 40 accounts have a market label disagreement between Pleo's pre-cleaned field and our canonical re-derivation from raw. The disagreement is auditable via `*_drift` boolean columns in the marts.

---

## 15. Data Quality Findings

All issues found during the build and exposed via `*_drift` flags and assumption logs:

| # | Issue | Severity | Decision |
|---|---|---|---|
| 1 | OPP-127 appears twice in `raw_opportunities` | Medium | Keep earliest `created_at`; drop the later row |
| 2 | `segment_raw` has 11 distinct values for 3 canonical segments | **High** | Re-derive canonical from `*_raw` via deterministic mapping; expose `segment_drift` flag |
| 3 | `country_raw` and `region_raw` use inconsistent labels (ISO codes + full names + market codes) | **High** | Re-derive canonical market from `country_raw` via mapping table |
| 4 | 2 accounts have market label drift (Pleo's clean field disagrees with canonical re-derivation) | Medium | Trust re-derivation; flag drift via `market_drift` boolean |
| 5 | ~50% of date columns in DD/MM/YYYY, ~50% in ISO format in the same column | **High** | Force to `varchar` at seed layer; `parse_date` macro normalizes in staging |
| 6 | `close_probability_pct` is a string with `%` suffix | Low | Force to `varchar` at seed; `parse_percent` macro strips and casts |
| 7 | ~10% of `outcome` in `raw_activity_data` is null | Medium | Coalesce to `'Unknown'`; add `is_outcome_known` flag; exclude from outcome rate denominators |
| 8 | 50 activity rows have null `opportunity_id` (pre-opp SDR outreach) | Low | Preserve; flag as `is_pre_opp_activity` |
| 9 | `closed_lost_reason` has 19 free-text values for ~5 underlying reasons | Medium | Collapse to: Competitor / Price / Product Gap / Timing / No Decision |
| 10 | `stage_raw` has free-text variance (codes + names) for the same 9 canonical stages | Medium | Map to 9 canonical stages via `normalize_label` macro |

**CRM hygiene as a revenue problem:** Bad segment labels mean pipeline reports are wrong — you cannot trust "UK Mid-Market pipeline" if 20% of those deals are mislabeled SMB. Forecast calls using segment rollups are directionally wrong whenever the underlying labels drift.

---

## 16. Data Model & Technical Architecture Detail

### Source relationships

```
raw_accounts (account_id) ◂──┬──┬──┬─── raw_opportunities (account_id)
                             │  │  └─── raw_funnel_events (account_id)
                             │  └────── raw_activity_data (account_id)
raw_rep_roster (rep_id)  ◂───┼──┬──┬──┬─── raw_opportunities (owner_id)
                             │  │  │  └─── raw_pipeline_snapshots (owner_id)
                             │  │  └────── raw_funnel_events (rep_id)
                             │  └───────── raw_sales_targets (rep_id)
                             └──────────── raw_activity_data (rep_id)
raw_opportunities (opportunity_id) ◂─┬─── raw_pipeline_snapshots (opportunity_id)
                                     └─── raw_activity_data (opportunity_id, nullable)
```

All FKs are 1-to-many. `raw_activity_data.opportunity_id` is **nullable** (50 rows of pre-opp SDR outreach recorded at account level before an opportunity exists).

### Rep roster (16 reps)

| Team | Reps | Markets |
|---|---|---|
| Team UKI | REP-001, REP-002, REP-003, REP-004, REP-005 | UK |
| Team DACH | REP-006, REP-007, REP-015 | DE |
| Team Nordics | REP-008, REP-009, REP-012 | SE, DK |
| Team Benelux | REP-010, REP-011 | NL |
| Team South | REP-013, REP-014, REP-016 | ES |

**Ramping reps:**
- REP-009 (S. Muller): ramp Oct 2025 → full productivity Apr 2026
- REP-016 (K. Nguyen): ramp Feb 2026 → full productivity Aug 2026

**Mid-period market change:**
- REP-004 (L. Dubois): market change Oct 2025. Attribution splits on `activity_date` vs `market_change_date`.

### Key design rules (do not violate)

1. Staging = rename + cast only. No joins, no Jinja, no aggregations.
2. All business logic in `intermediate/`. Never in staging or Python.
3. Seeds → staging via `ref()`, not `source()`. This is what lets `dbt build` order the DAG correctly.
4. No external dbt packages. Two local macros only: `parse_date`, `parse_percent`.
5. Per-model `config()` blocks: staging=view, intermediate=view, marts=table.
6. Per-model `.yml` schema files. No `.md` docblock files (removed).
7. `UK` as the market label, not `UKI`. Source uses UKI; renamed in `int_accounts_standardized`.
8. Dashboard is a single self-contained HTML. All data hardcoded as JS literals. No build step.
9. `pleo.duckdb` is at `/tmp/pleo.duckdb` by default. Override with `DBT_DUCKDB_PATH`.
10. No data transforms in Python. `04_python_script.py` extracts raw Excel to CSV only.

### How to run end-to-end

```bash
# 1. Environment
python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt

# 2. Build the warehouse (expect: PASS=49 WARN=0 ERROR=0)
python deliverables/04_python_script.py
cd dbt_pleo && DBT_PROFILES_DIR=. dbt build --full-refresh && cd ..

# 3. Run the analysis notebook
jupyter nbconvert --to notebook --execute analysis/revops_analysis.ipynb \
    --output revops_analysis.ipynb

# 4. Rebuild the dashboard
python dashboard/build_dashboard.py

# 5. Serve locally
python3 -m http.server 8000 --directory dashboard
# → http://localhost:8000
```

**Common errors:**

| Symptom | Fix |
|---|---|
| `Could not convert string "DD/MM/YYYY" to DATE` | Stale target dir — run `dbt clean && dbt build --full-refresh` |
| `replace(INTEGER, …)` binder error | Same root cause — `dbt clean && dbt build --full-refresh` |
| `IO Error: Could not remove file ".duckdb.wal"` | DuckDB locked by another process — close it and `rm /tmp/pleo.duckdb*` |
| Dashboard charts blank | CDN issue — open browser DevTools console; check Recharts / Tailwind loads |

### SQL deliverables (BigQuery-compatible)

| Query | Purpose |
|---|---|
| `01_q2_pace_vs_target.sql` | Q2 2026 pace vs ramp-adjusted target by market × segment |
| `02_stale_pipeline_callsheet.sql` | Stale-deal call sheet sorted by ARR — the Monday morning to-do list |
| `03_rep_attainment_q2_2026.sql` | Q2 rep attainment, ramp-adjusted, with ramp status |
| `04_funnel_conversion_by_demand_source.sql` | Lead → won conversion by demand source × segment (trailing 12 months) |
| `05_close_date_slippage_trend.sql` | Month-over-month close-date slippage on open deals |

---

## 17. Key Assumptions & Business Definitions

| # | Definition / Decision | Choice |
|---|---|---|
| 1 | **"Stale" deal** | Open opp with `days_since_last_activity >= 30` (or no activity at all) — matches the brief's worked example |
| 2 | **Analysis-as-of date** | `current_date` by default; override via `dbt run --vars '{analysis_as_of_date: "2026-05-14"}'` |
| 3 | **Effective monthly target** | `adjusted_monthly_target_eur` when present, else `monthly_arr_target_eur × ramp_factor` (ramp_factor coalesced to 1.0) |
| 4 | **Weighted ARR** | `arr_eur × close_probability_pct / 100`. Null probabilities treated as 0. |
| 5 | **OPP-127 duplicate** | Keep earliest `created_at`; drop the later row |
| 6 | **Market canonical label** | `UK` (not `UKI`). Pleo's source uses UKI; renamed in `int_accounts_standardized` |
| 7 | **Quarter format** | `'Q2 2026'` (with space) everywhere — matches source format in `raw_sales_targets.quarter` |
| 8 | **Currency** | All ARR is EUR per `arr_eur` columns. No FX conversion needed. |
| 9 | **Pre-opp activity** | Preserved (null `opportunity_id`); flagged `is_pre_opp_activity` |
| 10 | **Missing activity outcomes (~10%)** | Coalesced to `'Unknown'`; counted in volume but excluded from outcome rate denominators |
| 11 | **REP-004 market change** | Preserved as a rep dimension attribute; attribution splits on `activity_date` vs `market_change_date` |
| 12 | **Closed-lost reason** | 19 free-text values collapsed to 5: Competitor / Price / Product Gap / Timing / No Decision |
| 13 | **Segment canonical set** | 3 values: SMB, Mid-Market, Enterprise. `segment_raw`'s 11 distinct values mapped via `normalize_label` |

**Things deliberately NOT done:**
- Did not impute missing activity outcomes from `notes` text (risk of confirmation bias)
- Did not surrogate-key the snapshot table — composite `(snapshot_month, opportunity_id)` is the natural PK
- Did not aggregate funnel events at opportunity grain — funnel events are a separate signal source, not all tie to an opp
- Did not split REP-004 attainment by market in the headline scorecard (clean reads better; the data supports the split on demand)
- Did not use Jinja in any staging model

---

## 18. AI Usage

**Tools used:** Claude (Anthropic) — Claude Code.

**Where AI helped:**
- Scaffolding the dbt project (folders, `dbt_project.yml`, `profiles.yml`, package list)
- Writing per-model `.yml` schema files — tedious and repetitive, exactly where AI shines
- Drafting the Excel→CSV Python extraction script — dictated the validation rules (which PKs, which FK checks); AI wrote the loop
- Generating the HTML dashboard scaffold (CSS layout, Recharts wiring) — specified two-tier layout and four hero KPI cards
- Dashboard narrative and storytelling refinement across multiple iterations

**Where Daniel made the judgment call:**
- Defining the staging / intermediate / marts split and what belongs in each layer (driven by feedback from a prior project)
- The 30-day stale threshold (matching the brief's worked example)
- The OPP-127 deduplication rule (keep earliest `created_at`)
- Deciding to re-derive canonical labels from `*_raw` rather than trust Pleo's pre-cleaned columns — and exposing `*_drift` flags so every disagreement is auditable
- The recovery math (15% re-engagement × 22% historical win rate) and which figures land in the hero cards
- The story arc — pace, risk, attainment, funnel, automation — and what counts as a finding vs noise
- The "lock CRM picklists" automation recommendation, sourced from seeing `segment_raw` has 11 values for 3 canonical segments

**Time saved vs done manually:** ~3–4 hours of mechanical work (scaffolding, schema files, dashboard styling) redirected toward analysis decisions and the assumptions log.

---

*Data source: dbt + DuckDB on Pleo synthetic dataset · Dashboard as of 14 May 2026 · Author: Daniel Amezquita · daniel.amezquita@affinity.co*
