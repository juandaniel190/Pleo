# Part 1 — Data model

A production data warehouse on BigQuery (or any modern columnar warehouse — DuckDB locally for this exercise) would land the seven Pleo tabs as immutable raw tables and re-shape them through a three-layer dbt project: **staging → intermediate → marts**. The schema below is what each table looks like at every layer, and the relationships that hold across them.

## 1. Source schema (raw landing)

Loaded from CSVs extracted from the Excel workbook. No transformation — just types and rename.

### `raw_accounts` — ~40 rows. **PK:** `account_id`

| Column | Type | Notes |
|---|---|---|
| `account_id` | STRING | PK |
| `account_name` | STRING |
| `country` | STRING | Pre-cleaned by Pleo |
| `country_raw` | STRING | Inconsistent mix of ISO codes and country names |
| `market` | STRING | Pleo's clean market label |
| `region_raw` | STRING | Mix of country, market, region labels |
| `segment` | STRING | Pleo's clean segment |
| `segment_raw` | STRING | 11 distinct values for 3 canonical segments |
| `industry` | STRING |
| `employee_count` | INT64 |
| `created_date` | DATE | DD/MM/YYYY mixed with ISO — normalised at ingestion |

### `raw_opportunities` — ~130 rows. **PK:** `opportunity_id` *(currently violated — 1 known duplicate)*

| Column | Type | Notes |
|---|---|---|
| `opportunity_id` | STRING | PK after dedup |
| `account_id` | STRING | FK → `raw_accounts.account_id` |
| `owner_id` | STRING | FK → `raw_rep_roster.rep_id` |
| `stage_raw` | STRING | Free-text variance |
| `stage_clean` | STRING | Pleo's 9-stage canonical set |
| `arr_eur` | FLOAT64 | All ARR in EUR — no FX needed |
| `demand_source_raw` | STRING |
| `demand_source_clean` | STRING |
| `close_date` | DATE |
| `created_date` | DATE |
| `forecast_category` | STRING |
| `close_probability_pct` | INT64 | `%` stripped at ingestion |
| `closed_lost_reason` | STRING | Free-text |
| `sales_cycle_days` | INT64 |
| `created_at` | TIMESTAMP | Used to break dup tie |

### `raw_pipeline_snapshots` — ~185 rows. **PK:** `(snapshot_month, opportunity_id)`

| Column | Type | Notes |
|---|---|---|
| `snapshot_month` | DATE | First of month |
| `opportunity_id` | STRING | FK → `raw_opportunities.opportunity_id` |
| `stage_at_snapshot` | STRING |
| `arr_at_snapshot` | FLOAT64 |
| `forecast_cat_at_snapshot` | STRING |
| `close_date_at_snapshot` | DATE |
| `stage_age_days` | INT64 |
| `next_step_date` | DATE | ~50% null |
| `owner_id` | STRING | FK → `raw_rep_roster.rep_id` |

### `raw_funnel_events` — ~275 rows. **PK:** `event_id`

| Column | Type | Notes |
|---|---|---|
| `event_id` | STRING | PK |
| `event_month` | DATE |
| `account_id` | STRING | FK → `raw_accounts.account_id` |
| `rep_id` | STRING | FK → `raw_rep_roster.rep_id` |
| `event_type` | STRING | Lead Created / MQL / SQL / Demo Completed / Opportunity Created / Closed Won / Closed Lost |
| `demand_source_raw` | STRING |
| `demand_source_clean` | STRING |
| `segment` | STRING |
| `market` | STRING |
| `arr_eur` | FLOAT64 |

### `raw_sales_targets` — ~464 rows. **PK:** `target_id`. Grain: `(rep_id, target_month)`

| Column | Type | Notes |
|---|---|---|
| `target_id` | STRING | PK |
| `target_month` | DATE |
| `target_year` | INT64 |
| `quarter` | STRING | e.g. `Q2 2026` |
| `rep_id` | STRING | FK → `raw_rep_roster.rep_id` |
| `rep_name` | STRING | Denormalised |
| `region` | STRING |
| `market` | STRING |
| `segment` | STRING |
| `monthly_arr_target_eur` | FLOAT64 |
| `ramp_factor` | FLOAT64 | <1 for ramping reps |
| `adjusted_monthly_target_eur` | FLOAT64 | = monthly × ramp_factor |

### `raw_rep_roster` — 16 rows. **PK:** `rep_id`

| Column | Type | Notes |
|---|---|---|
| `rep_id` | STRING | PK |
| `rep_name` | STRING |
| `market` | STRING |
| `segment` | STRING |
| `team` | STRING | 5 teams: DACH, Nordics, UKI, Benelux, South |
| `ramp_status` | STRING | Active / Ramping |
| `rep_start_date` | DATE |
| `annual_quota_eur` | FLOAT64 |
| `market_change_date` | DATE | Set for REP-004 (Oct 2025) |
| `prior_market` | STRING | Set for REP-004 |
| `ramp_start_month` | DATE | Set for REP-009 (Oct 2025) and REP-016 (Feb 2026) |
| `full_productivity_month` | DATE | REP-009 Apr 2026, REP-016 Aug 2026 |
| `notes` | STRING |

### `raw_activity_data` — ~237 rows. **PK:** `activity_id`

| Column | Type | Notes |
|---|---|---|
| `activity_id` | STRING | PK |
| `activity_date` | DATE |
| `rep_id` | STRING | FK → `raw_rep_roster.rep_id` |
| `account_id` | STRING | FK → `raw_accounts.account_id` |
| `opportunity_id` | STRING | FK → `raw_opportunities.opportunity_id`, nullable (50 rows — pre-opp SDR outreach) |
| `activity_type` | STRING | Call / Email / Meeting / Demo / LinkedIn |
| `outcome` | STRING | ~10% null |
| `notes` | STRING |

## 2. Relationships

```
raw_accounts (account_id) ◂──┬──┬──┬─── raw_opportunities (account_id)
                             │  │  └─── raw_funnel_events (account_id)
                             │  └────── raw_activity_data (account_id)
                             │
raw_rep_roster (rep_id) ◂────┼──┬──┬──┬─── raw_opportunities (owner_id)
                             │  │  │  └─── raw_pipeline_snapshots (owner_id)
                             │  │  └────── raw_funnel_events (rep_id)
                             │  └───────── raw_sales_targets (rep_id)
                             └──────────── raw_activity_data (rep_id)

raw_opportunities (opportunity_id) ◂─┬─── raw_pipeline_snapshots (opportunity_id)
                                     └─── raw_activity_data (opportunity_id, nullable)
```

All FKs are 1-to-many. The `raw_activity_data.opportunity_id` FK is **nullable** because pre-opp SDR outreach is recorded at the account before an opportunity exists.

## 3. Modelling layers (what each layer adds)

### Staging — `stg_pleo__<entity>`
View materialisation. Pure renaming and type-casting only. No joins, no Jinja, no business logic. Both `*_raw` and `*_clean` columns are carried forward.

### Intermediate — `int_<concept>`
View materialisation. All business logic lives here:
- Re-derive canonical labels (country, market, segment, stage, demand source) from `*_raw` using deterministic mappings — and surface drift vs Pleo's pre-clean values
- Dedupe opportunities (OPP-127 keeps the earliest `created_at`)
- Join opportunities to standardized accounts and rep roster
- Compute stage history (slippage, stage transitions) from pipeline snapshots
- Coalesce missing activity outcomes to `Unknown` with a `is_outcome_known` flag
- Compute days-since-last-activity per opportunity (with account-level fallback)
- Build a ramp-aware effective monthly target per rep

### Marts — `dim_<entity>` and `fct_<process>`
Table materialisation. Consumption layer for the notebook and dashboard:
- `dim_accounts` / `dim_reps` — conformed dimensions
- `fct_opportunities` — opp-grain fact with `is_stale`, `closes_in_q2_2026`, drift flags
- `fct_pipeline_health` — open-opp fact with stage age, slippage, weighted ARR
- `fct_rep_attainment` — rep × month closed-won vs ramp-adjusted target, QTD running totals
- `fct_funnel_conversion` — month × market × segment × demand_source stage-to-stage rates
- `fct_quarterly_arr` — quarter × market × segment closed ARR vs target

## 4. Assumptions resolved while building the model

Logged in `deliverables/assumptions_log.md`. Briefly:

1. **OPP-127 duplicate** — keep earliest `created_at`.
2. **`country_raw`, `region_raw`, `segment_raw`** — re-derive from raw rather than trust Pleo's pre-clean columns blindly. Drift surfaces as `*_drift` boolean columns in the marts. Found 2 accounts with market drift.
3. **Demand source mapping** — single dictionary used for both `opportunities` and `funnel_events` so joins behave consistently.
4. **Stage names** — collapse free-text raw stages into the 9 canonical stages Pleo also provides.
5. **Closed-lost reason** — collapse 19 free-text values into 5 canonical reasons.
6. **Stale flag** — open opp with `days_since_last_activity >= 30` (vs the analysis-as-of date, default `current_date`).
7. **Pre-opp activity** — preserved (null `opportunity_id`), flagged as `is_pre_opp_activity`.
8. **Missing activity outcomes** — coalesce to `'Unknown'`; include in volume counts, exclude from outcome ratios via `is_outcome_known`.
9. **Ramp adjustment** — use the source-provided `adjusted_monthly_target_eur`, fall back to `monthly_target * ramp_factor` if missing.
10. **REP-004 market change** — preserved through the rep dimension so attainment can be split on `activity_date` against `market_change_date` if needed.
11. **Mixed date formats** in `close_date`, `created_date`, `activity_date`, `next_step_date` — normalised to ISO at ingestion (~50% of rows were DD/MM/YYYY). This is a real CRM hygiene finding that supports the second automation recommendation.
12. **All ARR in EUR** per `arr_eur` columns — no FX conversion required. (Earlier feedback called this out for being in staging — moved into intermediate concept space here, even though it's a no-op for this dataset.)
13. **Quarter format** — `'Q2 2026'` (with space). Standardised across `fct_rep_attainment` and `fct_quarterly_arr` so cross-mart joins work.
