# Assumptions log

Every data decision made while building this analysis. Each one is mechanical and reproducible in code.

## Data quality

| # | Issue | Decision | Where it's implemented |
|---|---|---|---|
| 1 | `OPP-127` appears twice in `raw_opportunities` | Keep earliest `created_at`; drop the later row | `int_opportunities_deduped.sql` |
| 2 | `country_raw`, `region_raw`, `segment_raw` use inconsistent labels (e.g. `DK / Denmark / DNK`, 11 segment values for 3 canonical segments) | Re-derive canonical values from `*_raw` via deterministic mapping. Pleo's pre-cleaned columns are preserved as `pleo_*` so drift can be quantified. | `int_accounts_standardized.sql` |
| 3 | Mixed date formats — `close_date`, `created_date`, `activity_date`, `next_step_date`: ~50% DD/MM/YYYY, ~50% ISO. Also `snapshot_month` / `event_month` / `target_month` are YYYY-MM. | Force-type these columns to `varchar` at the seed layer in `dbt_project.yml`, then the `parse_date` macro normalises all three formats to DATE in staging | `dbt_pleo/dbt_project.yml`, `dbt_pleo/macros/parse_date.sql` |
| 4 | `close_probability_pct` is a string with `%` | Force-type to `varchar` at the seed layer, then `parse_percent` macro strips `%` and casts to integer in staging | `dbt_pleo/macros/parse_percent.sql` |
| 5 | `stage_raw` has free-text variance (codes + names) | Map to the 9 canonical stages via `normalize_label` | `int_opportunities_enriched.sql` |
| 6 | `demand_source_raw` differs between opportunities and funnel events | Single mapping dictionary applied in both intermediate models so joins behave consistently | `int_opportunities_enriched.sql`, `int_funnel_events_standardized.sql` |
| 7 | `closed_lost_reason` has 19 free-text values for ~5 underlying reasons | Map to canonical Competitor / Price / Product Gap / Timing / No Decision | `int_opportunities_enriched.sql` |
| 8 | ~10% of `outcome` is null in `raw_activity_data` | Coalesce to `'Unknown'`. Add `is_outcome_known` boolean so denominators in outcome-rate calculations can exclude these rows | `int_activity_outcomes_filled.sql` |
| 9 | 50 rows in `raw_activity_data` have null `opportunity_id` (legitimate pre-opp SDR outreach) | Preserve; flag with `is_pre_opp_activity` | `int_activity_outcomes_filled.sql` |
| 10 | Some opps have no direct activity record (account-level activity only) | When computing `last_activity_date`, fall back to the most recent account-level activity. Flag fallback usage with `fell_back_to_account_activity` | `int_opportunity_last_activity.sql` |

## Business definitions

| # | Definition | Choice | Where it's implemented |
|---|---|---|---|
| 11 | "Stale" deal | Open opp with `days_since_last_activity >= 30` (vs analysis-as-of date) — or no activity at all | `fct_opportunities.is_stale` |
| 12 | Analysis-as-of date | dbt variable `analysis_as_of_date`, defaults to `current_date`. Override via `dbt run --vars '{analysis_as_of_date: "2026-05-14"}'` | `dbt_project.yml` |
| 13 | Effective monthly target (rep) | `adjusted_monthly_target_eur` when present, else `monthly_arr_target_eur * ramp_factor`. Coalesce ramp_factor to 1.0 | `int_rep_quota_ramped.sql` |
| 14 | Closed-won match to target | Match on rep_id and `date_trunc('month', close_date) = target_month`. Pre-conversion deals (created in a different rep's month) still attribute to the closing rep | `fct_rep_attainment.sql` |
| 15 | REP-004 mid-period market change (Oct 2025) | Treat as a single rep with two market eras. Activity attribution is implicitly split because `activity_date` and `market_change_date` are both available downstream | `dim_reps`, `int_rep_quota_ramped` |
| 16 | Quarter label format | `'Q2 2026'` (space) everywhere. The source uses the space format in `raw_sales_targets.quarter` | `fct_quarterly_arr.sql`, `fct_rep_attainment.sql` |
| 17 | Currency | All ARR is EUR. No FX conversion needed for this dataset. (Architecturally currency conversion would live in `intermediate/`, not staging.) | n/a |
| 18 | Weighted ARR | `arr_eur * close_probability_pct / 100`. Probability nulls treated as 0. | `fct_pipeline_health.weighted_arr_eur` |

## Things I chose NOT to do (and why)

- **Did not impute missing activity outcomes by inferring from `notes` text.** Risk of confirmation bias. Counted them as `Unknown` and excluded from outcome rates.
- **Did not surrogate-key the snapshot table.** The composite (snapshot_month, opportunity_id) is the natural PK and is what every downstream model joins on.
- **Did not aggregate funnel events at opportunity grain.** Funnel events are a separate signal source (lead-stage) — not all events tie to an opportunity, and forcing the join would hide pre-opp SDR funnel volume.
- **Did not split REP-004's attainment by market in the headline rep scorecard.** With one rep and one transition, the scorecard reads more cleanly if we keep their current market. The data is structured so the split is trivial when requested.
- **Did not use Jinja in any staging model.** Per project rules, staging is rename + cast only.

## Sources of judgment

- The brief explicitly says some labels are inconsistent and we have to decide how to handle them. The drift flags in the marts make every decision auditable.
- The 30-day stale threshold matches the brief's worked example. A tighter (14-day) or looser (45-day) threshold is trivially configurable in `fct_opportunities`.
