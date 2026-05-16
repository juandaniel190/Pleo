{#
    parse_percent(column)
    ---------------------
    Strips trailing '%' and casts to integer. NULL on empty / parse failure.
    Casts the input to varchar first so the macro is robust to whatever type
    DuckDB's CSV sniffer chose for the column.
#}
{% macro parse_percent(column) %}
    try_cast(replace(cast({{ column }} as varchar), '%', '') as integer)
{% endmacro %}
