-- Funnel conversion by demand_source × segment, trailing 12 months. Joins: fct_funnel_conversion × dim_accounts.

select
    f.demand_source,
    f.segment,
    sum(f.leads)                                              as leads,
    sum(f.mqls)                                               as mqls,
    sum(f.sqls)                                               as sqls,
    sum(f.demos)                                              as demos,
    sum(f.opps)                                               as opps,
    sum(f.won)                                                as won,
    sum(f.won_arr_eur)                                        as won_arr_eur,
    safe_divide(sum(f.won), sum(f.leads))                     as lead_to_won,
    safe_divide(sum(f.opps), sum(f.leads))                    as lead_to_opp,
    safe_divide(sum(f.won), sum(f.opps))                      as opp_to_won,
    count(distinct a.account_id)                              as accounts_in_segment
from `pleo`.`main_marts`.`fct_funnel_conversion` as f
left join `pleo`.`main_marts`.`dim_accounts`     as a
       on a.segment = f.segment
where f.event_month >= date '2025-05-01'
group by f.demand_source, f.segment
order by lead_to_won desc nulls last;
