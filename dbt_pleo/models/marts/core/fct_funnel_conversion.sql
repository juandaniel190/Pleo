{{ config(materialized='table') }}

-- Funnel-stage volumes and stage-to-stage conversion rates by month × market × segment × demand_source.

with events as (
    select * from {{ ref('int_funnel_events_standardized') }}
),

pivoted as (
    select
        event_month,
        market,
        segment,
        demand_source,
        count(*) filter (where event_type = 'Lead Created')          as leads,
        count(*) filter (where event_type = 'MQL')                   as mqls,
        count(*) filter (where event_type = 'SQL')                   as sqls,
        count(*) filter (where event_type = 'Demo Completed')        as demos,
        count(*) filter (where event_type = 'Opportunity Created')   as opps,
        count(*) filter (where event_type = 'Closed Won')            as won,
        count(*) filter (where event_type = 'Closed Lost')           as lost,
        sum(arr_eur) filter (where event_type = 'Closed Won')        as won_arr_eur,
        sum(arr_eur) filter (where event_type = 'Opportunity Created') as opps_arr_eur
    from events
    group by 1, 2, 3, 4
)

select
    *,
    case when leads > 0 then mqls::double / leads end  as lead_to_mql,
    case when mqls  > 0 then sqls::double / mqls  end  as mql_to_sql,
    case when sqls  > 0 then demos::double / sqls end  as sql_to_demo,
    case when demos > 0 then opps::double / demos end  as demo_to_opp,
    case when opps  > 0 then won::double  / opps  end  as opp_to_won,
    case when leads > 0 then won::double  / leads end  as lead_to_won
from pivoted
