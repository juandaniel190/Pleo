-- Q2 2026 rep attainment (ramp-adjusted), through 2026-05-31. Joins: fct_rep_attainment × dim_reps.

with q2 as (
    select
        ra.rep_id,
        ra.rep_name,
        ra.market,
        ra.segment,
        ra.team,
        ra.ramp_factor,
        sum(ra.closed_won_arr_eur)                  as closed_won_eur,
        sum(ra.effective_monthly_target_eur)        as ramp_adjusted_target_eur
    from `pleo`.`main_marts`.`fct_rep_attainment`  as ra
    where ra.quarter = 'Q2 2026'
      and ra.target_month <= date '2026-05-31'
    group by ra.rep_id, ra.rep_name, ra.market, ra.segment, ra.team, ra.ramp_factor
)
select
    q2.rep_id,
    q2.rep_name,
    q2.team,
    q2.market,
    q2.segment,
    q2.ramp_factor,
    r.ramp_status,
    q2.ramp_adjusted_target_eur,
    q2.closed_won_eur,
    safe_divide(q2.closed_won_eur, q2.ramp_adjusted_target_eur) as attainment_pct
from q2
left join `pleo`.`main_marts`.`dim_reps` as r on r.rep_id = q2.rep_id
order by attainment_pct asc nulls last;
