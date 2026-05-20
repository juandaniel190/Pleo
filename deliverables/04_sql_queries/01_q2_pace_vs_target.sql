-- Q2 2026 pace vs ramp-adjusted target by market × segment. Joins: fct_quarterly_arr × dim_accounts.

select
    qa.market,
    qa.segment,
    qa.target_eur,
    qa.closed_arr_eur,
    qa.target_eur - qa.closed_arr_eur                                       as gap_eur,
    safe_divide(qa.closed_arr_eur, qa.target_eur)                           as attainment_pct,
    count(distinct a.account_id)                                            as accounts_in_segment
from `pleo`.`main_marts`.`fct_quarterly_arr`  as qa
left join `pleo`.`main_marts`.`dim_accounts`  as a
    on  a.market  = qa.market
    and a.segment = qa.segment
where qa.quarter = 'Q2 2026'
group by qa.market, qa.segment, qa.target_eur, qa.closed_arr_eur
order by gap_eur desc;
