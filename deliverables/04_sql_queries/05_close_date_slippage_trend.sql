-- Month-over-month close-date slippage on open deals. Joins: int_pipeline_stage_history × fct_opportunities.

select
    h.snapshot_month,
    o.market,
    o.segment,
    count(*) filter (where h.close_date_slippage_days > 0)              as deals_that_slipped,
    avg(h.close_date_slippage_days)                                     as avg_slippage_days,
    sum(o.arr_eur) filter (where h.close_date_slippage_days > 0)        as slipped_arr_eur
from `pleo`.`main_intermediate`.`int_pipeline_stage_history` as h
inner join `pleo`.`main_marts`.`fct_opportunities`           as o
        on o.opportunity_id = h.opportunity_id
where o.is_open
  and h.close_date_slippage_days is not null
group by h.snapshot_month, o.market, o.segment
order by h.snapshot_month, slipped_arr_eur desc;
