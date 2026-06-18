import React from 'react';
import { api } from './api/client.js';
import { Icon } from './icons.jsx';

/* Control Plane — platform-admin-only view: tenant roster + blueprint catalogue.
   Mirrors DataModelView conventions (contextBar, card, errBar, miniBtn, delBtn, etc.) */

export const ControlPlaneView = () => {
  const [tenants, setTenants] = React.useState(null);
  const [blueprints, setBlueprints] = React.useState([]);
  const [err, setErr] = React.useState(null);

  const reload = React.useCallback(() => {
    Promise.all([api.get('/platform/tenants'), api.get('/platform/blueprints')])
      .then(([t, b]) => { setTenants(t); setBlueprints(b); })
      .catch((e) => setErr(e.message));
  }, []);
  React.useEffect(() => { reload(); }, [reload]);

  const setStatus = async (id, status) => {
    setErr(null);
    try { await api.patch(`/platform/tenants/${id}`, { status }); reload(); }
    catch (e) { setErr(e.message); }
  };

  return (
    <>
      <div className="contextBar">
        <div>
          <h1>Control plane</h1>
          <div className="pageSub">
            Platform-wide tenant roster and blueprint catalogue — manage tenant status across the system.
          </div>
        </div>
      </div>

      {err && <div style={errBar}><Icon name="flash" size={13} /> {err}</div>}
      {!tenants && !err && <div style={{ padding: 14, color: 'var(--text-tertiary)', fontSize: 13 }}>Loading…</div>}

      {tenants && (
        <div style={{ display: 'grid', gap: 24, marginTop: 8 }}>
          <section>
            <SectionHead icon="user" label="Tenants" count={tenants.length} />
            <div style={{ display: 'grid', gap: 10 }}>
              {tenants.length === 0 && (
                <div style={{ fontSize: 13, color: 'var(--text-tertiary)', padding: '8px 0' }}>No tenants found.</div>
              )}
              {tenants.map((t) => (
                <div key={t.id} style={card}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <strong>{t.name}</strong>
                    <code style={codeChip}>{t.slug}</code>
                    <span style={{ ...statusBadge(t.status) }}>{t.status}</span>
                    {t.region && <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{t.region}</span>}
                    <span style={{ marginLeft: 'auto' }}>
                      {t.status === 'ACTIVE'
                        ? <button style={warnBtn} onClick={() => setStatus(t.id, 'SUSPENDED')}>Suspend</button>
                        : <button style={miniBtn} onClick={() => setStatus(t.id, 'ACTIVE')}>Reactivate</button>}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <SectionHead icon="document" label="Blueprints" count={blueprints.length} />
            <div style={{ display: 'grid', gap: 10 }}>
              {blueprints.length === 0 && (
                <div style={{ fontSize: 13, color: 'var(--text-tertiary)', padding: '8px 0' }}>No blueprints found.</div>
              )}
              {blueprints.map((b) => (
                <div key={b.id} style={card}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <strong>{b.name}</strong>
                    <code style={codeChip}>{b.key}</code>
                    <span style={verBadge}>v{b.version}</span>
                    <span style={{ ...statusBadge(b.status) }}>{b.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </>
  );
};

const SectionHead = ({ icon, label, count }) => (
  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
    <Icon name={icon} size={14} /> {label}
    <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>· {count}</span>
  </div>
);

const statusBadge = (status) => ({
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: 0.4,
  padding: '1px 6px',
  borderRadius: 3,
  background: status === 'ACTIVE' ? 'rgba(0,160,80,0.12)' : status === 'SUSPENDED' ? 'rgba(224,0,85,0.1)' : 'var(--bg)',
  color: status === 'ACTIVE' ? 'var(--status-green, #0a0)' : status === 'SUSPENDED' ? 'var(--status-red, #e05)' : 'var(--text-tertiary)',
  border: `1px solid ${status === 'ACTIVE' ? 'rgba(0,160,80,0.25)' : status === 'SUSPENDED' ? 'rgba(224,0,85,0.25)' : 'var(--border)'}`,
});

const card = { background: 'var(--bg-muted)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px' };
const codeChip = { fontFamily: 'var(--mono)', fontSize: 11, padding: '1px 6px', border: '1px solid var(--border-strong, #333)', borderRadius: 3, color: 'var(--text-secondary)' };
const verBadge = { fontSize: 11, padding: '1px 6px', borderRadius: 3, background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontFamily: 'var(--mono)' };
const miniBtn = { fontSize: 12, padding: '3px 8px', borderRadius: 5, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-secondary)', cursor: 'pointer' };
const warnBtn = { fontSize: 12, padding: '3px 8px', borderRadius: 5, border: '1px solid var(--status-red, #e05)', background: 'var(--bg)', color: 'var(--status-red, #e05)', cursor: 'pointer' };
const errBar = { margin: '10px 0', padding: '8px 12px', borderRadius: 6, background: 'var(--bg-muted)', border: '1px solid var(--status-red, #e05)', color: 'var(--status-red, #e05)', fontSize: 13, display: 'flex', gap: 8, alignItems: 'center' };
