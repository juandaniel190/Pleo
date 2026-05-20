-- Stale-deal call sheet sorted by ARR; largest at-risk deals first. Joins: fct_pipeline_health × dim_reps.

select
    ph.market,
    ph.segment,
    r.team,
    ph.rep_name,
    ph.account_name,
    ph.stage,
    ph.arr_eur,
    ph.weighted_arr_eur,
    ph.days_since_last_activity,
    ph.last_activity_date,
    ph.close_date,
    ph.stage_age_days
from `pleo`.`main_marts`.`fct_pipeline_health`  as ph
inner join `pleo`.`main_marts`.`dim_reps`        as r  on r.rep_id = ph.rep_id
where ph.is_stale
order by ph.arr_eur desc;
