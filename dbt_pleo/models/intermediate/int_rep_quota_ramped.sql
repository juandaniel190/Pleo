{{ config(materialized='view') }}

-- Rep × month effective quota; coalesces missing adjusted_monthly_target_eur.

select
    t.target_id,
    t.target_month,
    t.target_year,
    t.quarter,
    t.rep_id,
    coalesce(t.rep_name, r.rep_name)            as rep_name,
    case when coalesce(t.market, r.market) = 'UKI' then 'UK' else coalesce(t.market, r.market) end as market,
    coalesce(t.segment, r.segment)              as segment,
    t.region,
    r.team,
    r.ramp_status,
    r.rep_start_date,
    r.market_change_date,
    r.prior_market,
    t.monthly_arr_target_eur,
    coalesce(t.ramp_factor, 1.0)                as ramp_factor,
    coalesce(
        t.adjusted_monthly_target_eur,
        t.monthly_arr_target_eur * coalesce(t.ramp_factor, 1.0)
    )                                            as effective_monthly_target_eur
from {{ ref('stg_pleo__sales_targets') }} t
left join {{ ref('stg_pleo__rep_roster') }} r using (rep_id)
