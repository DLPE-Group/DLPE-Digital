import React from 'react';
import { Icon } from './icons.jsx';
import { fmtMoney } from './primitives.jsx';
import { PORTAL_FLEET } from './data.js';
import { api } from './api/client.js';

/* Customer portal — separate view, scoped to one fleet operator */

const PortalTile = ({ label, value, sub, accent }) => (
  <div className={`statTile ${accent || ''}`} style={{ cursor: 'default', minHeight: 110 }}>
    <div className="tileLabel">{label}</div>
    <div className="tileValue">{value}</div>
    <div className="tileSub"><span className="muted">{sub}</span></div>
  </div>
);

export const CustomerPortal = () => {
  const [data, setData] = React.useState(PORTAL_FLEET);

  // Load the real operator + vehicles + invoices from the API.
  React.useEffect(() => {
    let cancelled = false;
    api.get('/portal').then((p) => {
      if (cancelled || !p || !Array.isArray(p.vehicles)) return;
      setData((prev) => ({
        ...prev,
        operator: p.operator || prev.operator,
        contact: p.contact || prev.contact,
        vehicles: p.vehicles,
        invoices: p.invoices,
        // Portal messages become real in Package F; keep demo copy until then.
        messages: p.messages?.length ? p.messages : prev.messages,
      }));
    }).catch(() => { /* keep PORTAL_FLEET fallback */ });
    return () => { cancelled = true; };
  }, []);

  const [composing, setComposing] = React.useState(false);
  const [msg, setMsg] = React.useState('');

  const sendMessage = async () => {
    const body = msg.trim();
    if (!body) return;
    try {
      const row = await api.post('/portal/messages', { body, operator: data.operator });
      setData(prev => ({ ...prev, messages: [{ when: row.when, body: row.body }, ...(prev.messages || [])] }));
    } catch (e) { console.error('Failed to send message', e); }
    setMsg(''); setComposing(false);
  };

  // Real client-side fleet report download (from the loaded portal data).
  const downloadFleetReport = () => {
    const report = {
      operator: data.operator, generatedAt: new Date().toISOString(),
      vehicles: data.vehicles, invoices: data.invoices,
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `fleet-report-${(data.operator || 'fleet').replace(/\s+/g, '-').toLowerCase()}.json`;
    a.click(); URL.revokeObjectURL(url);
  };

  const inWorkshop = data.vehicles.filter(v => v.statusLabel === 'In workshop').length;
  const serviceDue = data.vehicles.filter(v => v.statusLabel === 'Service due').length;
  const openInvoiceValue = data.invoices.reduce((s, i) => s + i.value, 0);

  return (
    <div className="portalShell">
      <div className="portalHero">
        <div>
          <div style={{ fontSize: 11.5, letterSpacing: '0.06em', textTransform: 'uppercase',
                        color: 'var(--text-tertiary)', marginBottom: 4 }}>Customer portal</div>
          <h1>{data.operator}</h1>
          <div className="sub">{data.contact} · signed in</div>
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
        <PortalTile label="Vehicles in fleet" value={data.vehicles.length} sub={`${data.vehicles.filter(v => v.status === 'ok').length} active · ${inWorkshop} in workshop`} />
        <PortalTile label="Upcoming services" value={serviceDue} sub="Inspection due in 21 days" accent="amber" />
        <PortalTile label="Open invoices" value={fmtMoney(openInvoiceValue)} sub={`${data.invoices.length} invoices · 1 overdue`} accent="red" />
      </div>

      <div className="portalGrid">
        <div className="portalSection">
          <div className="h">
            My vehicles
            <span className="meta">{data.vehicles.length} active</span>
          </div>
          {data.vehicles.map((v, i) => (
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
            {data.invoices.map((inv, i) => (
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
            {data.messages.map((m, i) => (
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
