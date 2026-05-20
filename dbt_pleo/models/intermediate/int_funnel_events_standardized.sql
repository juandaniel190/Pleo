{{ config(materialized='view') }}

-- Funnel events with canonical demand_source (same dictionary as opps).

select
    fe.event_id,
    fe.event_month,
    fe.account_id,
    fe.rep_id,
    fe.event_type,
    {{ normalize_label('fe.demand_source_raw', {
        'sdr outbound': 'SDR Outbound', 'sdr': 'SDR Outbound',
        'ae outbound': 'AE Outbound', 'ae ob': 'AE Outbound', 'sales outbound': 'AE Outbound',
        'marketing': 'Marketing', 'mkt': 'Marketing', 'mktg': 'Marketing', 'inbound': 'Marketing',
        'partnerships': 'Partnerships', 'partner': 'Partnerships', 'channel': 'Partnerships'
    }, default_col='demand_source_clean') }} as demand_source,
    fe.demand_source_clean as pleo_demand_source,
    fe.demand_source_raw,
    fe.segment,
    case when fe.market = 'UKI' then 'UK' else fe.market end as market,
    fe.arr_eur
from {{ ref('stg_pleo__funnel_events') }} fe
