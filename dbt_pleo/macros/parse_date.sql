{#
    parse_date(column)
    ------------------
    The source CRM exports dates in three formats in the SAME column:
      - ISO 'YYYY-MM-DD'
      - European 'DD/MM/YYYY'
      - Year-month 'YYYY-MM' (used in snapshot_month, event_month, etc.)

    The macro casts the column to varchar first so it works regardless of what
    DuckDB's CSV sniffer inferred. Returns DATE; NULL on parse failure.
#}
{% macro parse_date(column) %}
    coalesce(
        try_cast(cast({{ column }} as varchar) as date),
        try_strptime(cast({{ column }} as varchar), '%d/%m/%Y')::date,
        try_strptime(cast({{ column }} as varchar) || '-01', '%Y-%m-%d')::date
    )
{% endmacro %}


{#
    parse_timestamp(column)
    -----------------------
    Same idea but for timestamps. Accepts 'YYYY-MM-DD HH:MM' and the European
    DD/MM/YYYY variants.
#}
{% macro parse_timestamp(column) %}
    coalesce(
        try_cast(cast({{ column }} as varchar) as timestamp),
        try_strptime(cast({{ column }} as varchar), '%d/%m/%Y %H:%M')::timestamp,
        try_strptime(cast({{ column }} as varchar), '%d/%m/%Y')::timestamp
    )
{% endmacro %}
