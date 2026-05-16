"""Build the dashboard.

This script no longer hardcodes any data into the HTML. Instead it:

  1. Exports each dbt mart needed by the dashboard as a Parquet file
     into `dashboard/data/`.
  2. Renders the HTML shell. The shell loads DuckDB-WASM in the browser,
     mounts the parquet files as tables, and runs every analytical query
     in `queries.js` against those tables to assemble `window.DATA`.

The React app in `app.jsx` keeps its existing contract — it reads from
`window.DATA` — but that object is now produced by real SQL queries
running in the user's browser, not by Python at build time.

Run:
    python dashboard/build_dashboard.py
Serve:
    python3 -m http.server 8000 --directory dashboard
"""
from __future__ import annotations
import duckdb
from pathlib import Path

ROOT     = Path(__file__).resolve().parent.parent
DASH_DIR = ROOT / 'dashboard'
DATA_DIR = DASH_DIR / 'data'

# Marts the front-end queries. Source schema is the dbt build target.
TABLES = {
    'fct_quarterly_arr':           'main_marts.fct_quarterly_arr',
    'fct_pipeline_health':         'main_marts.fct_pipeline_health',
    'fct_opportunities':           'main_marts.fct_opportunities',
    'fct_rep_attainment':          'main_marts.fct_rep_attainment',
    'fct_funnel_conversion':       'main_marts.fct_funnel_conversion',
    'fct_monthly_arr':             'main_marts.fct_monthly_arr',
    'dim_accounts':                'main_marts.dim_accounts',
    'int_pipeline_stage_history':  'main_intermediate.int_pipeline_stage_history',
}


def export_parquets():
    """Snapshot each mart to a parquet file colocated with the dashboard."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    con = duckdb.connect('/tmp/pleo.duckdb', read_only=True)
    for filename, fq_table in TABLES.items():
        out = DATA_DIR / f'{filename}.parquet'
        con.execute(f"COPY {fq_table} TO '{out}' (FORMAT PARQUET, COMPRESSION ZSTD)")
        size_kb = out.stat().st_size / 1024
        print(f"  {filename + '.parquet':40s} {size_kb:>6.1f} KB")


def render_html():
    """Render index.html. App template is the same app.jsx the design team owns —
    we don't touch it; we only orchestrate when it mounts.
    """
    app_jsx     = (DASH_DIR / 'app.jsx').read_text()
    queries_js  = (DASH_DIR / 'queries.js').read_text()
    # Strip the `export` keyword — when inlined into <script type="module">
    # the export declaration is a syntax error in some browsers.
    queries_js  = queries_js.replace('export async function loadData', 'async function loadData')

    template = HTML_TEMPLATE.replace('__QUERIES_JS__', queries_js) \
                            .replace('__APP_JSX__', app_jsx)

    out = DASH_DIR / 'index.html'
    out.write_text(template)
    print(f"\nWrote {out}  ({len(template):,} bytes)")


HTML_TEMPLATE = '''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Pleo RevOps — Weekly GTM Review</title>
<script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
<script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
<script src="https://unpkg.com/prop-types@15/prop-types.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/recharts@2.12.7/umd/Recharts.js"></script>
<script src="https://unpkg.com/@babel/standalone@7.23.0/babel.min.js"></script>
<style>
  /* Pleo Telescope · Neue Haas Grotesk Display · shade100 background */
  * { box-sizing: border-box; }
  html, body {
    margin: 0; padding: 0;
    font-family: "Neue Haas Grotesk Display", system-ui, "Helvetica Neue", Arial, sans-serif;
    font-weight: 400; font-size: 14px;
    background: #FAFAFA; color: #000000;
    -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;
  }
  h1, h2, h3 { margin: 0; font-weight: 400; }
  table { border-collapse: collapse; }
  .recharts-cartesian-axis-tick text {
    font-family: "Neue Haas Grotesk Display", system-ui, "Helvetica Neue", Arial, sans-serif;
  }
  ::selection { background: #000000; color: #FFFFFF; }

  /* ── Responsive layout classes ───────────────────── */
  .grid-4       { display: grid; grid-template-columns: repeat(4,1fr); gap: 12px; }
  .body-wrap    { max-width: 1180px; margin: 0 auto; padding: 0 40px 80px; }
  .hero-pad     { padding: 72px 40px 64px; }
  .panel-pad    { padding: 32px 32px 36px; }
  .tbl-scroll   { overflow-x: auto; -webkit-overflow-scrolling: touch; border-radius: 14px; }
  .actions-row  {
    display: grid; grid-template-columns: 1fr 180px 160px 100px;
    gap: 16px; padding: 20px 24px; align-items: center;
  }
  @media (max-width: 768px) {
    .grid-4      { grid-template-columns: repeat(2,1fr); }
    .body-wrap   { padding: 0 16px 48px; }
    .hero-pad    { padding: 40px 20px 36px; }
    .panel-pad   { padding: 20px 16px 24px; }
    .actions-row { grid-template-columns: 1fr; padding: 16px; gap: 6px; }
    .hero-h1     { font-size: 28px !important; }
    .hero-num    { font-size: 22px !important; }
    .hero-para   { font-size: 13px !important; }
    .sec-title   { font-size: 24px !important; }
  }
  @media (max-width: 480px) {
    .grid-4 { grid-template-columns: 1fr 1fr; gap: 8px; }
  }

  /* Loading state shown until DuckDB-WASM has resolved every query. */
  #loader {
    position: fixed; inset: 0; display: flex; align-items: center; justify-content: center;
    background: #FAFAFA; color: #000; font: 400 14px/1.4 "Neue Haas Grotesk Display", system-ui, sans-serif;
    letter-spacing: 0.02em; flex-direction: column; gap: 12px; z-index: 1;
  }
  #loader .dot {
    width: 8px; height: 8px; border-radius: 999px; background: #000;
    animation: pulse 1s ease-in-out infinite;
  }
  @keyframes pulse { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }
  #loader.err { color: #c00; }
</style>
</head>
<body>
<div id="loader">
  <div class="dot"></div>
  <div id="loader-msg">Querying the marts…</div>
</div>
<div id="root"></div>

<!-- App template — kept inert until data is ready. Babel transforms it on demand. -->
<script id="app-jsx" type="text/plain">
__APP_JSX__
</script>

<!-- 1) Data layer: load DuckDB-WASM, mount parquets, run queries. -->
<script type="module">
__QUERIES_JS__

const loader = document.getElementById('loader');
const loaderMsg = document.getElementById('loader-msg');

function setLoader(msg, isError = false) {
  loaderMsg.textContent = msg;
  if (isError) loader.classList.add('err');
}

try {
  setLoader('Booting DuckDB-WASM…');
  window.DATA = await loadData();
  setLoader('Rendering dashboard…');

  // 2) Inject the React app only after window.DATA exists. Babel-standalone
  //    auto-runs <script type="text/babel"> tags it finds at load time;
  //    since we deferred ours via type="text/plain", trigger a manual transform.
  const jsxSource = document.getElementById('app-jsx').textContent;
  const transformed = Babel.transform(jsxSource, { presets: ['react'] }).code;
  const s = document.createElement('script');
  s.textContent = transformed;
  document.body.appendChild(s);

  loader.remove();
} catch (e) {
  console.error(e);
  setLoader('Could not load data — ' + e.message + ' (open devtools for details)', true);
}
</script>
</body>
</html>
'''


if __name__ == '__main__':
    print('Exporting marts as parquet…')
    export_parquets()
    print('Rendering HTML shell…')
    render_html()
