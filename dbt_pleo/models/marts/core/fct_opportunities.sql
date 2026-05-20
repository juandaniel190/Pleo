{{ config(materialized='table') }}

-- Opp-grain fact with is_stale, days_since_last_activity, and closes_in_q2_2026.

{% set analysis_as_of = var('analysis_as_of_date', 'current_date') %}

with opps as (
    select * from {{ ref('int_opportunities_enriched') }}
),

last_act as (
    select * from {{ ref('int_opportunity_last_activity') }}
)

select
    o.opportunity_id,
    o.account_id,
    o.account_name,
    o.market,
    o.segment,
    o.country,
    o.industry,
    o.rep_id,
    o.rep_name,
    o.team,
    o.ramp_status,

    o.stage,
    o.demand_source,
    o.forecast_category,
    o.closed_lost_reason,

    o.arr_eur,
    o.close_probability_pct,
    o.sales_cycle_days,

    o.opp_created_date,
    o.close_date,

    o.is_open,
    o.is_won,
    o.is_lost,
    o.stage_drift,
    o.demand_source_drift,

    -- Activity recency
    la.last_activity_date,
    la.days_since_last_activity,
    case
        when o.is_open and la.days_since_last_activity >= 30 then true
        when o.is_open and la.last_activity_date is null     then true
        else false
    end as is_stale,

    -- Time helpers
    cast(date_trunc('quarter', o.close_date) as date) as close_quarter_start,
    case
        when o.close_date between date '2026-04-01' and date '2026-06-30' then true
        else false
    end as closes_in_q2_2026,

    cast({{ analysis_as_of }} as date) as analysis_as_of_date
from opps o
left join last_act la using (opportunity_id)
