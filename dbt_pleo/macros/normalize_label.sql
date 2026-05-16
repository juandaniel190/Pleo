{#
    normalize_label
    ---------------
    Maps a (cleaned) raw label to its canonical form via a small dict.
    Single-purpose, short — addresses the "macro too complex" feedback.

    Usage:
      {{ normalize_label('demand_source_raw', {
            'sdr outbound': 'SDR Outbound',
            'sdr': 'SDR Outbound',
            'inbound': 'Marketing',
      }, default_col='demand_source_raw') }}
#}
{% macro normalize_label(column, mapping, default_col=none) %}
    case
    {%- for raw, canonical in mapping.items() %}
        when {{ clean_string(column) }} = '{{ raw|lower }}' then '{{ canonical }}'
    {%- endfor %}
        else {{ default_col if default_col is not none else "null" }}
    end
{% endmacro %}
