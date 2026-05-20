# Part 1 — Data model

Seven raw tables land from the Excel workbook (CSVs via dbt seeds) and flow through a three-layer dbt project: **staging → intermediate → marts**.

## 1. Relationships

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

## 2. Modelling layers

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

Full assumption log: `deliverables/assumptions_log.md`.
