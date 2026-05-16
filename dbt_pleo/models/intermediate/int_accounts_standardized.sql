{{ config(materialized='view') }}

/*
  int_accounts_standardized
  -------------------------
  Re-derives canonical country / market / segment from the *_raw columns.
  Pleo's source uses 'UKI' for the UK & Ireland market label — we surface
  this as 'UK' per project convention so the dashboard reads naturally.
*/

with src as (
    select * from {{ ref('stg_pleo__accounts') }}
),

derived as (
    select
        account_id,
        account_name,

        -- Canonical country (ISO-like 2 letter)
        {{ normalize_label('country_raw', {
            'dk': 'DK', 'denmark': 'DK', 'dnk': 'DK',
            'de': 'DE', 'germany': 'DE', 'deu': 'DE',
            'se': 'SE', 'sweden': 'SE',
            'nl': 'NL', 'netherlands': 'NL',
            'es': 'ES', 'spain': 'ES',
            'gb': 'GB', 'uk': 'GB', 'united kingdom': 'GB',
            'ie': 'IE', 'ireland': 'IE'
        }, default_col='country') }} as country_derived,

        -- Canonical market — 'UKI' from Pleo's source becomes 'UK' in our model.
        -- DACH / DE → DE (no Pleo "DACH" market exists in the source).
        case
            when {{ clean_string('region_raw') }} in ('uki', 'uk&i', 'uk', 'gb', 'ie', 'united kingdom', 'ireland') then 'UK'
            when {{ clean_string('region_raw') }} in ('dach', 'de', 'germany') then 'DE'
            when {{ clean_string('region_raw') }} in ('nordics', 'dk', 'denmark') then 'DK'
            when {{ clean_string('region_raw') }} in ('sweden', 'se') then 'SE'
            when {{ clean_string('region_raw') }} in ('netherlands', 'nl') then 'NL'
            when {{ clean_string('region_raw') }} in ('southern europe', 'es', 'spain') then 'ES'
            -- Pleo's pre-clean column already uses 'UKI' — translate to 'UK'.
            when market = 'UKI' then 'UK'
            else market
        end as market_derived,

        -- Canonical segment
        {{ normalize_label('segment_raw', {
            'smb': 'SMB', 'small': 'SMB', 'small business': 'SMB',
            'mm': 'Mid-Market', 'mid market': 'Mid-Market', 'mid-market': 'Mid-Market',
            'ent': 'Enterprise', 'enterprise': 'Enterprise', 'large': 'Enterprise'
        }, default_col='segment') }} as segment_derived,

        country  as pleo_country,
        market   as pleo_market,
        segment  as pleo_segment,
        country_raw,
        region_raw,
        segment_raw,
        industry,
        employee_count,
        created_date
    from src
)

select
    account_id,
    account_name,
    country_derived as country,
    market_derived  as market,
    segment_derived as segment,

    -- Drift flags — fold Pleo's UKI → UK before comparing so the rename
    -- doesn't artificially inflate drift.
    (country_derived is distinct from pleo_country)                                       as country_drift,
    (market_derived  is distinct from case when pleo_market = 'UKI' then 'UK' else pleo_market end) as market_drift,
    (segment_derived is distinct from pleo_segment)                                       as segment_drift,

    pleo_country,
    pleo_market,
    pleo_segment,
    country_raw,
    region_raw,
    segment_raw,
    industry,
    employee_count,
    created_date
from derived
