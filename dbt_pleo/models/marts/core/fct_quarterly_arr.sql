{{ config(materialized='table') }}

-- Quarter × market × segment closed ARR vs ramp-adjusted target.

with target_q as (
    select
        quarter,
        target_year,
        market,
        segment,
        sum(effective_monthly_target_eur) as target_eur
    from {{ ref('int_rep_quota_ramped') }}
    group by 1, 2, 3, 4
),

actual_q as (
    select
        case
            when month(close_date) between 1 and 3  then 'Q1'
            when month(close_date) between 4 and 6  then 'Q2'
            when month(close_date) between 7 and 9  then 'Q3'
            else 'Q4'
        end || ' ' || cast(year(close_date) as varchar) as quarter,
        year(close_date) as target_year,
        market,
        segment,
        sum(arr_eur)     as closed_arr_eur,
        count(*)         as deals_won
    from {{ ref('int_opportunities_enriched') }}
    where is_won
    group by 1, 2, 3, 4
)

select
    coalesce(t.quarter, a.quarter)        as quarter,
    coalesce(t.target_year, a.target_year) as target_year,
    coalesce(t.market, a.market)          as market,
    coalesce(t.segment, a.segment)        as segment,
    coalesce(t.target_eur, 0)              as target_eur,
    coalesce(a.closed_arr_eur, 0)          as closed_arr_eur,
    coalesce(a.deals_won, 0)               as deals_won,
    coalesce(a.closed_arr_eur, 0) - coalesce(t.target_eur, 0) as gap_eur,
    case
        when coalesce(t.target_eur, 0) = 0 then null
        else coalesce(a.closed_arr_eur, 0)::double / t.target_eur
    end                                    as attainment_pct
from target_q t
full outer join actual_q a
  on t.quarter = a.quarter
  and t.market  = a.market
  and t.segment = a.segment
