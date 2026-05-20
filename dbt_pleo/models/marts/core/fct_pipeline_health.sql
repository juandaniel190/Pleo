{{ config(materialized='table') }}

-- Open opps with stale flag, slippage, stage age, and weighted ARR.

with opp as (
    select * from {{ ref('fct_opportunities') }}
    where is_open
),

-- Take the most recent snapshot per opp
snap_latest as (
    select
        opportunity_id,
        max(snapshot_month) as latest_snapshot_month
    from {{ ref('int_pipeline_stage_history') }}
    group by opportunity_id
),

latest_snap as (
    select s.*
    from {{ ref('int_pipeline_stage_history') }} s
    inner join snap_latest sl
      on  s.opportunity_id = sl.opportunity_id
      and s.snapshot_month = sl.latest_snapshot_month
)

select
    o.opportunity_id,
    o.account_id,
    o.account_name,
    o.market,
    o.segment,
    o.rep_id,
    o.rep_name,
    o.team,
    o.stage,
    o.demand_source,
    o.forecast_category,
    o.arr_eur,
    o.close_probability_pct,
    o.arr_eur * coalesce(o.close_probability_pct, 0) / 100.0 as weighted_arr_eur,
    o.close_date,
    o.opp_created_date,
    o.last_activity_date,
    o.days_since_last_activity,
    o.is_stale,
    o.closes_in_q2_2026,
    ls.snapshot_month                as latest_snapshot_month,
    ls.stage_age_days,
    ls.close_date_slippage_days,
    ls.stage_changed                  as moved_stage_last_snapshot
from opp o
left join latest_snap ls using (opportunity_id)
