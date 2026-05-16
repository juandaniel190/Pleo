{{ config(materialized='view') }}

select
    cast(rep_id                    as varchar) as rep_id,
    cast(rep_name                  as varchar) as rep_name,
    cast(market                    as varchar) as market,
    cast(segment                   as varchar) as segment,
    cast(team                      as varchar) as team,
    cast(ramp_status               as varchar) as ramp_status,
    {{ parse_date('rep_start_date') }}          as rep_start_date,
    cast(annual_quota_eur          as double)  as annual_quota_eur,
    {{ parse_date('market_change_date') }}      as market_change_date,
    cast(prior_market              as varchar) as prior_market,
    {{ parse_date('ramp_start_month') }}        as ramp_start_month,
    {{ parse_date('full_productivity_month') }} as full_productivity_month,
    cast(notes                     as varchar) as notes
from {{ ref('raw_rep_roster') }}
