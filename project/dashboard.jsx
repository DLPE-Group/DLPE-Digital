/* ============================================================
   Pipeline dashboard — the landing surface of the reporting area.
   A static business snapshot off the DataSource (no streaming)
   plus a chart builder. Chart layout persists; figures reflect
   the current pipeline state across every follow-up track.
   ============================================================ */

const dbMoney = (n) =>
  n >= 1e6 ? '€' + (n / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'M'
  : n >= 1e3 ? '€' + Math.round(n / 1e3) + 'k'
  : '€' + Math.round(n);

const rnd = (a, b) => a + Math.random() * (b - a);
const push = (arr, v, cap = 26) => { const n = [...arr, v]; return n.length > cap ? n.slice(n.length - cap) : n; };
const series = (n, lo, hi) => Array.from({ length: n }, () => Math.round(rnd(lo, hi)));

/* ---- Metric catalogue — business follow-up KPIs (no infra). ---- */
const METRICS = {
  wonThisWeek: {
    id: 'wonThisWeek', label: 'Closed-won this week', unit: '€', shape: 'money', color: 'var(--status-green)',
    change: { dir: 'up', text: '+18% vs last week' },
    init: () => ({ value: 1240000, delta: 0, series: series(22, 980, 1240).map(x => x / 1000) }),
    tick: (p) => { const inc = Math.random() < 0.4 ? Math.round(rnd(20000, 90000)) : 0; const v = p.value + inc; return { value: v, delta: inc, series: push(p.series, v / 1e6) }; },
  },
  followupsDue: {
    id: 'followupsDue', label: 'Follow-ups due today', unit: '', shape: 'counter', color: 'var(--track-ops)',
    change: { dir: 'flat', text: 'incl. 6 overdue' },
    init: () => ({ value: 18, delta: 0, series: series(20, 1, 4) }),
    tick: (p) => { const done = Math.random() < 0.5 ? 1 : 0; const v = Math.max(0, p.value - done); return { value: v, delta: v - p.value, series: push(p.series, done) }; },
  },
  newLeads: {
    id: 'newLeads', label: 'New leads today', unit: '', shape: 'counter', color: 'var(--track-sales)',
    change: { dir: 'up', text: '+3 vs yesterday' },
    init: () => ({ value: 12, delta: 0, series: series(20, 0, 3) }),
    tick: (p) => { const inc = Math.random() < 0.45 ? Math.round(rnd(1, 3)) : 0; return { value: p.value + inc, delta: inc, series: push(p.series, inc) }; },
  },
  pipeline: {
    id: 'pipeline', label: 'Open pipeline', unit: '€', shape: 'money', color: 'var(--track-sales)',
    change: { dir: 'up', text: '+1.4% vs last month' },
    init: () => ({ value: 8620000, delta: 0, series: series(22, 8500, 8720).map(x => x / 1000) }),
    tick: (p) => { const v = 8620000 + Math.round(rnd(-40000, 60000)); return { value: v, delta: v - p.value, series: push(p.series, v / 1e6) }; },
  },
  atRisk: {
    id: 'atRisk', label: 'At-risk pipeline', unit: '€', shape: 'money', color: 'var(--status-red)',
    change: { dir: 'down', text: '3 deals at risk' },
    init: () => ({ value: 2390000, delta: 0, series: series(20, 2.3, 2.45) }),
    tick: (p) => { const v = 2390000 + Math.round(rnd(-30000, 30000)); return { value: v, delta: v - p.value, series: push(p.series, v / 1e6) }; },
  },
  ontime: {
    id: 'ontime', label: 'On-time delivery', unit: '%', shape: 'segments', color: 'var(--status-green)',
    init: () => ({ pct: 87, segments: [{ label: 'On-time', value: 87, color: 'var(--status-green)' }, { label: 'Late', value: 13, color: 'var(--status-amber)' }] }),
    tick: (p) => { let v = Math.round(p.pct + rnd(-2, 2)); v = Math.max(80, Math.min(94, v)); return { pct: v, segments: [{ label: 'On-time', value: v, color: 'var(--status-green)' }, { label: 'Late', value: 100 - v, color: 'var(--status-amber)' }] }; },
  },
  receivables: {
    id: 'receivables', label: 'Receivables split', unit: '€', shape: 'segments', color: 'var(--track-finance)',
    init: () => ({ segments: [{ label: 'Current', value: 185, color: 'var(--track-finance)' }, { label: '31d+ overdue', value: 94, color: 'var(--status-red)' }] }),
    tick: (p) => p, // stable
  },
  pipelineStage: {
    id: 'pipelineStage', label: 'Pipeline by stage', unit: '€', shape: 'cats', color: 'var(--track-sales)',
    init: () => ({ cats: [
      { label: 'Meeting', value: 620000 }, { label: 'Offer', value: 1240000 }, { label: 'Contract', value: 6760000 },
    ] }),
    tick: (p) => ({ cats: p.cats.map(c => ({ ...c, value: Math.max(0, Math.round(c.value + rnd(-c.value * 0.01, c.value * 0.01))) })) }),
  },
  openByTrack: {
    id: 'openByTrack', label: 'Open items by track', unit: '', shape: 'cats', color: 'var(--brand)',
    init: () => ({ cats: [
      { label: 'Sales', value: 5, color: 'var(--track-sales)' },
      { label: 'Operations', value: 6, color: 'var(--track-ops)' },
      { label: 'Workshop', value: 4, color: 'var(--track-workshop)' },
      { label: 'Finance', value: 3, color: 'var(--track-finance)' },
    ] }),
    tick: (p) => p, // stable counts
  },
  workorders: {
    id: 'workorders', label: 'Work orders by stage', unit: '', shape: 'cats', color: 'var(--track-workshop)',
    init: () => ({ cats: [
      { label: 'Parts', value: 1 }, { label: 'In repair', value: 1 }, { label: 'Released', value: 1 }, { label: 'Invoice in', value: 1 },
    ] }),
    tick: (p) => p,
  },
};

const TYPES_FOR_SHAPE = {
  series: ['line', 'stat'],
  counter: ['stat', 'line'],
  money: ['stat', 'line'],
  cats: ['bar'],
  segments: ['donut', 'bar'],
};
const fmtValue = (m, v) => m.shape === 'money' ? dbMoney(v) : (m.unit && m.unit !== '€' ? `${v}${m.unit === '%' ? '%' : ' ' + m.unit}` : v.toLocaleString());

/* ---- Snapshot data hook (static — computed once, no streaming) ---- */
const useLiveData = () => {
  const [data] = React.useState(() => {
    const o = {}; Object.values(METRICS).forEach(m => o[m.id] = m.init()); return o;
  });
  return { data };
};

/* ---- Chart primitives ---- */
const LiveLine = ({ pts, color, height = 64 }) => {
  if (!pts || !pts.length) return null;
  const max = Math.max(...pts), min = Math.min(...pts), span = max - min || 1;
  const n = pts.length;
  const xy = pts.map((v, i) => [(i / (n - 1)) * 100, 38 - ((v - min) / span) * 30 - 4]);
  const line = xy.map(p => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ');
  return (
    <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="dbLineSvg" style={{ height }}>
      <polygon points={`0,40 ${line} 100,40`} style={{ fill: color }} opacity="0.1" />
      <polyline points={line} fill="none" style={{ stroke: color }} strokeWidth="1.5"
                vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={xy[n - 1][0]} cy={xy[n - 1][1]} r="2.2" style={{ fill: color }} vectorEffect="non-scaling-stroke" />
    </svg>
  );
};

const LiveBars = ({ cats, color }) => {
  const max = Math.max(1, ...cats.map(c => c.value));
  return (
    <div className="dbBars">
      {cats.map((c, i) => (
        <div className="dbBarRow" key={i}>
          <span className="lbl">{c.label}</span>
          <div className="track"><i style={{ width: `${(c.value / max) * 100}%`, background: c.color || color }} /></div>
          <span className="val">{c.value >= 1000 ? dbMoney(c.value) : c.value}</span>
        </div>
      ))}
    </div>
  );
};

const LiveDonut = ({ segments }) => {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  const R = 34, C = 2 * Math.PI * R;
  let offset = 0;
  const main = segments[0];
  return (
    <div className="dbDonut">
      <svg viewBox="0 0 90 90">
        <circle cx="45" cy="45" r={R} fill="none" stroke="var(--bg-sunken)" strokeWidth="11" />
        <g transform="rotate(-90 45 45)">
          {segments.map((s, i) => {
            const frac = s.value / total;
            const dash = frac * C;
            const el = (
              <circle key={i} cx="45" cy="45" r={R} fill="none" style={{ stroke: s.color }} strokeWidth="11"
                      strokeDasharray={`${dash} ${C - dash}`} strokeDashoffset={-offset}
                      strokeLinecap="butt" className="dbDonutSeg" />
            );
            offset += dash;
            return el;
          })}
        </g>
        <text x="45" y="42" className="dbDonutPct">{Math.round((main.value / total) * 100)}%</text>
        <text x="45" y="56" className="dbDonutLbl">{main.label}</text>
      </svg>
      <div className="dbDonutLegend">
        {segments.map((s, i) => (
          <div key={i}><span className="sw" style={{ background: s.color }} />{s.label} · {s.value}{Number.isInteger(s.value) && s.value <= 100 ? '' : ''}</div>
        ))}
      </div>
    </div>
  );
};

const LiveStat = ({ m, d }) => {
  const c = m.change;
  return (
    <div className="dbStat">
      <div className="dbStatVal">{fmtValue(m, d.value)}</div>
      {c && (
        <div className={`dbStatDelta ${c.dir}`}>
          {c.dir === 'up' ? '▲ ' : c.dir === 'down' ? '▼ ' : ''}{c.text}
        </div>
      )}
      {d.series && <div className="dbStatSpark"><LiveLine pts={d.series} color={m.color} height={34} /></div>}
    </div>
  );
};

const LiveChart = ({ type, metric, d }) => {
  if (!d) return null;
  if (type === 'line') return <LiveLine pts={d.series} color={metric.color} />;
  if (type === 'bar') return <LiveBars cats={d.cats} color={metric.color} />;
  if (type === 'donut') return <LiveDonut segments={d.segments} />;
  return <LiveStat m={metric} d={d} />;
};

/* ---- Chart builder modal ---- */
const ChartBuilder = ({ live, onAdd, onClose }) => {
  const [metricId, setMetricId] = React.useState('pipeline');
  const metric = METRICS[metricId];
  const allowed = TYPES_FOR_SHAPE[metric.shape];
  const [type, setType] = React.useState(allowed[0]);
  const [title, setTitle] = React.useState(metric.label);

  const pick = (id) => {
    setMetricId(id);
    const a = TYPES_FOR_SHAPE[METRICS[id].shape];
    setType(a[0]);
    setTitle(METRICS[id].label);
  };
  React.useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const TYPE_LABEL = { line: 'Line', bar: 'Bar', donut: 'Donut', stat: 'Stat' };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="dbBuilderPanel" onClick={e => e.stopPropagation()}>
        <div className="dbBuilderHead">
          <div>
            <div className="aimKind">New chart</div>
            <h2>Build a live chart</h2>
          </div>
          <button className="iconBtn" onClick={onClose}><Icon name="close" size={16} /></button>
        </div>
        <div className="dbBuilderBody">
          <div className="dbBuilderForm">
            <div className="repField">
              <label>Metric · from the DataSource</label>
              <div className="dbMetricList">
                {Object.values(METRICS).map(m => (
                  <button key={m.id} className={`dbMetricItem ${metricId === m.id ? 'on' : ''}`} onClick={() => pick(m.id)}>
                    <span className="sw" style={{ background: m.color }} />
                    <span className="nm">{m.label}</span>
                    {m.unit && <span className="un">{m.unit}</span>}
                  </button>
                ))}
              </div>
            </div>
            <div className="repField">
              <label>Chart type</label>
              <div className="repSeg">
                {allowed.map(tp => (
                  <button key={tp} className={type === tp ? 'on' : ''} onClick={() => setType(tp)}>{TYPE_LABEL[tp]}</button>
                ))}
              </div>
            </div>
            <div className="repField">
              <label>Title</label>
              <input value={title} onChange={e => setTitle(e.target.value)} />
            </div>
          </div>
          <div className="dbBuilderPreview">
            <div className="dbPreviewLabel">Preview</div>
            <div className="dbCard dbPreviewCard">
              <div className="dbCardHead"><span className="t">{title}</span></div>
              <div className={`dbCardBody type-${type}`}>
                <LiveChart type={type} metric={metric} d={live[metricId]} />
              </div>
            </div>
          </div>
        </div>
        <div className="dbBuilderFoot">
          <button className="cta ghost" onClick={onClose}>Cancel</button>
          <button className="cta" onClick={() => onAdd({ id: 'c-' + Date.now(), metricId, type, title })}>
            <Icon name="plus" size={12} strokeWidth={2} /> Add to dashboard
          </button>
        </div>
      </div>
    </div>
  );
};

/* ---- Dashboard tab ---- */
const DASH_KEY = 'dlpe_dashboard_v1';
const DEFAULT_CHARTS = [
  { id: 'd1', metricId: 'pipeline', type: 'stat', title: 'Open pipeline' },
  { id: 'd2', metricId: 'atRisk', type: 'stat', title: 'At-risk pipeline' },
  { id: 'd3', metricId: 'wonThisWeek', type: 'stat', title: 'Closed-won this week' },
  { id: 'd4', metricId: 'pipelineStage', type: 'bar', title: 'Pipeline by stage' },
  { id: 'd5', metricId: 'ontime', type: 'donut', title: 'On-time delivery' },
  { id: 'd6', metricId: 'openByTrack', type: 'bar', title: 'Open items by track' },
];

const DashboardTab = () => {
  const { data } = useLiveData();
  const asOf = React.useMemo(() => new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }), []);
  const [charts, setCharts] = React.useState(() => {
    try { const s = JSON.parse(localStorage.getItem(DASH_KEY)); if (Array.isArray(s)) return s; } catch (e) {}
    return DEFAULT_CHARTS;
  });
  const [building, setBuilding] = React.useState(false);
  const persist = (next) => { setCharts(next); try { localStorage.setItem(DASH_KEY, JSON.stringify(next)); } catch (e) {} };

  return (
    <div className="dbWrap">
      <div className="dbBar">
        <div className="dbAsOf">Pipeline snapshot · as of {asOf}</div>
        <div style={{ flex: 1 }} />
        <button className="cta" onClick={() => setBuilding(true)}><Icon name="plus" size={12} strokeWidth={2} /> Add chart</button>
      </div>

      <div className="dbGrid">
        {charts.map(c => {
          const m = METRICS[c.metricId];
          if (!m) return null;
          const big = c.type === 'line' || c.type === 'bar';
          return (
            <div className={`dbCard ${big ? 'wide' : ''}`} key={c.id}>
              <div className="dbCardHead">
                <span className="t">{c.title}</span>
                <button className="dbRemove" onClick={() => persist(charts.filter(x => x.id !== c.id))} title="Remove">
                  <Icon name="close" size={13} />
                </button>
              </div>
              <div className={`dbCardBody type-${c.type}`}>
                <LiveChart type={c.type} metric={m} d={data[c.metricId]} />
              </div>
              {(c.type === 'line') && (
                <div className="dbCardFoot">
                  <span className="now">{fmtValue(m, data[c.metricId].value)}</span>
                  <span className="un">{m.unit}</span>
                </div>
              )}
            </div>
          );
        })}

        <button className="dbAddTile" onClick={() => setBuilding(true)}>
          <span className="plus"><Icon name="plus" size={20} strokeWidth={2} /></span>
          <span>Add a chart</span>
          <span className="sub">Pick a metric & visual</span>
        </button>
      </div>

      {building && <ChartBuilder live={data} onClose={() => setBuilding(false)}
        onAdd={(c) => { persist([...charts, c]); setBuilding(false); }} />}
    </div>
  );
};

Object.assign(window, { DashboardTab, METRICS });
