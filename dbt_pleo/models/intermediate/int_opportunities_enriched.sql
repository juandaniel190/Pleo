{{ config(materialized='view') }}

-- Joins opps to accounts/reps; adds canonical stage, demand_source, closed-lost reason, lifecycle flags, and drift detection.

with opps as (
    select * from {{ ref('int_opportunities_deduped') }}
),

accounts as (
    select * from {{ ref('int_accounts_standardized') }}
),

reps as (
    select * from {{ ref('stg_pleo__rep_roster') }}
),

derived as (
    select
        o.opportunity_id,
        o.account_id,
        o.owner_id            as rep_id,
        a.account_name,
        a.market,
        a.segment,
        a.country,
        a.industry,
        r.rep_name,
        r.team,
        r.ramp_status,

        -- Canonical demand source from raw
        {{ normalize_label('o.demand_source_raw', {
            'sdr outbound': 'SDR Outbound', 'sdr': 'SDR Outbound',
            'ae outbound': 'AE Outbound', 'ae ob': 'AE Outbound', 'sales outbound': 'AE Outbound',
            'marketing': 'Marketing', 'mkt': 'Marketing', 'mktg': 'Marketing', 'inbound': 'Marketing',
            'partnerships': 'Partnerships', 'partner': 'Partnerships', 'channel': 'Partnerships'
        }, default_col='demand_source_clean') }} as demand_source,

        -- Canonical stage from raw
        {{ normalize_label('o.stage_raw', {
            'disc': 'Discovery', 'discovery': 'Discovery', '0a discovery': 'Discovery',
            'init mtg': 'Initial Meeting', 'initial meeting': 'Initial Meeting', 'initial mtg': 'Initial Meeting',
            'qual': 'Qualified', 'qualified': 'Qualified',
            'eval': 'Evaluation', 'evaluate': 'Evaluation', 'evaluation': 'Evaluation',
            'bv': 'Business Validation', 'bus. validation': 'Business Validation', 'business validation': 'Business Validation',
            'ctr': 'Contracting', 'contracting': 'Contracting',
            'neg': 'Negotiation', 'negotiation': 'Negotiation',
            'cw': 'Closed Won', 'closed won': 'Closed Won',
            'cl': 'Closed Lost', 'closed lost': 'Closed Lost'
        }, default_col='stage_clean') }} as stage,

        -- Canonical closed-lost reason
        {{ normalize_label('o.closed_lost_reason', {
            'competitor': 'Competitor', 'lost to competitor': 'Competitor',
            'price': 'Price', 'pricing': 'Price', 'too expensive': 'Price',
            'product gap': 'Product Gap', 'feature gap': 'Product Gap',
            'timing': 'Timing', 'not now': 'Timing', 'delayed': 'Timing',
            'no decision': 'No Decision', 'nd': 'No Decision', 'stalled': 'No Decision'
        }, default_col='closed_lost_reason') }} as closed_lost_reason,

        o.arr_eur,
        o.close_date,
        o.created_date as opp_created_date,
        o.forecast_category,
        o.close_probability_pct,
        o.sales_cycle_days,

        -- Pleo-provided versions (for drift)
        o.stage_clean         as pleo_stage,
        o.demand_source_clean as pleo_demand_source,

        -- Raw labels carried through for traceability
        o.stage_raw,
        o.demand_source_raw,
        o.closed_lost_reason  as closed_lost_reason_raw
    from opps o
    left join accounts a using (account_id)
    left join reps r on r.rep_id = o.owner_id
)

select
    *,

    -- Lifecycle flags
    case when stage = 'Closed Won'  then true else false end as is_won,
    case when stage = 'Closed Lost' then true else false end as is_lost,
    case when stage in ('Closed Won', 'Closed Lost') then false else true end as is_open,

    -- Drift flags
    (stage         is distinct from pleo_stage)         as stage_drift,
    (demand_source is distinct from pleo_demand_source) as demand_source_drift
from derived
