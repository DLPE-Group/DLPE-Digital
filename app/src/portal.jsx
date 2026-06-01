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
          <button className="cta ghost">
            <Icon name="mail" size={12} strokeWidth={2} /> Message account team
          </button>
          <button className="cta">
            <Icon name="download" size={12} strokeWidth={2} /> Fleet report
          </button>
        </div>
      </div>

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
