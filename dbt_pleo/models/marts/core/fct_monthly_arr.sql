{{ config(materialized='table') }}

/*
  fct_monthly_arr
  ---------------
  Two views of ARR per calendar month:
    - new_arr_eur       — closed-won ARR booked IN that month (the flow metric
                          Pleo's brief uses for attainment)
    - cumulative_arr_eur — running total of all new_arr_eur since the start.
                          This is the ending ARR book ONLY under the
                          NO-CHURN assumption (this dataset has no churn or
                          contract-cancellation events). It is shown in the
                          dashboard as supporting context, not as a headline.

  Use new_arr_eur to measure rep / period attainment.
  Use cumulative_arr_eur to talk about the size of the book of business.
*/

with months as (
    -- A continuous month spine so months with zero closed-won still appear
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
