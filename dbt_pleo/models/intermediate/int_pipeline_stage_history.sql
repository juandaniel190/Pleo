{{ config(materialized='view') }}

-- Per-snapshot opp trajectory with prev-stage lookbacks and close-date slippage.

with snaps as (
    select * from {{ ref('stg_pleo__pipeline_snapshots') }}
),

ranked as (
    select
        s.*,
        lag(stage_at_snapshot)       over (partition by opportunity_id order by snapshot_month) as prev_stage,
        lag(close_date_at_snapshot)  over (partition by opportunity_id order by snapshot_month) as prev_close_date,
        lag(forecast_cat_at_snapshot) over (partition by opportunity_id order by snapshot_month) as prev_forecast_cat
    from snaps s
)

select
    snapshot_month,
    opportunity_id,
    owner_id as rep_id,
    stage_at_snapshot,
    arr_at_snapshot,
    forecast_cat_at_snapshot,
    close_date_at_snapshot,
    stage_age_days,
    next_step_date,

    -- Movement signals
    prev_stage,
    prev_forecast_cat,
    prev_close_date,
    (stage_at_snapshot is distinct from prev_stage) as stage_changed,
    case
        when prev_close_date is null then null
        else date_diff('day', prev_close_date, close_date_at_snapshot)
    end as close_date_slippage_days
from ranked
