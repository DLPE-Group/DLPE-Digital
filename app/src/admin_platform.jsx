import React from 'react';
import { api } from './api/client.js';
import { Icon } from './icons.jsx';

/* Control Plane — platform-admin-only view: tenant roster + blueprint catalogue.
   Mirrors DataModelView conventions (contextBar, card, errBar, miniBtn, delBtn, etc.) */

export const ControlPlaneView = () => {
  const [tenants, setTenants] = React.useState(null);
  const [blueprints, setBlueprints] = React.useState([]);
  const [plans, setPlans] = React.useState([]);
  const [err, setErr] = React.useState(null);

  // Provision form state
  const [bpKey, setBpKey] = React.useState('');
  const [inputs, setInputs] = React.useState({});
  const [result, setResult] = React.useState(null);
  const [lastResult, setLastResult] = React.useState(null);
  const [provisioning, setProvisioning] = React.useState(false);

  const reload = React.useCallback(() => {
    Promise.all([api.get('/platform/tenants'), api.get('/platform/blueprints'), api.get('/platform/plans')])
      .then(([t, b, p]) => { setTenants(t); setBlueprints(b); setPlans(p); })
      .catch((e) => setErr(e.message));
  }, []);
  React.useEffect(() => { reload(); }, [reload]);

  const setStatus = async (id, status) => {
    setErr(null);
    try { await api.patch(`/platform/tenants/${id}`, { status }); reload(); }
    catch (e) { setErr(e.message); }
  };

  const changePlan = async (id, planKey) => {
    setErr(null);
    try { await api.patch(`/platform/tenants/${id}/subscription`, { planKey }); reload(); }
    catch (e) { setErr(e.message); }
  };

  // Derived: selected blueprint object and its spec.inputs
  const selectedBp = blueprints.find((b) => b.key === bpKey) || null;
  const specInputs = selectedBp?.spec?.inputs || [];

  const handleBpChange = (e) => {
    setBpKey(e.target.value);
    setInputs({});
    setResult(null);
    setLastResult(null);
    setErr(null);
  };

  const handleInputChange = (key, value) => {
    setInputs((prev) => ({ ...prev, [key]: value }));
  };

  // Guard: required inputs must be non-empty
  const requiredFilled = bpKey && specInputs
    .filter((i) => i.required)
    .every((i) => (inputs[i.key] || '').trim() !== '');

  // canSubmit: blueprint selected + all required fields filled (no slug/customerName dependency)
  const canSubmit = requiredFilled;

  // Idempotency suffix: stable fallback chain — never rely on Date.now()
  const idempotencySuffix = inputs.slug || inputs.customerName || Object.values(inputs).filter(Boolean)[0] || bpKey;

  const provision = async (e) => {
    e.preventDefault();
    setErr(null);
    setResult(null);
    setLastResult(null);
    setProvisioning(true);
    try {
      const r = await api.post('/platform/tenants', {
        blueprintKey: bpKey,
        inputs,
        idempotencyKey: `cp-${bpKey}-${idempotencySuffix}`,
      });
      setLastResult(r);
      setResult(r);
      reload();
      setBpKey('');
      setInputs({});
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setProvisioning(false);
    }
  };

  // Blueprint management state
  const [captureTenantId, setCaptureTenantId] = React.useState('');
  const [captureKey, setCaptureKey] = React.useState('');
  const [captureName, setCaptureName] = React.useState('');
  const [captureErr, setCaptureErr] = React.useState(null);

  const [importJson, setImportJson] = React.useState('');
  const [importKey, setImportKey] = React.useState('');
  const [importName, setImportName] = React.useState('');
  const [importErr, setImportErr] = React.useState(null);

  const capture = async () => {
    setCaptureErr(null);
    setErr(null);
    try {
      await api.post(`/platform/tenants/${captureTenantId}/capture`, { key: captureKey, name: captureName });
      setCaptureKey(''); setCaptureName(''); setCaptureTenantId('');
      reload();
    } catch (e) { setCaptureErr(e.message); }
  };

  const importBlueprint = async () => {
    setImportErr(null);
    setErr(null);
    let spec;
    try { spec = JSON.parse(importJson); } catch { setImportErr('Invalid JSON — check pasted content.'); return; }
    try {
      await api.post('/platform/blueprints/import', { key: importKey, name: importName, spec });
      setImportKey(''); setImportName(''); setImportJson('');
      reload();
    } catch (e) { setImportErr(e.message); }
  };

  const patchBlueprintStatus = async (id, status) => {
    setErr(null);
    try { await api.patch(`/platform/blueprints/${id}`, { status }); reload(); }
    catch (e) { setErr(e.message); }
  };

  const exportBlueprint = async (id, key) => {
    setErr(null);
    try {
      const spec = await api.get(`/platform/blueprints/${id}/export`);
      const blob = new Blob([JSON.stringify(spec, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${key}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
    } catch (e) { setErr(e.message); }
  };

  // Sort blueprints: PUBLISHED first
  const sortedBlueprints = [...blueprints].sort((a, b) => {
    if (a.status === 'PUBLISHED' && b.status !== 'PUBLISHED') return -1;
    if (a.status !== 'PUBLISHED' && b.status === 'PUBLISHED') return 1;
    return 0;
  });

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

          {/* ── Provision new customer ── */}
          <section>
            <SectionHead icon="plus" label="Provision new customer" />
            <div style={card}>
              <form onSubmit={provision} style={{ display: 'grid', gap: 14 }}>
                {/* Blueprint picker */}
                <label style={fieldLabel}>
                  Blueprint
                  <select
                    value={bpKey}
                    onChange={handleBpChange}
                    style={selectStyle}
                  >
                    <option value="">— select a blueprint —</option>
                    {sortedBlueprints.map((b) => (
                      <option key={b.key} value={b.key}>
                        {b.name} ({b.key}) · v{b.version}
                        {b.status !== 'PUBLISHED' ? ` [${b.status}]` : ''}
                      </option>
                    ))}
                  </select>
                </label>

                {/* Dynamic inputs from spec */}
                {specInputs.length > 0 && (
                  <div style={{ display: 'grid', gap: 10 }}>
                    {specInputs.map((inp) => {
                      const htmlType = inp.type === 'number' ? 'number' : inp.type === 'email' ? 'email' : 'text';
                      return (
                        <label key={inp.key} style={fieldLabel}>
                          {inp.label}
                          {inp.required && <span style={{ color: 'var(--status-red, #e05)', marginLeft: 2 }}>*</span>}
                          <input
                            type={htmlType}
                            value={inputs[inp.key] || ''}
                            onChange={(e) => handleInputChange(inp.key, e.target.value)}
                            placeholder={inp.default != null ? String(inp.default) : ''}
                            style={inputStyle}
                          />
                        </label>
                      );
                    })}
                  </div>
                )}


                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <button
                    type="submit"
                    disabled={!canSubmit || provisioning}
                    style={canSubmit && !provisioning ? primaryBtn : disabledBtn}
                  >
                    {provisioning ? 'Provisioning…' : 'Provision'}
                  </button>
                  {!canSubmit && bpKey && (
                    <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                      Fill all required fields (marked *).
                    </span>
                  )}
                </div>

                {/* Success result — keyed off lastResult so it survives form reset */}
                {lastResult && (
                  <div style={successBar}>
                    <strong>Provisioned:</strong> <code style={codeChip}>{lastResult.slug}</code>
                    {lastResult.adminLoginOrInviteLink && (
                      <>
                        {' — '}
                        <a href={lastResult.adminLoginOrInviteLink} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--status-green, #0a0)' }}>
                          Admin invite link
                        </a>
                      </>
                    )}
                  </div>
                )}
              </form>
            </div>
          </section>

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
                    {t.subscription && (
                      <>
                        <span style={planBadge}>{t.subscription.plan?.key ?? '—'}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{t.subscription.status}</span>
                      </>
                    )}
                    {plans.length > 0 && (
                      <select
                        value={t.subscription?.plan?.key ?? ''}
                        onChange={(e) => changePlan(t.id, e.target.value)}
                        style={{ ...selectStyle, fontSize: 11, padding: '2px 6px' }}
                        title="Change plan"
                      >
                        {!t.subscription && <option value="">— no plan —</option>}
                        {plans.map((p) => (
                          <option key={p.key} value={p.key}>{p.key}</option>
                        ))}
                      </select>
                    )}
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
              {sortedBlueprints.map((b) => (
                <div key={b.id} style={card}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <strong>{b.name}</strong>
                    <code style={codeChip}>{b.key}</code>
                    <span style={verBadge}>v{b.version}</span>
                    <span style={{ ...statusBadge(b.status) }}>{b.status}</span>
                    <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                      {b.status === 'DRAFT' && (
                        <button style={miniBtn} onClick={() => patchBlueprintStatus(b.id, 'PUBLISHED')}>Publish</button>
                      )}
                      {b.status !== 'ARCHIVED' && (
                        <button style={warnBtn} onClick={() => patchBlueprintStatus(b.id, 'ARCHIVED')}>Archive</button>
                      )}
                      <button style={miniBtn} onClick={() => exportBlueprint(b.id, b.key)}>Export</button>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── Capture blueprint from tenant ── */}
          <section>
            <SectionHead icon="download" label="Capture blueprint from tenant" />
            <div style={card}>
              {captureErr && <div style={{ ...errBar, marginBottom: 12 }}><Icon name="flash" size={13} /> {captureErr}</div>}
              <div style={{ display: 'grid', gap: 12 }}>
                <label style={fieldLabel}>
                  Source tenant
                  <select
                    value={captureTenantId}
                    onChange={(e) => setCaptureTenantId(e.target.value)}
                    style={selectStyle}
                  >
                    <option value="">— select a tenant —</option>
                    {tenants.map((t) => (
                      <option key={t.id} value={t.id}>{t.name} ({t.slug})</option>
                    ))}
                  </select>
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <label style={fieldLabel}>
                    Blueprint key
                    <input
                      type="text"
                      value={captureKey}
                      onChange={(e) => setCaptureKey(e.target.value)}
                      placeholder="e.g. my-template"
                      style={inputStyle}
                    />
                  </label>
                  <label style={fieldLabel}>
                    Blueprint name
                    <input
                      type="text"
                      value={captureName}
                      onChange={(e) => setCaptureName(e.target.value)}
                      placeholder="e.g. My Template"
                      style={inputStyle}
                    />
                  </label>
                </div>
                <div>
                  <button
                    onClick={capture}
                    disabled={!captureTenantId || !captureKey.trim() || !captureName.trim()}
                    style={captureTenantId && captureKey.trim() && captureName.trim() ? primaryBtn : disabledBtn}
                  >
                    Capture
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* ── Import blueprint ── */}
          <section>
            <SectionHead icon="upload" label="Import blueprint" />
            <div style={card}>
              {importErr && <div style={{ ...errBar, marginBottom: 12 }}><Icon name="flash" size={13} /> {importErr}</div>}
              <div style={{ display: 'grid', gap: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <label style={fieldLabel}>
                    Blueprint key
                    <input
                      type="text"
                      value={importKey}
                      onChange={(e) => setImportKey(e.target.value)}
                      placeholder="e.g. imported-template"
                      style={inputStyle}
                    />
                  </label>
                  <label style={fieldLabel}>
                    Blueprint name
                    <input
                      type="text"
                      value={importName}
                      onChange={(e) => setImportName(e.target.value)}
                      placeholder="e.g. Imported Template"
                      style={inputStyle}
                    />
                  </label>
                </div>
                <label style={fieldLabel}>
                  Spec JSON (paste exported blueprint)
                  <textarea
                    value={importJson}
                    onChange={(e) => setImportJson(e.target.value)}
                    placeholder={'{\n  "specVersion": 1,\n  ...\n}'}
                    style={{ ...inputStyle, fontFamily: 'var(--mono)', fontSize: 12, minHeight: 120, resize: 'vertical' }}
                  />
                </label>
                <div>
                  <button
                    onClick={importBlueprint}
                    disabled={!importKey.trim() || !importName.trim() || !importJson.trim()}
                    style={importKey.trim() && importName.trim() && importJson.trim() ? primaryBtn : disabledBtn}
                  >
                    Import
                  </button>
                </div>
              </div>
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
    {count != null && <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>· {count}</span>}
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
const fieldLabel = { display: 'flex', flexDirection: 'column', gap: 5, fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 };
const selectStyle = { fontSize: 13, padding: '5px 8px', borderRadius: 5, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)', cursor: 'pointer', marginTop: 2 };
const inputStyle = { fontSize: 13, padding: '5px 8px', borderRadius: 5, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)', marginTop: 2 };
const primaryBtn = { fontSize: 13, padding: '5px 14px', borderRadius: 5, border: '1px solid var(--accent, #0070f3)', background: 'var(--accent, #0070f3)', color: '#fff', cursor: 'pointer', fontWeight: 500 };
const disabledBtn = { fontSize: 13, padding: '5px 14px', borderRadius: 5, border: '1px solid var(--border)', background: 'var(--bg-muted)', color: 'var(--text-tertiary)', cursor: 'not-allowed', fontWeight: 500 };
const successBar = { padding: '8px 12px', borderRadius: 6, background: 'rgba(0,160,80,0.08)', border: '1px solid rgba(0,160,80,0.25)', color: 'var(--status-green, #0a0)', fontSize: 13 };
const planBadge = { fontSize: 11, padding: '1px 6px', borderRadius: 3, background: 'rgba(0,112,243,0.08)', border: '1px solid rgba(0,112,243,0.25)', color: 'var(--accent, #0070f3)', fontFamily: 'var(--mono)' };
