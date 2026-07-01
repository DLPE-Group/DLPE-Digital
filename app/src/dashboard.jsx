import React from 'react';
import { Icon } from './icons.jsx';
import { api } from './api/client.js';

/* ============================================================
   Pipeline dashboard — the landing surface of the reporting area.
   ============================================================ */

const dbMoney = (n) =>
  n == null ? '—'
  : n >= 1e6 ? '€' + (n / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'M'
  : n >= 1e3 ? '€' + Math.round(n / 1e3) + 'k'
  : '€' + Math.round(n);

/* ---- Metric catalogue — generic + data-driven; VALUES come from the server
   (/aggregations/dashboard), which computes them from the tenant's own tracks.
   No fleet-specific metrics: these apply to ANY tenant. ---- */
export const METRICS = {
  openItems:    { id: 'openItems',    label: 'Open items',          unit: '',  shape: 'counter', color: 'var(--brand)' },
  totalValue:   { id: 'totalValue',   label: 'Total value',         unit: '€', shape: 'money',   color: 'var(--track-sales)' },
  atRisk:       { id: 'atRisk',       label: 'At risk',             unit: '€', shape: 'money',   color: 'var(--status-red)' },
  openByTrack:  { id: 'openByTrack',  label: 'Open items by track', unit: '',  shape: 'cats',    color: 'var(--brand)' },
  valueByTrack: { id: 'valueByTrack', label: 'Value by track',      unit: '€', shape: 'cats',    color: 'var(--track-sales)' },
};

const TYPES_FOR_SHAPE = {
  series: ['line', 'stat'],
  counter: ['stat', 'line'],
  money: ['stat', 'line'],
  cats: ['bar'],
  segments: ['donut', 'bar'],
};
const fmtValue = (m, v) => v == null ? '—' : m.shape === 'money' ? dbMoney(v) : (m.unit && m.unit !== '€' ? `${v}${m.unit === '%' ? '%' : ' ' + m.unit}` : v.toLocaleString());

/* ---- Snapshot data hook — fetched once from the server, with manual refresh. ---- */
const useLiveData = () => {
  const [data, setData] = React.useState(null);
  const [asOf, setAsOf] = React.useState(null);
  const load = React.useCallback(() => {
    api.get('/aggregations/dashboard')
      .then((res) => { setData(res.metrics); setAsOf(res.asOf); })
      .catch((e) => console.error('Failed to load dashboard metrics', e));
  }, []);
  React.useEffect(() => { load(); }, [load]);
  return { data, asOf, refresh: load };
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
          <div className="track"><i style={{ width: `${((c.value || 0) / max) * 100}%`, background: c.color || color }} /></div>
          <span className="val">{c.value == null ? '—' : c.value >= 1000 ? dbMoney(c.value) : c.value}</span>
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

const LiveStat = ({ m, d }) => (
  <div className="dbStat">
    <div className="dbStatVal">{fmtValue(m, d.value)}</div>
    {d.series && <div className="dbStatSpark"><LiveLine pts={d.series} color={m.color} height={34} /></div>}
  </div>
);

const LiveChart = ({ type, metric, d }) => {
  if (!d) return null;
  if (type === 'line') return <LiveLine pts={d.series} color={metric.color} />;
  if (type === 'bar') return <LiveBars cats={d.cats} color={metric.color} />;
  if (type === 'donut') return <LiveDonut segments={d.segments} />;
  return <LiveStat m={metric} d={d} />;
};

/* ---- Chart builder modal ---- */
const ChartBuilder = ({ live, onAdd, onClose }) => {
  const [metricId, setMetricId] = React.useState('openItems');
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
export const DEFAULT_CHARTS = [
  { id: 'd1', metricId: 'openItems', type: 'stat', title: 'Open items' },
  { id: 'd2', metricId: 'totalValue', type: 'stat', title: 'Total value' },
  { id: 'd3', metricId: 'atRisk', type: 'stat', title: 'At risk' },
  { id: 'd4', metricId: 'openByTrack', type: 'bar', title: 'Open items by track' },
  { id: 'd5', metricId: 'valueByTrack', type: 'bar', title: 'Value by track' },
];

export const DashboardTab = () => {
  const { data, asOf: asOfIso, refresh } = useLiveData();
  const asOf = React.useMemo(
    () => asOfIso ? new Date(asOfIso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '…',
    [asOfIso],
  );
  const [charts, setCharts] = React.useState(DEFAULT_CHARTS);
  const [building, setBuilding] = React.useState(false);

  // Load this user's saved layout from the API (fallback to DEFAULT_CHARTS).
  React.useEffect(() => {
    let cancelled = false;
    api.get('/me/dashboard').then((res) => {
      if (cancelled || !res || !Array.isArray(res.charts)) return;
      setCharts(res.charts);
    }).catch(() => { /* keep DEFAULT_CHARTS fallback */ });
    return () => { cancelled = true; };
  }, []);

  const persist = (next) => {
    setCharts(next);
    api.put('/me/dashboard', { charts: next }).catch(e => console.error('Failed to save dashboard', e));
  };

  return (
    <div className="dbWrap">
      <div className="dbBar">
        <div className="dbAsOf">Pipeline snapshot · as of {asOf}</div>
        <div style={{ flex: 1 }} />
        <button className="cta ghost" onClick={refresh}><Icon name="arrow" size={12} strokeWidth={2} /> Refresh</button>
        <button className="cta" onClick={() => setBuilding(true)}><Icon name="plus" size={12} strokeWidth={2} /> Add chart</button>
      </div>

      {!data && <div className="dbAsOf" style={{ padding: '24px 0' }}>Loading live metrics…</div>}
      {data && (
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
      )}

      {data && building && <ChartBuilder live={data} onClose={() => setBuilding(false)}
        onAdd={(c) => { persist([...charts, c]); setBuilding(false); }} />}
    </div>
  );
};
