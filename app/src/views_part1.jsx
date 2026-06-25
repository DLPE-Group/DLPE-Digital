import React from 'react';
import { Icon } from './icons.jsx';
import { TrackTag } from './primitives.jsx';
import { api } from './api/client.js';
import { NangoConnect } from './nango_connect.jsx';
import { AiMappingFlow } from './ai_mapping.jsx';

/* ============================================================
   INTEGRATIONS
   ============================================================ */

const IntegrationCard = ({ it, onTest, onLogs, onConfig, onDelete, busy }) => (
  <div className={`integrationCard ${it.nango ? 'viaNango' : ''}`}>
    <div className="integrationLogo" style={it.logoColor ? { background: it.logoColor, color: '#fff' } : undefined}>{it.logo}</div>
    <div className="integrationMain">
      <div className="nm">
        {it.name}
        {it.nango && <span className="nangoTag"><span className="ng">N</span> via Nango</span>}
        {it.transforms > 0 && <span className="nangoTag" style={{ marginLeft: 6 }}><span className="ng" style={{ background: 'var(--brand)', fontStyle: 'italic' }}>ƒ</span> {it.transforms} transform{it.transforms === 1 ? '' : 's'}</span>}
      </div>
      <div className="meta">{it.kind}</div>
      <div className="desc">{it.desc}</div>
      <div className="integrationFacts">
        <div><div className="k">Last sync</div><div className="v">{it.lastSync}</div></div>
        <div><div className="k">Latency</div><div className="v">{it.latency}</div></div>
        <div style={{ gridColumn: 'span 2' }}><div className="k">Throughput</div><div className="v">{it.throughput}</div></div>
      </div>
    </div>
    <div className="integrationActions">
      <span className={`intStatus ${it.status}`}><span className="d" />{it.status}</span>
      <button className="miniBtn" disabled={busy || !onTest} onClick={() => onTest && onTest(it)}><Icon name="refresh" size={11} /> Test</button>
      <button className="miniBtn" disabled={!onLogs} onClick={() => onLogs && onLogs(it)}><Icon name="document" size={11} /> Logs</button>
      <button className="miniBtn" disabled={busy || !onConfig} onClick={() => onConfig && onConfig(it)}><Icon name="settings" size={11} /> Config</button>
      {onDelete && <button className="miniBtn" disabled={busy} onClick={() => onDelete(it)} style={{ color: 'var(--status-red, #e05)' }}><Icon name="close" size={11} /> Remove</button>}
    </div>
  </div>
);

const CATEGORY_DIRECTION = {
  'CRM': 'inbound',
  'Accounting & Finance': 'bi',
  'ERP & Supply chain': 'bi',
  'Productivity & Comms': 'outbound',
};

export const IntegrationsView = () => {
  const [added, setAdded] = React.useState([]);   // connected via Nango this session
  const [live, setLive] = React.useState(null);   // real rows from the API (null = loading)
  const [nangoOpen, setNangoOpen] = React.useState(false);
  const [mapping, setMapping] = React.useState(null); // provider being AI-mapped
  const [busyId, setBusyId] = React.useState(null);
  const [logs, setLogs] = React.useState(null);    // { integration, lines }

  // Load real integrations from the API.
  const loadIntegrations = React.useCallback(() => {
    return api.get('/integrations').then((rows) => { setLive(Array.isArray(rows) ? rows : []); }).catch(() => { setLive([]); });
  }, []);
  React.useEffect(() => { loadIntegrations(); }, [loadIntegrations]);

  const patchRow = (id, patch) => setLive((prev) => (prev || []).map((r) => r.id === id ? { ...r, ...patch } : r));

  const onTest = async (it) => {
    setBusyId(it.id);
    try { const r = await api.post(`/integrations/${it.id}/test`, {}); patchRow(it.id, r.integration); }
    catch (e) { console.error('Test failed', e); }
    setBusyId(null);
  };
  const onConfig = async (it) => {
    const desc = window.prompt('Edit integration description:', it.desc || '');
    if (desc == null) return;
    setBusyId(it.id);
    try { const r = await api.patch(`/integrations/${it.id}`, { desc }); patchRow(it.id, r); }
    catch (e) { console.error('Config save failed', e); }
    setBusyId(null);
  };
  const onLogs = async (it) => {
    try { setLogs(await api.get(`/integrations/${it.id}/logs`)); }
    catch (e) { console.error('Logs failed', e); }
  };
  const onDelete = async (it) => {
    if (!window.confirm(`Remove integration "${it.name}"?`)) return;
    setBusyId(it.id);
    try { await api.del(`/integrations/${it.id}`); } catch (e) { /* may be a local-only row */ }
    setLive((prev) => (prev || []).filter((r) => r.id !== it.id));
    setAdded((prev) => prev.filter((r) => r.id !== it.id));
    setBusyId(null);
  };

  // Nango finished the connection -> hand off to the AI mapping pass.
  const onConnected = (provider) => { setNangoOpen(false); setMapping(provider); };

  // AI mapping confirmed -> the source now shows up as a live integration.
  const onMapped = (provider, transforms = []) => {
    setMapping(null);
    const tf = transforms.length;
    setAdded(prev => [{
      id: 'nango-' + provider.id,
      name: provider.name,
      kind: `${provider.cat} · ${provider.auth === 'oauth' ? 'OAuth' : 'API key'}`,
      direction: CATEGORY_DIRECTION[provider.cat] || 'inbound',
      logo: provider.mono.toUpperCase(),
      logoColor: provider.color,
      nango: true,
      transforms: tf,
      status: 'healthy',
      lastSync: 'just now',
      throughput: tf ? `initial sync running… · ${tf} transform${tf === 1 ? '' : 's'}` : 'initial sync running…',
      latency: provider.auth === 'oauth' ? 'real-time · OAuth' : 'real-time · API key',
      desc: provider.blurb + ' Auto-mapped onto the unified DataSource by the Intelligence Layer'
        + (tf ? `, with ${tf} prompt-defined transform${tf === 1 ? '' : 's'}.` : '.'),
    }, ...prev]);
  };

  const all = [...added, ...(live || [])];
  const total = all.length;
  const healthy = all.filter(i => i.status === 'healthy').length;
  const degraded = all.filter(i => i.status === 'degraded').length;
  const errorsToday = all.filter(i => i.status === 'degraded' || i.status === 'error').length;

  const inbound = all.filter(i => i.direction === 'inbound');
  const outbound = all.filter(i => i.direction === 'outbound');
  const bi = all.filter(i => i.direction === 'bi');

  return (
    <div className="viewWrap">
      <div className="viewHero">
        <div>
          <h1>Integrations</h1>
          <div className="sub">All systems feeding the unified DataSource abstraction. Anything you see on the dashboard arrived via one of these. The UI never knows whether a data point came from a CRM, an e-invoice, an ETL sync, or a CSV — it just renders state.</div>
        </div>
        <button className="cta" onClick={() => setNangoOpen(true)}><Icon name="plus" size={12} strokeWidth={2} /> Add integration</button>
      </div>

      {live === null && (
        <div className="emptyHint" style={{ padding: '40px 0' }}>Loading integrations…</div>
      )}

      {live !== null && (
        <>
          <div className="viewStats">
            <div className="viewStat good"><div className="l">Connected</div><div className="v">{total}</div><div className="s">{healthy} healthy · {degraded} degraded</div></div>
            <div className="viewStat bad"><div className="l">Errors · 24h</div><div className="v">{errorsToday}</div><div className="s">all auto-retried</div></div>
          </div>

          {total === 0 ? (
            <div className="emptyHint" style={{ padding: '48px 0', textAlign: 'center' }}>
              No integrations configured. Use "Add integration" to connect your first source.
            </div>
          ) : (
            <>
              <div className="integrationGroup">
                <div className="gh">Inbound · {inbound.length}</div>
                <div className="integrationGrid">
                  {inbound.length === 0
                    ? <div className="emptyHint">No inbound integrations.</div>
                    : inbound.map(it => <IntegrationCard key={it.id} it={it} busy={busyId === it.id} onTest={onTest} onLogs={onLogs} onConfig={onConfig} onDelete={onDelete} />)}
                </div>
              </div>

              <div className="integrationGroup">
                <div className="gh">Bi-directional · {bi.length}</div>
                <div className="integrationGrid">
                  {bi.length === 0
                    ? <div className="emptyHint">No bi-directional integrations.</div>
                    : bi.map(it => <IntegrationCard key={it.id} it={it} busy={busyId === it.id} onTest={onTest} onLogs={onLogs} onConfig={onConfig} onDelete={onDelete} />)}
                </div>
              </div>

              <div className="integrationGroup">
                <div className="gh">Outbound · {outbound.length}</div>
                <div className="integrationGrid">
                  {outbound.length === 0
                    ? <div className="emptyHint">No outbound integrations.</div>
                    : outbound.map(it => <IntegrationCard key={it.id} it={it} busy={busyId === it.id} onTest={onTest} onLogs={onLogs} onConfig={onConfig} onDelete={onDelete} />)}
                </div>
              </div>
            </>
          )}
        </>
      )}

      {nangoOpen && <NangoConnect onClose={() => setNangoOpen(false)} onConnected={onConnected} />}
      {mapping && <AiMappingFlow provider={mapping} onClose={() => setMapping(null)} onComplete={onMapped} />}

      {logs && (
        <div className="overlay" onClick={() => setLogs(null)}>
          <div className="sidePanel" onClick={e => e.stopPropagation()}>
            <div className="sidePanelHead">
              <div><h2>{logs.integration?.name} · activity</h2>
                <div className="sub">Recent system events · last sync {logs.integration?.lastSync || '—'}</div></div>
              <button className="iconBtn" onClick={() => setLogs(null)}><Icon name="close" size={16} /></button>
            </div>
            <div className="sidePanelBody">
              {(!logs.lines || logs.lines.length === 0) && <div className="emptyHint">No recent activity.</div>}
              {(logs.lines || []).map((l, i) => (
                <div key={i} className="setRow"><div className="setLabel" style={{ minWidth: 120 }}>{l.when}</div><div className="setVal"><span className="setValText">{l.text}</span></div></div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ============================================================
   AUDIT LOG
   ============================================================ */

// Audit entries come from GET /audit (tenant-scoped). No demo fallback —
// a fresh tenant shows an empty log until real activity is recorded.
const AUDIT = [];

export const AuditView = () => {
  const [filter, setFilter] = React.useState('all');
  const [openId, setOpenId] = React.useState(null);
  const [entries, setEntries] = React.useState(AUDIT);
  const [reverting, setReverting] = React.useState(null);
  const [toast, setToast] = React.useState(null);

  // Load the audit log from the API (fallback to the seed constant).
  const load = React.useCallback(() => {
    api.get('/audit').then((rows) => {
      if (Array.isArray(rows)) setEntries(rows);
    }).catch(() => { /* keep AUDIT fallback */ });
  }, []);
  React.useEffect(() => { load(); }, [load]);

  const showToast = (title, lines) => {
    setToast({ title, lines });
    setTimeout(() => setToast(null), 5000);
  };

  const revert = async (id, e) => {
    if (e) e.stopPropagation();
    setReverting(id);
    try {
      const res = await api.post('/audit/' + id + '/revert', {});
      const removed = (res.removedCardIds || []).join(', ');
      showToast('Reverted', [
        res.restoredCardId ? `Restored card ${res.restoredCardId}` : 'Source card restored',
        removed ? `Removed ${removed}` : 'No downstream cards removed',
      ]);
      load();
    } catch (err) {
      showToast('Revert failed', [err.message || 'Could not revert this entry']);
    } finally {
      setReverting(null);
    }
  };

  const filtered = filter === 'all' ? entries
    : filter === 'cascades' ? entries.filter(a => a.cascades && a.cascades.length)
    : filter === 'system' ? entries.filter(a => a.isSystem)
    : entries.filter(a => a.track === filter);

  const days = [...new Set(filtered.map(a => a.day))];

  // Real client-side CSV export of the (filtered) audit entries.
  const exportCsv = () => {
    const head = ['day', 'time', 'actor', 'role', 'verb', 'target', 'track', 'kind'];
    const esc = (c) => `"${String(c ?? '').replace(/"/g, '""')}"`;
    const rows = [head, ...filtered.map(a => [a.day, a.time, a.actor, a.actorRole, a.verb, a.target, a.track, a.kind])];
    const csv = rows.map(r => r.map(esc).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const link = document.createElement('a');
    link.href = url; link.download = 'audit-log.csv'; link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="viewWrap">
      <div className="viewHero">
        <div>
          <h1>Audit log</h1>
          <div className="sub">Every action taken from this dashboard, with actor, timestamp, and downstream cascades. Reversible from this view. System events (ETL syncs, PEPPOL webhooks, supplier API callbacks) are interleaved so you can see the full state-of-the-world.</div>
        </div>
        <button className="cta ghost" onClick={exportCsv}><Icon name="download" size={12} strokeWidth={2} /> Export CSV</button>
      </div>

      <div className="filterBar">
        <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)', letterSpacing: '0.04em', textTransform: 'uppercase', marginRight: 4 }}>Filter</span>
        {[
          ['all', 'All', null],
          ['cascades', 'Cascading actions', null],
          ['sales', 'Sales', 'var(--track-sales)'],
          ['operations', 'Operations', 'var(--track-ops)'],
          ['workshop', 'Workshop', 'var(--track-workshop)'],
          ['finance', 'Finance', 'var(--track-finance)'],
          ['system', 'System events', null],
        ].map(([id, label, color]) => (
          <button key={id} className={`filterChip ${filter === id ? 'active' : ''}`}
                  onClick={() => setFilter(id)}>
            {color && <span className="swatch" style={{ background: color }} />}
            {label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>{filtered.length} entries</span>
      </div>

      {days.map(day => {
        const dayEntries = filtered.filter(a => a.day === day);
        return (
          <div className="auditDay" key={day}>
            <div className="auditDayHead">{day}</div>
            {dayEntries.map(a => (
              <div key={a.id} className={`auditEntry ${a.kind}`}
                   onClick={() => a.cascades && setOpenId(openId === a.id ? null : a.id)}
                   style={{ cursor: a.cascades ? 'pointer' : 'default' }}>
                <div className="auditTime">{a.time}</div>
                <div className="auditIcon"><Icon name={a.icon} size={11} strokeWidth={2} /></div>
                <div className="auditBody">
                  <div className="auditLine">
                    <span className="actor">{a.actor}</span>{' '}
                    <span className="verb">{a.verb}</span>{' '}
                    <span className="target">{a.target}</span>
                  </div>
                  <div className="auditMeta">
                    <TrackTag track={a.track}>{a.track}</TrackTag>
                    <span>·</span>
                    <span>{a.actorRole}</span>
                    {a.cascades && <>
                      <span>·</span>
                      <span style={{ color: 'var(--brand)', fontWeight: 500 }}>
                        triggered {a.cascades.length} downstream action{a.cascades.length === 1 ? '' : 's'}
                      </span>
                    </>}
                  </div>
                  {a.cascades && openId === a.id && (
                    <div className="auditCascades">
                      {a.cascades.map((c, i) => (
                        <div key={i} className="auditCascade">
                          <span className="arr">→</span>
                          <TrackTag track={c.track}>{c.track}</TrackTag>
                          <span>{c.text}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="auditActions">
                  {a.cascades && (
                    <button className="miniBtn" onClick={(e) => { e.stopPropagation(); setOpenId(openId === a.id ? null : a.id); }}>
                      {openId === a.id ? 'Hide' : 'Details'}
                    </button>
                  )}
                  {!a.isSystem && (
                    <button className="miniBtn" disabled={reverting === a.id}
                            onClick={(e) => revert(a.id, e)}>
                      {reverting === a.id ? 'Reverting…' : 'Revert'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        );
      })}

      {toast && (
        <div className="toast">
          <span className="toastDot" />
          <div>
            <div style={{ fontWeight: 500, marginBottom: 4 }}>{toast.title}</div>
            {toast.lines.map((l, i) => (
              <div key={i} style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{l}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
