import React from 'react';
import { Icon } from './icons.jsx';
import { useT } from './i18n.jsx';
import { DashboardTab } from './dashboard.jsx';
import { SEED_SALES, SEED_OPS, SEED_WORKSHOP, SEED_FINANCE } from './data.js';

/* ============================================================
   AI Reporting area.
   ============================================================ */

const repMoney = (n) =>
  n >= 1e6 ? '€' + (n / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'M'
  : n >= 1e3 ? '€' + Math.round(n / 1e3) + 'k'
  : '€' + n;

const TRACK_META = {
  sales:      { label: 'Sales',      color: 'var(--track-sales)' },
  operations: { label: 'Operations', color: 'var(--track-ops)' },
  workshop:   { label: 'Workshop',   color: 'var(--track-workshop)' },
  finance:    { label: 'Finance',    color: 'var(--track-finance)' },
};
const ALL_TRACKS = ['sales', 'operations', 'workshop', 'finance'];

const SOURCE_NAMES = {
  CRM: 'Salesforce CRM', API: 'Supplier APIs', Talend: 'Talend ETL',
  CSV: 'Bulk CSV', PEPPOL: 'PEPPOL', Exact: 'Exact Online',
};
const sourcesFrom = (items) => {
  const set = new Set();
  items.forEach(it => (it.sources || []).forEach(s => set.add(s)));
  return [...set].map(s => SOURCE_NAMES[s] || s);
};

/* ---- Compute the real numbers per track ---- */
const computeTrack = (track) => {
  if (track === 'sales') {
    const s = SEED_SALES;
    const pipeline = s.reduce((a, x) => a + x.value, 0);
    const risk = s.filter(x => x.status === 'red');
    const riskVal = risk.reduce((a, x) => a + x.value, 0);
    const stageVal = (id) => s.filter(x => x.stageId === id).reduce((a, x) => a + x.value, 0);
    return {
      metrics: [
        { label: 'Open pipeline', value: repMoney(pipeline) },
        { label: 'Open deals', value: s.length },
        { label: 'At risk', value: repMoney(riskVal), tone: 'bad', sub: `${risk.length} deals` },
        { label: 'In contract', value: s.filter(x => x.stageId === 'contract').length },
      ],
      chart: { kind: 'bar', title: 'Pipeline value by stage', bars: [
        { label: 'Meeting', value: stageVal('meeting') },
        { label: 'Offer', value: stageVal('offer') },
        { label: 'Contract', value: stageVal('contract') },
      ].map(b => ({ ...b, display: repMoney(b.value) })) },
      sources: sourcesFrom(s),
    };
  }
  if (track === 'operations') {
    const o = SEED_OPS;
    const attention = o.filter(x => x.status !== 'green');
    return {
      metrics: [
        { label: 'Vehicles in flow', value: o.length },
        { label: 'Needs attention', value: attention.length, tone: attention.length ? 'warn' : 'good' },
        { label: 'Delayed', value: o.filter(x => /late/.test(x.daysLabel || '')).length },
        { label: 'Service due', value: o.filter(x => x.stageId === 'service_due').length },
      ],
      chart: { kind: 'bar', title: 'Vehicles by status', bars: [
        { label: 'On track', value: o.filter(x => x.status === 'green').length },
        { label: 'Attention', value: o.filter(x => x.status === 'amber').length },
        { label: 'Late', value: o.filter(x => x.status === 'red').length },
      ].map(b => ({ ...b, display: String(b.value) })) },
      sources: sourcesFrom(o),
    };
  }
  if (track === 'workshop') {
    const w = SEED_WORKSHOP;
    const stageCount = (id) => w.filter(x => x.stageId === id).length;
    return {
      metrics: [
        { label: 'Open work orders', value: w.length },
        { label: 'In repair', value: stageCount('in_repair') },
        { label: 'Ready for pickup', value: w.filter(x => /pickup|released/i.test(x.stageName)).length, tone: 'good' },
        { label: 'Supplier invoices', value: repMoney(w.filter(x => x.value).reduce((a, x) => a + x.value, 0)) },
      ],
      chart: { kind: 'bar', title: 'Work orders by stage', bars: [
        { label: 'Parts', value: stageCount('parts') },
        { label: 'In repair', value: stageCount('in_repair') },
        { label: 'Released', value: stageCount('released') },
        { label: 'Invoice in', value: stageCount('invoice_in') },
      ].map(b => ({ ...b, display: String(b.value) })) },
      sources: sourcesFrom(w),
    };
  }
  // finance
  const f = SEED_FINANCE;
  const receivable = f.filter(x => x.type === 'INVOICE');
  const overdue = receivable.filter(x => x.stageId === 'overdue');
  const awaiting = receivable.filter(x => x.stageId === 'awaiting');
  const payable = f.filter(x => x.type === 'SUPPLIER');
  const sum = (arr) => arr.reduce((a, x) => a + x.value, 0);
  return {
    metrics: [
      { label: 'Receivables', value: repMoney(sum(receivable)) },
      { label: 'Overdue', value: repMoney(sum(overdue)), tone: 'bad', sub: `${overdue.length} invoice` },
      { label: 'Awaiting', value: repMoney(sum(awaiting)) },
      { label: 'Supplier payable', value: repMoney(sum(payable)) },
    ],
    chart: { kind: 'bar', title: 'Receivables aging', bars: [
      { label: 'Current', value: sum(awaiting) },
      { label: '31d+', value: sum(overdue) },
    ].map(b => ({ ...b, display: repMoney(b.value) })) },
    sources: sourcesFrom(f),
  };
};

const TREND = { title: 'Records synced · last 7 days',
  labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  points: [2100, 2380, 1980, 2560, 2240, 2680, 2840] };

/* ---- Report templates (one-click) ---- */
const REPORT_TEMPLATES = [
  { id: 'weekly', icon: 'document', title: 'Weekly fleet summary',
    desc: 'Cross-track health check for the week.',
    scope: ['sales', 'operations', 'workshop', 'finance'], period: 'This week', format: 'Executive brief' },
  { id: 'cashflow', icon: 'invoice', title: 'Cashflow & receivables',
    desc: 'Outstanding invoices, overdue, supplier payables.',
    scope: ['finance'], period: 'This month', format: 'Detailed breakdown' },
  { id: 'pipeline', icon: 'bolt', title: 'Sales pipeline',
    desc: 'Open deals, at-risk renewals, stage movement.',
    scope: ['sales'], period: 'This quarter', format: 'Detailed breakdown' },
  { id: 'workshop', icon: 'truck', title: 'Workshop throughput',
    desc: 'Work orders, repairs, vehicle availability.',
    scope: ['workshop', 'operations'], period: 'This week', format: 'Executive brief' },
];

const PERIODS = ['This week', 'This month', 'This quarter'];
const FORMATS = ['Executive brief', 'Detailed breakdown', 'Board summary'];

/* ---- AI prose (live + scripted fallback) ---- */
const scriptedProse = (scope) => {
  const d = {}; scope.forEach(t => d[t] = computeTrack(t));
  const tracks = {};
  if (d.sales) tracks.sales = `Open pipeline stands at ${d.sales.metrics[0].value} across ${d.sales.metrics[1].value} deals. ${d.sales.metrics[2].value} is at risk across red deals needing follow-up, while three deals sit in contract — led by the Brussels Energy renewal awaiting signature.`;
  if (d.operations) tracks.operations = `${d.operations.metrics[0].value} vehicles are active in the flow. One delivery is running late and two vehicles are due for service; the remainder are on track.`;
  if (d.workshop) tracks.workshop = `${d.workshop.metrics[0].value} work orders are open — one in repair, one released and ready for pickup, and a Bosch PEPPOL invoice awaiting approval.`;
  if (d.finance) tracks.finance = `${d.finance.metrics[0].value} in receivables outstanding, of which ${d.finance.metrics[1].value} is 31+ days overdue. A supplier invoice is queued for payment.`;
  const clauses = [];
  if (d.sales) clauses.push(`${d.sales.metrics[0].value} in open pipeline`);
  if (d.finance) clauses.push(`${d.finance.metrics[0].value} in receivables`);
  const risks = [];
  if (d.sales) risks.push(`${d.sales.metrics[2].value} of at-risk deals`);
  if (d.finance) risks.push(`a ${d.finance.metrics[1].value} overdue invoice`);
  const headline = `${clauses.join(' and ') || 'Operations across the fleet are steady'}${clauses.length ? '.' : '.'} ${risks.length ? 'Key risks: ' + risks.join(' and ') + '.' : ''} ${d.operations ? 'Operations are largely on track with one late delivery.' : ''}`.trim();
  return { headline, tracks };
};

const parseProseJSON = (text) => {
  if (!text) return null;
  let s = String(text).trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a === -1 || b === -1) return null;
  try { return JSON.parse(s.slice(a, b + 1)); } catch (e) { return null; }
};

const generateProse = async (spec) => {
  const data = {}; spec.scope.forEach(t => data[t] = computeTrack(t).metrics);
  const prompt = `You are the analyst of an "Intelligence Layer" fleet-operations console for DLPE-Group.
Write a ${spec.format} report titled "${spec.title}" covering ${spec.period.toLowerCase()}.
The user's request: "${spec.prompt || spec.title}".
Use ONLY these computed figures (do not invent numbers):
${JSON.stringify(data)}
Reply with ONLY a JSON object, no markdown:
{"headline":"2-3 sentence executive summary","tracks":{${spec.scope.map(t => `"${t}":"1-2 sentence analysis"`).join(',')}}}
Keep it crisp and specific to the figures. ${spec.format === 'Board summary' ? 'Frame for a board: lead with risk and money.' : ''}`;
  try {
    if (window.claude && window.claude.complete) {
      const text = await window.claude.complete({ messages: [{ role: 'user', content: prompt }] });
      const parsed = parseProseJSON(text);
      if (parsed && parsed.headline && parsed.tracks) return parsed;
    }
  } catch (e) { /* fall through */ }
  return scriptedProse(spec.scope);
};

/* ---- Charts ---- */
const BarChart = ({ bars, color }) => {
  const max = Math.max(1, ...bars.map(b => b.value));
  return (
    <div className="repBars">
      {bars.map((b, i) => (
        <div className="repBarRow" key={i}>
          <span className="lbl">{b.label}</span>
          <div className="track"><i style={{ width: `${(b.value / max) * 100}%`, background: color }} /></div>
          <span className="val">{b.display}</span>
        </div>
      ))}
    </div>
  );
};

const TrendLine = ({ points, labels, color }) => {
  const max = Math.max(...points), min = Math.min(...points);
  const span = max - min || 1;
  const n = points.length;
  const xy = points.map((v, i) => [ (i / (n - 1)) * 100, 38 - ((v - min) / span) * 30 - 4 ]);
  const line = xy.map(p => `${p[0]},${p[1]}`).join(' ');
  const area = `0,40 ${line} 100,40`;
  return (
    <div className="repTrend">
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="repTrendSvg">
        <polygon points={area} fill={color} opacity="0.1" />
        <polyline points={line} fill="none" stroke={color} strokeWidth="1.4"
                  vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
        {xy.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="1.4" fill={color} vectorEffect="non-scaling-stroke" />)}
      </svg>
      <div className="repTrendLabels">{labels.map((l, i) => <span key={i}>{l}</span>)}</div>
    </div>
  );
};

const SourceChips = ({ sources }) => (
  <div className="repSources">
    {sources.map((s, i) => <span className="repSourceChip" key={i}><span className="dot" />{s}</span>)}
  </div>
);

/* ---- Report document (the view) ---- */
const ReportDoc = ({ report, onBack }) => {
  const allSources = [...new Set(report.spec.scope.flatMap(t => computeTrack(t).sources))];
  return (
    <div className="repDocWrap">
      <div className="repDocActions">
        <button className="cta ghost" onClick={onBack}>← Library</button>
        <div style={{ flex: 1 }} />
        <button className="cta ghost" onClick={() => window.print()}>
          <Icon name="download" size={12} strokeWidth={2} /> Export PDF
        </button>
      </div>

      <article className="repDoc">
        <header className="repDocHead">
          <div className="repBadge"><Icon name="sparkles" size={12} strokeWidth={1.8} /> AI-generated report</div>
          <h1>{report.spec.title}</h1>
          <div className="repMeta">
            <span>{report.spec.period}</span><span>·</span>
            <span>{report.spec.format}</span><span>·</span>
            <span>Generated {report.when}</span>
          </div>
          <SourceChips sources={allSources} />
        </header>

        <section className="repSummary">
          <h2>Executive summary</h2>
          <p>{report.prose.headline}</p>
        </section>

        <section className="repTrendSection">
          <h2>{TREND.title}</h2>
          <TrendLine points={TREND.points} labels={TREND.labels} color="var(--brand)" />
        </section>

        {report.spec.scope.map(track => {
          const data = computeTrack(track);
          const meta = TRACK_META[track];
          return (
            <section className="repTrack" key={track}>
              <div className="repTrackHead">
                <span className="repTrackSwatch" style={{ background: meta.color }} />
                <h2>{meta.label}</h2>
              </div>
              {report.prose.tracks[track] && <p className="repTrackNote">{report.prose.tracks[track]}</p>}
              <div className="repTrackMetrics">
                {data.metrics.map((m, i) => (
                  <div className={`repMetric ${m.tone || ''}`} key={i}>
                    <div className="l">{m.label}</div>
                    <div className="v">{m.value}</div>
                    {m.sub && <div className="s">{m.sub}</div>}
                  </div>
                ))}
              </div>
              <div className="repChartCard">
                <div className="repChartTitle">{data.chart.title}</div>
                <BarChart bars={data.chart.bars} color={meta.color} />
              </div>
            </section>
          );
        })}

        <footer className="repDocFoot">
          Generated by the Intelligence Layer from the unified DataSource · figures reflect live integration data.
        </footer>
      </article>
    </div>
  );
};

/* ---- Guided builder (the creation flow) ---- */
const ReportBuilder = ({ draft, setDraft, onGenerate, busy }) => {
  const Seg = ({ options, value, onChange }) => (
    <div className="repSeg">
      {options.map(o => (
        <button key={o} className={value === o ? 'on' : ''} onClick={() => onChange(o)}>{o}</button>
      ))}
    </div>
  );
  return (
    <div className="repBuilder">
      <div className="repBuilderLead">
        <Icon name="sparkles" size={14} strokeWidth={1.8} />
        <span>I'll generate this report. Confirm a few details:</span>
      </div>
      <div className="repField">
        <label>Report request</label>
        <input value={draft.prompt} onChange={e => setDraft(d => ({ ...d, prompt: e.target.value, title: e.target.value }))}
               placeholder="What should this report cover?" />
      </div>
      <div className="repField">
        <label>Period</label>
        <Seg options={PERIODS} value={draft.period} onChange={v => setDraft(d => ({ ...d, period: v }))} />
      </div>
      <div className="repField">
        <label>Scope · tracks to include</label>
        <div className="repChipPick">
          {ALL_TRACKS.map(t => {
            const on = draft.scope.includes(t);
            return (
              <button key={t} className={`repTrackChip ${on ? 'on' : ''}`}
                onClick={() => setDraft(d => ({ ...d, scope: on ? d.scope.filter(x => x !== t) : [...d.scope, t] }))}>
                <span className="sw" style={{ background: TRACK_META[t].color }} />{TRACK_META[t].label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="repField">
        <label>Format</label>
        <Seg options={FORMATS} value={draft.format} onChange={v => setDraft(d => ({ ...d, format: v }))} />
      </div>
      <button className="cta repGenBtn" disabled={busy || !draft.scope.length || !draft.prompt.trim()} onClick={onGenerate}>
        {busy ? <><span className="aimMiniSpin" /> Generating…</> : <><Icon name="sparkles" size={13} strokeWidth={1.8} /> Generate report</>}
      </button>
    </div>
  );
};

/* ---- Main view ---- */
const REPORTS_KEY = 'dlpe_reports_v1';
const makeSeedReports = () => ([
  { id: 'seed-1', spec: { title: 'Weekly fleet summary', prompt: 'Weekly fleet summary', period: 'This week', format: 'Executive brief', scope: ['sales', 'operations', 'workshop', 'finance'] },
    when: 'May 26 · 08:40', prose: scriptedProse(['sales', 'operations', 'workshop', 'finance']) },
  { id: 'seed-2', spec: { title: 'Q2 cashflow & receivables', prompt: 'Cashflow and receivables review', period: 'This quarter', format: 'Detailed breakdown', scope: ['finance'] },
    when: 'May 22 · 16:12', prose: scriptedProse(['finance']) },
]);

export const ReportsView = () => {
  const { t } = useT();
  const [tab, setTab] = React.useState('dashboard'); // dashboard | create | library
  const [reports, setReports] = React.useState(() => {
    try { const s = JSON.parse(localStorage.getItem(REPORTS_KEY)); if (Array.isArray(s) && s.length) return s; } catch (e) {}
    return makeSeedReports();
  });
  const [open, setOpen] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const [draft, setDraft] = React.useState(null);

  const persist = (next) => { setReports(next); try { localStorage.setItem(REPORTS_KEY, JSON.stringify(next)); } catch (e) {} };

  const startFromPrompt = (prompt) => {
    setDraft({ prompt, title: prompt, period: 'This week', format: 'Executive brief', scope: [...ALL_TRACKS] });
  };
  const startFromTemplate = (tpl) => {
    const spec = { title: tpl.title, prompt: tpl.desc, period: tpl.period, format: tpl.format, scope: [...tpl.scope] };
    runGenerate(spec);
  };

  const runGenerate = async (spec) => {
    setBusy(true);
    const prose = await generateProse(spec);
    const report = { id: 'r-' + Date.now(), spec, prose,
      when: new Date().toLocaleString('en-GB', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) };
    persist([report, ...reports]);
    setBusy(false);
    setDraft(null);
    setOpen(report);
  };

  if (open) return <ReportDoc report={open} onBack={() => { setOpen(null); setTab('library'); }} />;

  return (
    <div className="viewWrap">
      <div className="viewHero">
        <div>
          <h1>Reports</h1>
          <div className="sub">A pipeline dashboard, analyst-grade reports, and a saved library — all from the unified DataSource. Track follow-ups across every track, build your own charts, or generate a written report in plain language.</div>
        </div>
        <div className="repTabs">
          <button className={tab === 'dashboard' ? 'on' : ''} onClick={() => setTab('dashboard')}>Dashboard</button>
          <button className={tab === 'create' ? 'on' : ''} onClick={() => setTab('create')}>Create</button>
          <button className={tab === 'library' ? 'on' : ''} onClick={() => setTab('library')}>Library · {reports.length}</button>
        </div>
      </div>

      {tab === 'dashboard' ? (
        <DashboardTab />
      ) : tab === 'create' ? (
        <div className="repCreate">
          <div className="repComposer">
            <span className="repComposerIcon"><Icon name="sparkles" size={16} strokeWidth={1.8} /></span>
            <input
              placeholder={"Ask for a report… e.g. “How did sales perform this week and what’s at risk?”"}
              onKeyDown={e => { if (e.key === 'Enter' && e.target.value.trim()) startFromPrompt(e.target.value.trim()); }}
              defaultValue={draft ? draft.prompt : ''}
              key={draft ? draft.prompt : 'empty'} />
          </div>

          {draft ? (
            <ReportBuilder draft={draft} setDraft={setDraft} busy={busy}
              onGenerate={() => runGenerate(draft)} />
          ) : (
            <>
              <div className="repSectionLabel">Start from a template</div>
              <div className="repTemplates">
                {REPORT_TEMPLATES.map(tpl => (
                  <button key={tpl.id} className="repTemplate" disabled={busy} onClick={() => startFromTemplate(tpl)}>
                    <span className="repTemplateIco"><Icon name={tpl.icon} size={16} /></span>
                    <div className="repTemplateMain">
                      <div className="nm">{tpl.title}</div>
                      <div className="ds">{tpl.desc}</div>
                      <div className="repTemplateMeta">
                        {tpl.scope.map(s => <span className="sw" key={s} style={{ background: TRACK_META[s].color }} />)}
                        <span>{tpl.period}</span>
                      </div>
                    </div>
                    {busy && <span className="aimMiniSpin dark" />}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="repLibrary">
          {reports.length === 0 && <div className="repEmpty">No reports yet — create one from the Create tab.</div>}
          {reports.map(r => {
            const srcs = [...new Set(r.spec.scope.flatMap(tk => computeTrack(tk).sources))];
            return (
              <button key={r.id} className="repCard" onClick={() => setOpen(r)}>
                <div className="repCardTop">
                  <span className="repBadge sm"><Icon name="sparkles" size={10} strokeWidth={1.8} /> AI</span>
                  <span className="repCardWhen">{r.when}</span>
                </div>
                <div className="repCardTitle">{r.spec.title}</div>
                <div className="repCardMeta">{r.spec.period} · {r.spec.format}</div>
                <div className="repCardScope">
                  {r.spec.scope.map(s => (
                    <span className="repTrackChip mini" key={s}><span className="sw" style={{ background: TRACK_META[s].color }} />{TRACK_META[s].label}</span>
                  ))}
                </div>
                <div className="repCardSources">{srcs.length} source{srcs.length === 1 ? '' : 's'} · {srcs.slice(0, 2).join(', ')}{srcs.length > 2 ? '…' : ''}</div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
