import React from 'react';
import { Icon } from './icons.jsx';
import { fmtMoney } from './primitives.jsx';
import { api } from './api/client.js';

/* Customer portal — separate view, scoped to one fleet operator */

const PortalTile = ({ label, value, sub, accent }) => (
  <div className={`statTile ${accent || ''}`} style={{ cursor: 'default', minHeight: 110 }}>
    <div className="tileLabel">{label}</div>
    <div className="tileValue">{value}</div>
    <div className="tileSub"><span className="muted">{sub}</span></div>
  </div>
);

const EMPTY_DATA = { operator: null, contact: '', vehicles: [], invoices: [], messages: [] };

export const CustomerPortal = () => {
  const [data, setData] = React.useState(null);  // null = loading

  // Load the real operator + vehicles + invoices from the API.
  React.useEffect(() => {
    let cancelled = false;
    api.get('/portal').then((p) => {
      if (cancelled) return;
      setData({
        operator: p?.operator ?? null,
        contact: p?.contact ?? '',
        vehicles: Array.isArray(p?.vehicles) ? p.vehicles : [],
        invoices: Array.isArray(p?.invoices) ? p.invoices : [],
        messages: Array.isArray(p?.messages) ? p.messages : [],
      });
    }).catch(() => { if (!cancelled) setData(EMPTY_DATA); });
    return () => { cancelled = true; };
  }, []);

  const [composing, setComposing] = React.useState(false);
  const [msg, setMsg] = React.useState('');

  const sendMessage = async () => {
    const body = msg.trim();
    if (!body) return;
    try {
      const row = await api.post('/portal/messages', { body, operator: data?.operator });
      setData(prev => ({ ...prev, messages: [{ when: row.when, body: row.body }, ...(prev.messages || [])] }));
    } catch (e) { console.error('Failed to send message', e); }
    setMsg(''); setComposing(false);
  };

  // Real client-side fleet report download (from the loaded portal data).
  const downloadFleetReport = () => {
    const report = {
      operator: data?.operator, generatedAt: new Date().toISOString(),
      vehicles: data?.vehicles, invoices: data?.invoices,
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `fleet-report-${(data?.operator || 'fleet').replace(/\s+/g, '-').toLowerCase()}.json`;
    a.click(); URL.revokeObjectURL(url);
  };

  // Loading state
  if (data === null) {
    return (
      <div className="portalShell">
        <div className="emptyHint" style={{ padding: '60px 0' }}>Loading portal…</div>
      </div>
    );
  }

  const vehicles = data.vehicles;
  const invoices = data.invoices;
  const messages = data.messages;
  const inWorkshop = vehicles.filter(v => v.statusLabel === 'In workshop').length;
  const serviceDue = vehicles.filter(v => v.statusLabel === 'Service due').length;
  const openInvoiceValue = invoices.reduce((s, i) => s + (i.value || 0), 0);
  const overdueCount = invoices.filter(i => i.status === 'late').length;

  return (
    <div className="portalShell">
      <div className="portalHero">
        <div>
          <div style={{ fontSize: 11.5, letterSpacing: '0.06em', textTransform: 'uppercase',
                        color: 'var(--text-tertiary)', marginBottom: 4 }}>Customer portal</div>
          <h1>{data.operator || 'Fleet operator'}</h1>
          {data.contact && <div className="sub">{data.contact} · signed in</div>}
        </div>
        <div className="row">
          <button className="cta ghost" onClick={() => setComposing(v => !v)}>
            <Icon name="mail" size={12} strokeWidth={2} /> Message account team
          </button>
          <button className="cta" onClick={downloadFleetReport}>
            <Icon name="download" size={12} strokeWidth={2} /> Fleet report
          </button>
        </div>
      </div>

      {composing && (
        <div className="portalSection" style={{ marginBottom: 16 }}>
          <div className="h">Message the account team</div>
          <textarea className="textInput" rows={3} autoFocus value={msg}
                    placeholder="Type your message…" onChange={e => setMsg(e.target.value)}
                    style={{ width: '100%', resize: 'vertical' }} />
          <div className="row" style={{ marginTop: 8, justifyContent: 'flex-end' }}>
            <button className="cta ghost" onClick={() => { setComposing(false); setMsg(''); }}>Cancel</button>
            <button className="cta" disabled={!msg.trim()} onClick={sendMessage}>Send</button>
          </div>
        </div>
      )}

      <div className="portalTiles">
        <PortalTile label="Vehicles in fleet" value={vehicles.length} sub={vehicles.length ? `${vehicles.filter(v => v.status === 'ok').length} active · ${inWorkshop} in workshop` : 'No vehicles registered'} />
        <PortalTile label="Upcoming services" value={serviceDue} sub={serviceDue ? 'Inspection due soon' : 'No services due'} accent={serviceDue ? 'amber' : ''} />
        <PortalTile label="Open invoices" value={fmtMoney(openInvoiceValue)} sub={invoices.length ? `${invoices.length} invoice${invoices.length === 1 ? '' : 's'}${overdueCount ? ` · ${overdueCount} overdue` : ''}` : 'No open invoices'} accent={overdueCount ? 'red' : ''} />
      </div>

      <div className="portalGrid">
        <div className="portalSection">
          <div className="h">
            My vehicles
            <span className="meta">{vehicles.length} active</span>
          </div>
          {vehicles.length === 0
            ? <div className="emptyHint">No vehicles in fleet.</div>
            : vehicles.map((v, i) => (
              <div key={i} className="vehicleRow">
                <div className="plate">{v.plate}</div>
                <div>
                  <div className="meta1">{v.model}</div>
                  <div className="meta2">{v.note}</div>
                </div>
                <span className={`statusPill ${v.status}`}>
                  <span className="d" />
                  {v.statusLabel}
                </span>
              </div>
            ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="portalSection">
            <div className="h">Open invoices<span className="meta">{fmtMoney(openInvoiceValue)}</span></div>
            {invoices.length === 0
              ? <div className="emptyHint">No open invoices.</div>
              : invoices.map((inv, i) => (
                <div key={i} className="portalInvoice">
                  <div>
                    <div className="invMain">{inv.ref}</div>
                    <div className="invSub" style={inv.status === 'late' ? { color: 'var(--status-red)' } : null}>
                      {inv.due}
                    </div>
                  </div>
                  <div>
                    <div className="v">{fmtMoney(inv.value)}</div>
                  </div>
                </div>
              ))}
          </div>

          <div className="portalSection">
            <div className="h">Recent messages<span className="meta">From leasing team</span></div>
            {messages.length === 0
              ? <div className="emptyHint">No messages yet.</div>
              : messages.map((m, i) => (
                <div key={i} className="portalMsg">
                  <div className="when">{m.when}</div>
                  <div className="body">{m.body}</div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
};
