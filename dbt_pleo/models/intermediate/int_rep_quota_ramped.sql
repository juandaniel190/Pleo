{{ config(materialized='view') }}

/*
  int_rep_quota_ramped
  --------------------
  Rep × month effective quota. The source already supplies an
  `adjusted_monthly_target_eur` which equals `monthly_arr_target_eur * ramp_factor`,
  but it is occasionally missing — we coalesce to a safe re-computation.
  REP-004's mid-period market change is preserved through the rep roster join.
*/

select
    t.target_id,
    t.target_month,
    t.target_year,
    t.quarter,
    t.rep_id,
    coalesce(t.rep_name, r.rep_name)            as rep_name,
    -- Pleo's source uses 'UKI' — rename to 'UK' to match the canonical
    -- market label used everywhere else in the model layer.
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
