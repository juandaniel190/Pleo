{#
    clean_string
    -----------
    Trims and lowercases a string column so downstream comparisons work.
    Used in the intermediate layer only — staging stays plain SQL.
#}
{% macro clean_string(column) %}
    nullif(trim(lower({{ column }})), '')
{% endmacro %}
