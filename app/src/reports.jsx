import React from 'react';
import { Icon } from './icons.jsx';
import { useT } from './i18n.jsx';
import { DashboardTab } from './dashboard.jsx';
import { api } from './api/client.js';

/* ============================================================
   AI Reporting area.
   ============================================================ */

const repMoney = (n) =>
  n >= 1e6 ? '€' + (n / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'M'
  : n >= 1e3 ? '€' + Math.round(n / 1e3) + 'k'
  : '€' + n;

// Fallback labels/colors for the builtin tracks — used only until the tenant's
// real track set loads from /tracks (or for a track with no color set).
const TRACK_META_FALLBACK = {
  sales:      { label: 'Sales',      color: 'var(--track-sales)' },
  operations: { label: 'Operations', color: 'var(--track-ops)' },
  workshop:   { label: 'Workshop',   color: 'var(--track-workshop)' },
  finance:    { label: 'Finance',    color: 'var(--track-finance)' },
};
// Resolve a track key to its display meta, preferring the tenant's live data.
const metaFor = (track, trackMeta) =>
  (trackMeta && trackMeta[track]) || TRACK_META_FALLBACK[track] || { label: track, color: 'var(--brand)' };

/* ---- Generic zero/empty aggregate (for loading / empty tenant / API error) ----
   Mirrors the server's generic per-track shape (server/src/domain/aggregations.ts)
   so a failed/empty fetch degrades to the same metric labels as a live one. */
const emptyAgg = () => ({
  metrics: [
    { label: 'Open items', value: 0 },
    { label: 'At risk', value: 0, sub: '0 items' },
    { label: 'On track', value: 0 },
  ],
  chart: { kind: 'bar', title: 'Items by stage', bars: [] },
  sources: [],
});

/* ---- Hook: fetch /aggregations/track/:track for a set of tracks ---- */
const useTrackAggregates = (tracks) => {
  const [aggs, setAggs] = React.useState({});
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!tracks || tracks.length === 0) return;
    let cancelled = false;
    setLoading(true);
    Promise.all(
      tracks.map(t =>
        api.get('/aggregations/track/' + t)
          .then(data => [t, data])
          .catch(() => [t, emptyAgg()])
      )
    ).then(results => {
      if (cancelled) return;
      const map = {};
      results.forEach(([t, data]) => { if (data) map[t] = data; });
      setAggs(map);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [(tracks || []).join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  const get = (track) => aggs[track] || emptyAgg();
  return { get, loading };
};

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

const SourceChips = ({ sources }) => (
  <div className="repSources">
    {sources.map((s, i) => <span className="repSourceChip" key={i}><span className="dot" />{s}</span>)}
  </div>
);

/* ---- Report document (the view) ---- */
const ReportDoc = ({ report, onBack, trackMeta }) => {
  const scope = report.spec.scope;
  const { get, loading } = useTrackAggregates(scope);

  const allSources = [...new Set(scope.flatMap(t => (get(t) || emptyAgg()).sources))];

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

        {loading && <div className="repLoading">Loading track metrics…</div>}

        {scope.map(track => {
          const data = get(track);
          const meta = metaFor(track, trackMeta);
          if (!data) return null;
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
const ReportBuilder = ({ draft, setDraft, onGenerate, busy, allTracks = [], trackMeta }) => {
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
          {allTracks.map(t => {
            const on = draft.scope.includes(t);
            const meta = metaFor(t, trackMeta);
            return (
              <button key={t} className={`repTrackChip ${on ? 'on' : ''}`}
                onClick={() => setDraft(d => ({ ...d, scope: on ? d.scope.filter(x => x !== t) : [...d.scope, t] }))}>
                <span className="sw" style={{ background: meta.color }} />{meta.label}
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

/* ---- Library card: sources shown from report spec scope count ---- */
const LibraryCard = ({ r, onOpen, onDelete, trackMeta }) => {
  return (
    <button className="repCard" onClick={() => onOpen(r)}>
      <div className="repCardTop">
        <span className="repBadge sm"><Icon name="sparkles" size={10} strokeWidth={1.8} /> AI</span>
        <span className="repCardWhen">{r.when}</span>
        <span className="repCardDel" role="button" tabIndex={0} title="Delete report"
              onClick={(e) => onDelete(r.id, e)}
              onKeyDown={(e) => { if (e.key === 'Enter') onDelete(r.id, e); }}>
          <Icon name="close" size={12} strokeWidth={2} />
        </span>
      </div>
      <div className="repCardTitle">{r.spec.title}</div>
      <div className="repCardMeta">{r.spec.period} · {r.spec.format}</div>
      <div className="repCardScope">
        {r.spec.scope.map(s => {
          const meta = metaFor(s, trackMeta);
          return (
            <span className="repTrackChip mini" key={s}><span className="sw" style={{ background: meta.color }} />{meta.label}</span>
          );
        })}
      </div>
      <div className="repCardSources">{r.spec.scope.length} track{r.spec.scope.length === 1 ? '' : 's'}</div>
    </button>
  );
};

/* ---- Main view ---- */
export const ReportsView = () => {
  const { t } = useT();
  const [tab, setTab] = React.useState('dashboard'); // dashboard | create | library
  const [reports, setReports] = React.useState([]);
  const [open, setOpen] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const [draft, setDraft] = React.useState(null);
  const [reportsLoading, setReportsLoading] = React.useState(true);

  // The tenant's track set drives the scope picker, doc sections, and chips.
  const [tracksList, setTracksList] = React.useState([]);
  React.useEffect(() => {
    api.get('/tracks').then((rows) => {
      if (Array.isArray(rows)) setTracksList(rows);
    }).catch(() => { /* keep empty */ });
  }, []);
  const trackMeta = React.useMemo(
    () => Object.fromEntries(tracksList.map(tr => [tr.key, { label: tr.label, color: tr.color || 'var(--brand)' }])),
    [tracksList],
  );
  const allTracks = tracksList.map(tr => tr.key);

  // Load the report library from the API.
  React.useEffect(() => {
    let cancelled = false;
    api.get('/reports').then((rows) => {
      if (cancelled || !Array.isArray(rows)) return;
      setReports(rows);
    }).catch(() => { /* empty on failure */ }).finally(() => {
      if (!cancelled) setReportsLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const startFromPrompt = (prompt) => {
    setDraft({ prompt, title: prompt, period: 'This week', format: 'Executive brief', scope: [...allTracks] });
  };
  const startFromTemplate = (tpl) => {
    // Only include tracks that actually exist for this tenant.
    const scope = tpl.scope.filter(k => allTracks.includes(k));
    const spec = { title: tpl.title, prompt: tpl.desc, period: tpl.period, format: tpl.format, scope };
    runGenerate(spec);
  };

  // Server computes aggregates + AI prose (Anthropic or scripted fallback) and persists.
  const runGenerate = async (spec) => {
    setBusy(true);
    try {
      const report = await api.post('/reports', spec);
      setReports(prev => [report, ...prev.filter(r => r.id !== report.id)]);
      setOpen(report);
    } catch (e) {
      console.error('Failed to generate report', e);
    } finally {
      setBusy(false);
      setDraft(null);
    }
  };

  const deleteReport = async (id, e) => {
    if (e) e.stopPropagation();
    setReports(prev => prev.filter(r => r.id !== id));
    try { await api.del('/reports/' + id); }
    catch (err) { console.error('Failed to delete report', err); }
  };

  if (open) return <ReportDoc report={open} onBack={() => { setOpen(null); setTab('library'); }} trackMeta={trackMeta} />;

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
              placeholder="Ask for a report… e.g. how did sales perform this week and what's at risk?"
              onKeyDown={e => { if (e.key === 'Enter' && e.target.value.trim()) startFromPrompt(e.target.value.trim()); }}
              defaultValue={draft ? draft.prompt : ''}
              key={draft ? draft.prompt : 'empty'} />
          </div>

          {draft ? (
            <ReportBuilder draft={draft} setDraft={setDraft} busy={busy}
              allTracks={allTracks} trackMeta={trackMeta}
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
                        {tpl.scope.map(s => <span className="sw" key={s} style={{ background: metaFor(s, trackMeta).color }} />)}
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
          {reportsLoading && <div className="repLoading">Loading library…</div>}
          {!reportsLoading && reports.length === 0 && <div className="repEmpty">No reports yet — create one from the Create tab.</div>}
          {reports.map(r => (
            <LibraryCard key={r.id} r={r} onOpen={setOpen} onDelete={deleteReport} trackMeta={trackMeta} />
          ))}
        </div>
      )}
    </div>
  );
};
