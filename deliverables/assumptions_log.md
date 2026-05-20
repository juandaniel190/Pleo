# Assumptions log

| # | Issue | Decision |
|---|---|---|
| 1 | `OPP-127` duplicate in opportunities | Keep earliest `created_at` |
| 2 | Inconsistent region/segment/country labels | Re-derive from `*_raw` via deterministic mapping; drift flags surface disagreement |
| 3 | Mixed date formats (~50% DD/MM/YYYY, ~50% ISO) | Force-type to `varchar` at seed layer; `parse_date` macro normalises in staging |
| 4 | `close_probability_pct` stored as string with `%` | `parse_percent` macro strips `%` and casts to integer |
| 5 | `stage_raw` and `demand_source_raw` have free-text variance | Deterministic mapping to canonical labels via `normalize_label` |
| 6 | ~10% of `outcome` null in activity data | Coalesce to `'Unknown'`; `is_outcome_known` flag excludes from outcome-rate denominators |
| 7 | "Stale" deal definition | Open opp with `days_since_last_activity >= 30` (matches brief's worked example) |
| 8 | Effective monthly target | Use `adjusted_monthly_target_eur` when present; fall back to `monthly_arr_target_eur × ramp_factor` |
| 9 | REP-004 mid-period market change | Single rep, two market eras — preserved in `dim_reps` via `market_change_date` |
