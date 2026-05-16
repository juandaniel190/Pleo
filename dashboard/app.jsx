// Pleo RevOps dashboard — React + Recharts, rendered at runtime via Babel.
//
// Design intent (per Daniel's direction):
//   - Pleo Telescope palette (no Finstatement / monochrome).
//   - Warm cream background like Pleo's marketing site.
//   - Inter for everything (no monospace). Numbers use tabular-nums.
//   - Section cards live on a light grey panel; cards inside are white.
//   - Pleo brand pastels (yellow / green / pink / purple) appear ONLY on
//     specific data callouts (status pills, tiny accent dots, the won
//     funnel bar). Everything else is black / grey / white.
//   - Less colour overall; the eye should land on the numbers that matter.

const { useState, useMemo } = React;

if (typeof Recharts === 'undefined') {
  document.getElementById('root').innerHTML =
    '<div style="padding:40px;font-family:sans-serif;color:#c00"><strong>Error:</strong> Recharts CDN failed to load. Serve via HTTP, not file://.<br><code>python3 -m http.server 8000</code></div>';
  throw new Error('Recharts not loaded');
}

const {
  BarChart, Bar, LineChart, Line, ComposedChart, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, CartesianGrid, Cell, LabelList
} = Recharts;

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(e) { return { error: e }; }
  render() {
    if (this.state.error) return (
      <div style={{ padding: 40, fontFamily: 'sans-serif', color: '#c00' }}>
        <strong>Render error:</strong> {this.state.error.message}
        <pre style={{ marginTop: 12, fontSize: 12 }}>{this.state.error.stack}</pre>
      </div>
    );
    return this.props.children;
  }
}

// --- Design tokens (Pleo Telescope) ---------------------------------------

const T = {
  // Surfaces — warm cream page, light grey section panel, white cards
  bg:         '#F4EFE8',  // cream — Pleo marketing-site background
  panel:      '#ECE7DF',  // section grouping panel
  card:       '#FFFFFF',  // card / table fill
  hairline:   '#E5E0D8',  // subtle separator (used very sparingly)

  // Text
  black:      '#000000',
  textSec:    '#333333',  // Telescope shade700
  textMuted:  '#737373',  // Telescope shade600

  // Status (used sparingly — only where it actually matters)
  positive:   '#2c8354',  // Telescope green800
  negative:   '#e91c1c',  // Telescope red700

  // Pleo brand pastels — reserved for tiny accents (avatar dots, "Won" bar, etc.)
  pleoYellow: '#fcea88',
  pleoGreen:  '#ace3bd',
  pleoPink:   '#f39ca8',
  pleoPurple: '#a69ae3',

  // Chart neutrals
  chartGrid:  '#E5E0D8',
};

const numStyle = { fontVariantNumeric: 'tabular-nums', fontFeatureSettings: '"tnum"' };

const fmtEur = (n) => {
  if (n === null || n === undefined) return '—';
  if (Math.abs(n) >= 1000) return '€' + Math.round(n / 1000).toLocaleString() + 'K';
  return '€' + Math.round(n).toLocaleString();
};

// --- Primitives -----------------------------------------------------------

const Pill = ({ kind, children }) => {
  // Quiet pills — no full-saturation backgrounds. Just a coloured dot + label
  // in slightly tinted text. The screen stays calm; pills don't shout.
  const colours = {
    positive: T.positive,
    negative: T.negative,
    neutral:  T.textMuted,
  };
  const c = colours[kind || 'neutral'];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      fontSize: 12, fontWeight: 500, color: c, ...numStyle,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: c, display: 'inline-block' }} />
      {children}
    </span>
  );
};

const KpiCard = ({ label, value, sub, emphasised }) => (
  // The "emphasised" prop just bolds the number a touch — no colour change.
  <div style={{
    background: T.card, borderRadius: 14, padding: '22px 24px',
  }}>
    <div style={{ fontSize: 11, color: T.textMuted, textTransform: 'uppercase',
                  letterSpacing: '0.06em', fontWeight: 500, marginBottom: 14 }}>{label}</div>
    <div style={{ ...numStyle, fontSize: 30, fontWeight: emphasised ? 700 : 600,
                  color: T.black, lineHeight: 1.1, letterSpacing: '-0.02em' }}>{value}</div>
    {sub && <div style={{ fontSize: 12, color: T.textMuted, marginTop: 10, lineHeight: 1.5 }}>{sub}</div>}
  </div>
);

const SectionBanner = ({ tag, title, caption, who }) => (
  <div style={{ marginTop: 64, marginBottom: 24 }}>
    <div style={{ fontSize: 10, color: T.textMuted, textTransform: 'uppercase',
                  letterSpacing: '0.14em', fontWeight: 600, marginBottom: 8 }}>{tag}</div>
    <h2 style={{ margin: 0, fontSize: 28, fontWeight: 700, color: T.black,
                 letterSpacing: '-0.02em', lineHeight: 1.2 }}>{title}</h2>
    {caption && (
      <div style={{ fontSize: 14, color: T.textSec, marginTop: 10, lineHeight: 1.55, maxWidth: 760 }}>
        {caption}
      </div>
    )}
    {who && (
      <div style={{ fontSize: 11, color: T.textMuted, marginTop: 12,
                    textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Audience · {who}
      </div>
    )}
  </div>
);

const SectionH = ({ children, meta }) => (
  <div style={{ fontSize: 11, color: T.textMuted, textTransform: 'uppercase',
                letterSpacing: '0.12em', fontWeight: 500, marginTop: 32, marginBottom: 14 }}>
    {children}
    {meta && <span style={{ marginLeft: 10, color: T.textMuted, opacity: 0.7,
                            textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>{meta}</span>}
  </div>
);

const FindingBox = ({ children }) => (
  // No coloured strip, no coloured background. Just a quiet quote-style
  // indent — the words carry the weight.
  <div style={{
    padding: '14px 0 14px 20px',
    margin: '16px 0 4px',
    borderLeft: `2px solid ${T.hairline}`,
    fontSize: 14, lineHeight: 1.6, color: T.textSec,
  }}>{children}</div>
);

const Card = ({ children, style }) => (
  <div style={{ background: T.card, borderRadius: 14, padding: 24, ...style }}>{children}</div>
);

const Table = ({ headers, rows, formatters }) => (
  <div style={{ background: T.card, borderRadius: 14, overflow: 'hidden' }}>
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
      <thead>
        <tr>
          {headers.map((h, i) => (
            <th key={i} style={{
              textAlign: h.align || 'left', padding: '14px 20px',
              fontSize: 11, color: T.textMuted, textTransform: 'uppercase',
              letterSpacing: '0.06em', fontWeight: 500,
              borderBottom: `1px solid ${T.hairline}`,
            }}>{h.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            {headers.map((h, j) => {
              const v = r[h.key];
              const cell = formatters && formatters[h.key] ? formatters[h.key](v, r) : v;
              return (
                <td key={j} style={{
                  padding: '12px 20px', textAlign: h.align || 'left',
                  color: h.muted ? T.textMuted : T.textSec,
                  fontWeight: h.bold ? 600 : 400,
                  borderTop: i > 0 ? `1px solid ${T.hairline}` : 'none',
                  ...(h.numeric ? numStyle : {}),
                }}>{cell}</td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// --- Hero -----------------------------------------------------------------

function HeroSection({ data }) {
  const h = data.hero;
  return (
    <section style={{ background: T.black, color: '#FFFFFF',
                      padding: '72px 40px 64px' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)',
                      textTransform: 'uppercase', letterSpacing: '0.14em',
                      fontWeight: 600, marginBottom: 12 }}>
          Weekly GTM Performance Review · {h.asOf}
        </div>
        <h1 style={{ margin: 0, fontSize: 44, fontWeight: 700, letterSpacing: '-0.03em',
                     lineHeight: 1.1, color: '#FFFFFF', marginBottom: 20 }}>
          Q2 2026 is behind plan.
        </h1>
        <div style={{ ...numStyle, fontSize: 36, fontWeight: 600,
                      color: T.pleoYellow, lineHeight: 1.1, letterSpacing: '-0.02em',
                      marginBottom: 24 }}>
          €0 closed of {fmtEur(h.q2Target)}
        </div>
        <p style={{ fontSize: 15, lineHeight: 1.65, maxWidth: 720, opacity: 0.78,
                    margin: '0 0 40px', color: '#FFFFFF' }}>
          Six weeks into Q2, we have closed €0 of a ramp-adjusted {fmtEur(h.q2Target)} target.
          Pipeline scheduled to close in Q2 is {fmtEur(h.q2PipeGross)} gross / {fmtEur(h.q2PipeWeighted)}{' '}
          weighted — even if every weighted euro lands, we miss target by {fmtEur(h.q2Target - h.q2PipeWeighted)}.
          The biggest controllable lever this week is the {h.staleDeals} open deals worth {fmtEur(h.staleArr)} with
          no activity in 30+ days.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {[
            { label: 'Q2 ARR pace',         value: fmtEur(h.q2Closed),         sub: `${fmtEur(h.q2Gap)} behind plan` },
            { label: 'Pipeline at risk',    value: fmtEur(h.staleArr),         sub: `${h.staleDeals} stale · ${h.staleAvgSilent}d avg silent` },
            { label: 'Q2 weighted pipeline',value: fmtEur(h.q2PipeWeighted),   sub: `${fmtEur(h.q2PipeGross)} gross` },
            { label: 'Recovery upside',     value: `+${fmtEur(h.recoveryEur)}`, sub: 'Stale re-engagement · 45d' },
          ].map((k, i) => (
            <div key={i} style={{ background: 'rgba(255,255,255,0.06)',
                                  borderRadius: 12, padding: '20px 22px' }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)',
                            textTransform: 'uppercase', letterSpacing: '0.06em',
                            fontWeight: 600, marginBottom: 12 }}>{k.label}</div>
              <div style={{ ...numStyle, fontSize: 26, fontWeight: 700, color: '#FFFFFF',
                            lineHeight: 1.1, letterSpacing: '-0.02em' }}>{k.value}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)',
                            marginTop: 10, lineHeight: 1.5 }}>{k.sub}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// --- Charts ---------------------------------------------------------------

const TooltipBox   = { background: '#000000', border: 'none', borderRadius: 6, fontSize: 12, padding: '8px 10px' };
const TooltipLabel = { color: '#FFF' };
const TooltipItem  = { color: '#FFF' };

function TrendChart({ data }) {
  const points = data.trend.filter(r => r.quarter >= 'Q1 2025');
  return (
    <Card>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={points} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="2 4" vertical={false} stroke={T.chartGrid} />
          <XAxis dataKey="quarter" tick={{ fontSize: 11, fill: T.textMuted }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={(v) => `€${v}K`} tick={{ fontSize: 11, fill: T.textMuted }} axisLine={false} tickLine={false} />
          <Tooltip formatter={(v) => `€${v}K`} contentStyle={TooltipBox} labelStyle={TooltipLabel} itemStyle={TooltipItem} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="target_k" name="Target"     fill={T.hairline} radius={[4,4,0,0]} />
          <Bar dataKey="closed_k" name="Closed-won" fill={T.black}    radius={[4,4,0,0]} />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}

function CumulativeArrChart({ data }) {
  const points = data.cumulativeArr.filter(r => r.month <= '2026-06-01');
  return (
    <Card>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={points} margin={{ top: 8, right: 30, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="2 4" vertical={false} stroke={T.chartGrid} />
          <XAxis dataKey="month" tick={{ fontSize: 10, fill: T.textMuted }} axisLine={false} tickLine={false}
                 tickFormatter={(v) => v.substring(0, 7)} interval={2} />
          <YAxis yAxisId="left"  tickFormatter={(v) => `€${Math.round(v/1000)}K`} tick={{ fontSize: 11, fill: T.textMuted }} axisLine={false} tickLine={false} />
          <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `€${Math.round(v/1000)}K`} tick={{ fontSize: 11, fill: T.textMuted }} axisLine={false} tickLine={false} />
          <Tooltip formatter={(v) => `€${Math.round(v/1000).toLocaleString()}K`} contentStyle={TooltipBox} labelStyle={TooltipLabel} itemStyle={TooltipItem} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar  yAxisId="left"  dataKey="new_arr_eur"        name="New ARR booked"        fill={T.hairline} radius={[3,3,0,0]} />
          <Line yAxisId="right" dataKey="cumulative_arr_eur" name="Cumulative (no churn)" stroke={T.black} strokeWidth={2} dot={{ r: 2, fill: T.black }} />
        </ComposedChart>
      </ResponsiveContainer>
    </Card>
  );
}

function AspBySource({ data }) {
  const rows = data.aspBySource.map(r => ({ ...r, asp_keur: Math.round(r.asp_eur / 1000) }));
  return (
    <Card>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={rows} margin={{ top: 20, right: 8, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="2 4" vertical={false} stroke={T.chartGrid} />
          <XAxis dataKey="demand_source" tick={{ fontSize: 12, fill: T.textMuted }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={(v) => `€${v}K`} tick={{ fontSize: 11, fill: T.textMuted }} axisLine={false} tickLine={false} />
          <Tooltip formatter={(v) => `€${v}K ASP`} contentStyle={TooltipBox} labelStyle={TooltipLabel} itemStyle={TooltipItem} />
          <Bar dataKey="asp_keur" fill={T.black} radius={[4,4,0,0]}>
            <LabelList dataKey="asp_keur" position="top" formatter={(v) => `€${v}K`} fontSize={11} fontWeight={600} fill={T.black} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}

function VelocityByStage({ data }) {
  return (
    <Card>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart layout="vertical" data={data.velocity} margin={{ top: 8, right: 50, left: 50, bottom: 0 }}>
          <CartesianGrid strokeDasharray="2 4" horizontal={false} stroke={T.chartGrid} />
          <XAxis type="number" tick={{ fontSize: 11, fill: T.textMuted }} axisLine={false} tickLine={false} />
          <YAxis dataKey="stage" type="category" tick={{ fontSize: 11, fill: T.textSec }} width={140} axisLine={false} tickLine={false} />
          <Tooltip formatter={(v) => `${v} days`} contentStyle={TooltipBox} labelStyle={TooltipLabel} itemStyle={TooltipItem} />
          <Bar dataKey="avg_days" fill={T.black} radius={[0,4,4,0]}>
            <LabelList dataKey="avg_days" position="right" formatter={(v) => `${v}d`} fontSize={11} fontWeight={600} fill={T.black} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}

function StaleBySegmentChart({ data }) {
  const rows = data.staleBySegment.slice(0, 10).map(r => ({ ...r, label: `${r.market} · ${r.segment}` }));
  return (
    <Card>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart layout="vertical" data={rows} margin={{ top: 8, right: 60, left: 100, bottom: 0 }}>
          <CartesianGrid strokeDasharray="2 4" horizontal={false} stroke={T.chartGrid} />
          <XAxis type="number" tickFormatter={(v) => `€${v}K`} tick={{ fontSize: 11, fill: T.textMuted }} axisLine={false} tickLine={false} />
          <YAxis dataKey="label" type="category" tick={{ fontSize: 11, fill: T.textSec }} width={100} axisLine={false} tickLine={false} />
          <Tooltip formatter={(v) => `€${v}K`} contentStyle={TooltipBox} labelStyle={TooltipLabel} itemStyle={TooltipItem} />
          <Bar dataKey="arr_keur" fill={T.black} radius={[0,4,4,0]}>
            <LabelList dataKey="arr_keur" position="right" formatter={(v) => `€${v}K`} fontSize={11} fontWeight={600} fill={T.black} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}

function FunnelChart({ data }) {
  const rows = data.funnel.map((r, i) => {
    const prev = i > 0 ? data.funnel[i - 1].count : null;
    const conv = (prev && prev > 0) ? Math.round(r.count / prev * 100) : null;
    return { ...r, conv };
  });
  return (
    <Card>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={rows} margin={{ top: 20, right: 8, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="2 4" vertical={false} stroke={T.chartGrid} />
          <XAxis dataKey="stage" tick={{ fontSize: 12, fill: T.textMuted }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: T.textMuted }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={TooltipBox} labelStyle={TooltipLabel} itemStyle={TooltipItem} />
          <Bar dataKey="count" radius={[4,4,0,0]}>
            {/* Only the "Won" bar gets a Pleo green accent — the one number that matters. */}
            {rows.map((r, i) => (
              <Cell key={i} fill={r.stage === 'Won' ? T.pleoGreen : T.black} />
            ))}
            <LabelList dataKey="count" position="top" fontSize={11} fontWeight={600} fill={T.black} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div style={{ fontSize: 11, color: T.textMuted, marginTop: 12,
                    display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap' }}>
        {rows.slice(1).map((r, i) => (
          <span key={i}>{rows[i].stage}→{r.stage}: <strong style={{ color: T.black }}>{r.conv}%</strong></span>
        ))}
      </div>
    </Card>
  );
}

function SlippageTrendChart({ data }) {
  return (
    <Card>
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={data.slippageTrend} margin={{ top: 8, right: 30, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="2 4" vertical={false} stroke={T.chartGrid} />
          <XAxis dataKey="snapshot_month" tick={{ fontSize: 10, fill: T.textMuted }} axisLine={false} tickLine={false} />
          <YAxis yAxisId="left" tickFormatter={(v) => `€${v}K`} tick={{ fontSize: 11, fill: T.textMuted }} axisLine={false} tickLine={false} />
          <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: T.textMuted }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={TooltipBox} labelStyle={TooltipLabel} itemStyle={TooltipItem} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar  yAxisId="left"  dataKey="slipped_keur" name="Slipped ARR (kEUR)" fill={T.hairline} radius={[3,3,0,0]} />
          <Line yAxisId="right" dataKey="slip_rate"   name="Slip rate %"        stroke={T.black} strokeWidth={2} dot={{ r: 3, fill: T.black }} />
        </ComposedChart>
      </ResponsiveContainer>
    </Card>
  );
}

// --- Main app -------------------------------------------------------------

function App() {
  const data = window.DATA;
  const h = data.hero;
  const cumPoints = (data.cumulativeArr || []).filter(r => r.cumulative_arr_eur > 0);
  const lastCum = cumPoints.length ? cumPoints[cumPoints.length - 1].cumulative_arr_eur : 0;

  return (
    <div style={{ background: T.bg, color: T.black, minHeight: '100vh' }}>
      <HeroSection data={data} />

      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '0 40px 80px' }}>

        {/* ===== Trend ===== */}
        <SectionBanner
          tag="CRO HEADLINE"
          title="Three consecutive quarters of severe underperformance"
          caption="Q4 2025 closed at 5%, Q1 2026 at 24%, Q2 2026 at 0%. One rep (K. Nguyen) carried the Q1 number; the other 15 closed zero. Q2 follows the same pattern — this is a system issue, not coaching."
          who="CRO · CFO"
        />
        <TrendChart data={data} />

        {/* ===== Pipeline quality ===== */}
        <div style={{ background: T.panel, borderRadius: 20, padding: '32px 32px 36px', marginTop: 56 }}>
          <SectionBanner
            tag="PIPELINE QUALITY"
            title="Stalled · slipped · velocity · ASP"
            caption="Where revenue is leaking before it gets to the bottom of the funnel."
            who="VP Sales · Marketing · RevOps"
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            <KpiCard label="Stalled"      value={`${data.pipelineQuality.stalledDeals} deals`} sub={`${fmtEur(data.pipelineQuality.stalledArr)} at risk`} emphasised />
            <KpiCard label="Slipped"      value={`${data.pipelineQuality.slippedDeals} deals`} sub={`${fmtEur(data.pipelineQuality.slippedArr)} moved last month`} />
            <KpiCard label="Median cycle" value={`${data.pipelineQuality.avgCycle} days`}      sub="Won · created → closed" />
            <KpiCard label="ASP (won)"    value={fmtEur(data.pipelineQuality.aspEur)}          sub="All-time, won deals" />
          </div>

          <SectionH meta="Open opps flagged across four dimensions">Quality flags</SectionH>
          <Table
            headers={[
              { key: 'flag',       label: 'Quality flag',                       bold: true },
              { key: 'arr_keur',   label: 'ARR',          align: 'right', numeric: true, bold: true },
              { key: 'deals',      label: 'Deals',        align: 'right', numeric: true },
              { key: 'flag_owner', label: 'Owner',        align: 'right', muted: true },
            ]}
            rows={data.qualityFlags}
            formatters={{
              flag: (v, r) => <Pill kind={r.severity === 'red' ? 'negative' : 'neutral'}>{v}</Pill>,
              arr_keur: (v) => `€${Math.round(v).toLocaleString()}K`,
            }}
          />
          <FindingBox>
            <strong style={{ color: T.black }}>Where to focus first.</strong>{' '}
            {h.staleDeals} deals worth <strong style={{ color: T.black }}>{fmtEur(h.staleArr)}</strong> have not had an AE touch in 30+ days.
            UK Mid-Market alone holds €296K across 6 deals. Single biggest at-risk deal:{' '}
            <strong style={{ color: T.black }}>Wise (J. Patel, €161K, 85d silent)</strong>.
          </FindingBox>

          <SectionH meta="Open pipeline, current snapshot">Top stale deals · the call list</SectionH>
          <Table
            headers={[
              { key: 'account_name',   label: 'Account',          bold: true },
              { key: 'rep_name',       label: 'Rep',              muted: true },
              { key: 'market_segment', label: 'Market · Segment', muted: true },
              { key: 'stage',          label: 'Stage',            muted: true },
              { key: 'arr_keur',       label: 'ARR',   align: 'right', numeric: true, bold: true },
              { key: 'days_silent',    label: 'Days silent', align: 'right' },
            ]}
            rows={data.topStale.map(r => ({ ...r, market_segment: `${r.market} · ${r.segment}` }))}
            formatters={{
              arr_keur:    (v) => `€${v}K`,
              days_silent: (v) => <Pill kind={v >= 60 ? 'negative' : 'neutral'}>{v}d</Pill>,
            }}
          />

          <SectionH meta="Avg days an open deal spends in each stage">Pipeline velocity</SectionH>
          <VelocityByStage data={data} />
          <FindingBox>
            Initial Meeting (83d) and Qualified (79d) are the longest open stages — also where most stale deals sit.
            A stage-exit-criteria review with sales leads would compress the cycle.
          </FindingBox>

          <SectionH meta="Closed-won, all-time">ASP by demand source</SectionH>
          <AspBySource data={data} />
          <FindingBox>
            <strong style={{ color: T.black }}>Partnerships and Marketing punch above their weight on deal size</strong> —
            ASP €93K and €68K vs €32K for SDR / AE Outbound. Outbound generates volume; inbound and partnership generate value.
          </FindingBox>

          <SectionH meta="Last 9 months">Slippage trend · close-date drift on open pipeline</SectionH>
          <SlippageTrendChart data={data} />

          <SectionH meta="Open pipeline by market × segment">Stale concentration</SectionH>
          <StaleBySegmentChart data={data} />
        </div>

        {/* ===== Pipeline by market ===== */}
        <SectionBanner
          tag="PIPELINE BY MARKET"
          title="Mid-Market drives both the open pipeline and the risk"
          caption="Open deals, gross ARR, probability-weighted ARR, and stale share."
        />
        <Table
          headers={[
            { key: 'market',         label: 'Market',     bold: true },
            { key: 'segment',        label: 'Segment',    muted: true },
            { key: 'open_deals',     label: 'Open deals',   align: 'right', numeric: true },
            { key: 'arr_keur',       label: 'Gross ARR',    align: 'right', numeric: true },
            { key: 'weighted_keur',  label: 'Weighted ARR', align: 'right', numeric: true },
            { key: 'stale_deals',    label: 'Stale deals',  align: 'right', numeric: true },
            { key: 'stale_keur',     label: 'Stale ARR',    align: 'right', numeric: true },
          ]}
          rows={data.pipeByMarket}
          formatters={{
            arr_keur:      (v) => `€${Math.round(v)}K`,
            weighted_keur: (v) => `€${Math.round(v)}K`,
            stale_keur:    (v) => v > 0 ? <Pill kind="negative">€{Math.round(v)}K</Pill> : '—',
          }}
        />

        {/* ===== Funnel ===== */}
        <div style={{ background: T.panel, borderRadius: 20, padding: '32px 32px 36px', marginTop: 56 }}>
          <SectionBanner
            tag="FUNNEL CONVERSION"
            title="By stage · trail 13W"
            caption="All deals in this dataset are SLG — no PLG split applicable."
            who="Marketing · SLG · RevOps"
          />
          <FunnelChart data={data} />

          <SectionH meta="Trail 12 months · sorted by win rate">By demand source × segment</SectionH>
          <Table
            headers={[
              { key: 'demand_source', label: 'Source' },
              { key: 'segment',       label: 'Segment',     muted: true },
              { key: 'leads', label: 'Leads', align: 'right', numeric: true },
              { key: 'opps',  label: 'Opps',  align: 'right', numeric: true },
              { key: 'won',   label: 'Won',   align: 'right', numeric: true, bold: true },
              { key: 'won_keur',   label: 'Won ARR',     align: 'right', numeric: true },
              { key: 'lead_to_won',label: 'Lead → Won',  align: 'right' },
            ]}
            rows={data.funnelBySource}
            formatters={{
              won_keur:    (v) => v ? `€${Math.round(v)}K` : '—',
              lead_to_won: (v) => v == null ? '—' :
                <Pill kind={v >= 20 ? 'positive' : v >= 10 ? 'neutral' : 'negative'}>{v}%</Pill>,
            }}
          />
        </div>

        {/* ===== Rep attainment ===== */}
        <SectionBanner
          tag="REP ATTAINMENT"
          title="Q2 attainment is uniformly 0% across the team"
          caption="This is a system signal, not a coaching problem. Q1 had a single contributor (K. Nguyen)."
          who="AE leadership · RevOps"
        />
        <Table
          headers={[
            { key: 'rep_name',       label: 'Rep', bold: true },
            { key: 'team',           label: 'Team',             muted: true },
            { key: 'market_segment', label: 'Market · Segment', muted: true },
            { key: 'tgt',  label: 'Q2 target', align: 'right', numeric: true },
            { key: 'won',  label: 'Q2 won',    align: 'right', numeric: true },
            { key: 'q1_att', label: 'Q1 att', align: 'right' },
            { key: 'q2_att', label: 'Q2 att', align: 'right' },
          ]}
          rows={data.rep.map(r => ({
            ...r,
            market_segment: `${r.market} · ${r.segment}`,
            tgt: `€${Math.round(r.tgt_eur/1000)}K`,
            won: `€${Math.round(r.won_eur/1000)}K`,
          }))}
          formatters={{
            q1_att: (v) => <Pill kind={v >= 100 ? 'positive' : v >= 50 ? 'neutral' : 'negative'}>{v}%</Pill>,
            q2_att: (v) => <Pill kind={v >= 100 ? 'positive' : v >= 50 ? 'neutral' : 'negative'}>{v}%</Pill>,
          }}
        />

        {/* ===== Cumulative ARR (supporting) ===== */}
        <div style={{ background: T.panel, borderRadius: 20, padding: '32px 32px 36px', marginTop: 56 }}>
          <SectionBanner
            tag="SUPPORTING · NO CHURN"
            title="Cumulative ARR book"
            caption="If no contracts churn, the running total of new closed-won is the ending ARR book. This dataset has no churn event — shown here as supporting context only, not headline attainment."
          />
          <FindingBox>
            <strong style={{ color: T.black }}>Disclaimer.</strong>{' '}
            Pleo's brief (Assumptions R36) defines attainment as new closed-won ARR in the target period —
            that's what every other section measures. This chart assumes <strong style={{ color: T.black }}>zero churn</strong>,
            which is consistent with the dataset but would not hold in production.
            Ending book today: <strong style={{ color: T.black, ...numStyle }}>€{Math.round(lastCum / 1000).toLocaleString()}K</strong>.
          </FindingBox>
          <CumulativeArrChart data={data} />
        </div>

        {/* ===== Data quality ===== */}
        <SectionBanner
          tag="DATA QUALITY"
          title="CRM hygiene — the second automation opportunity"
          caption="Where Pleo's pre-cleaned columns disagree with the canonical re-derivation."
          who="RevOps · Sales Ops"
        />
        <Table
          headers={[
            { key: 'field',     label: 'Field' },
            { key: 'drift',     label: 'Drift / total', align: 'right', numeric: true },
            { key: 'drift_pct', label: '% drift',       align: 'right' },
          ]}
          rows={data.drift.map(r => ({
            ...r,
            drift: `${r.drift_rows} / ${r.total}`,
            drift_pct: r.drift_rows / r.total * 100,
          }))}
          formatters={{
            drift_pct: (v) => v === 0 ? <Pill kind="positive">0%</Pill> : <Pill kind="neutral">{v.toFixed(1)}%</Pill>,
          }}
        />
        <FindingBox>
          <strong style={{ color: T.black }}>Why this matters.</strong>{' '}
          The 11 distinct values in <code style={{ background: T.hairline, padding: '1px 6px', borderRadius: 4 }}>segment_raw</code>{' '}
          for 3 canonical segments, plus the market label drift, mean the analyst time spent on label reconciliation is recurring waste.
          Locking the CRM picklists eliminates it and improves forecast reliability.
        </FindingBox>

        {/* ===== Actions ===== */}
        <SectionBanner
          tag="RECOMMENDATIONS"
          title="Monday actions"
          caption="Specific, owned, time-bound. EUR values are conservative."
          who="CRO · VP Sales · RevOps"
        />
        <Card style={{ padding: 0 }}>
          {data.actions.map((a, i) => (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '1fr 180px 160px 100px',
              gap: 16, padding: '20px 24px',
              alignItems: 'center',
              borderTop: i > 0 ? `1px solid ${T.hairline}` : 'none',
            }}>
              <div>
                <Pill kind={a.severity === 'red' ? 'negative' : 'neutral'}>Action</Pill>
                <div style={{ fontSize: 14, marginTop: 8, color: T.textSec, lineHeight: 1.55 }}>{a.title}</div>
              </div>
              <div style={{ fontSize: 12, color: T.textMuted }}>{a.owner}</div>
              <div style={{ ...numStyle, fontSize: 14, fontWeight: 600, color: T.black }}>{a.value}</div>
              <div style={{ fontSize: 11, color: T.textMuted, textAlign: 'right',
                            textTransform: 'uppercase', letterSpacing: '0.05em' }}>{a.when}</div>
            </div>
          ))}
        </Card>

        <footer style={{
          marginTop: 64, paddingTop: 24, borderTop: `1px solid ${T.hairline}`,
          fontSize: 11, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em'
        }}>
          Daniel Amezquita · dbt + DuckDB + React · {data.hero.asOf}
        </footer>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary><App /></ErrorBoundary>
);
