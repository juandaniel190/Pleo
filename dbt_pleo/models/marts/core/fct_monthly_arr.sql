{{ config(materialized='table') }}

-- Monthly new_arr_eur (attainment) and cumulative_arr_eur (no-churn book size).

with months as (
    -- month spine ensures zero-closed months appear
    select cast(generate_series as date) as month
    from generate_series(date '2024-01-01', date '2026-12-01', interval '1 month')
),

monthly as (
    select
        cast(date_trunc('month', close_date) as date) as month,
        sum(arr_eur)  as new_arr_eur,
        count(*)      as new_won_deals
    from {{ ref('int_opportunities_enriched') }}
    where is_won
    group by 1
)

select
    m.month,
    coalesce(mo.new_arr_eur, 0)        as new_arr_eur,
    coalesce(mo.new_won_deals, 0)      as new_won_deals,
    sum(coalesce(mo.new_arr_eur, 0)) over (
        order by m.month
        rows between unbounded preceding and current row
    ) as cumulative_arr_eur
from months m
left join monthly mo using (month)
order by m.month
