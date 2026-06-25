import React from 'react';
import { api } from './api/client.js';
import { Icon } from './icons.jsx';

/* S4 — Guided setup wizard. Multi-step provisioning for sales-led onboarding.
   Steps: 1 Template · 2 Customer · 3 Admin & plan · 4 Review (preflight) · 5 Done.
   Styling mirrors admin_platform.jsx (card/fieldLabel/primaryBtn). */

const STEPS = ['Template', 'Customer', 'Admin & plan', 'Review', 'Done'];

export const ProvisionWizard = ({ onProvisioned }) => {
  const [step, setStep] = React.useState(0);
  const [blueprints, setBlueprints] = React.useState([]);
  const [plans, setPlans] = React.useState([]);
  const [err, setErr] = React.useState(null);

  const [bpKey, setBpKey] = React.useState('');
  const [inputs, setInputs] = React.useState({});
  const [adminName, setAdminName] = React.useState('');
  const [adminEmail, setAdminEmail] = React.useState('');
  const [adminPassword, setAdminPassword] = React.useState('');
  const [planKey, setPlanKey] = React.useState('');

  const [preflight, setPreflight] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState(null);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    Promise.all([api.get('/platform/blueprints'), api.get('/platform/plans')])
      .then(([b, p]) => { setBlueprints(b); setPlans(p); })
      .catch((e) => setErr(e.message));
  }, []);

  const sortedBps = [...blueprints].sort((a, b) =>
    a.status === 'PUBLISHED' && b.status !== 'PUBLISHED' ? -1
      : a.status !== 'PUBLISHED' && b.status === 'PUBLISHED' ? 1 : 0);
  const selectedBp = blueprints.find((b) => b.key === bpKey) || null;
  const specInputs = selectedBp?.spec?.inputs || [];

  // When a blueprint is chosen, prefill admin + plan from its spec.
  const chooseBp = (key) => {
    setBpKey(key);
    const bp = blueprints.find((b) => b.key === key);
    setInputs({});
    setAdminName(bp?.spec?.adminUser?.name || '');
    setAdminEmail(bp?.spec?.adminUser?.email || '');
    setPlanKey(bp?.spec?.defaultPlanKey || '');
    setPreflight(null);
    setResult(null);
    setErr(null);
  };

  const setInput = (k, v) => { setInputs((p) => ({ ...p, [k]: v })); setPreflight(null); };

  const requiredFilled = specInputs.filter((i) => i.required)
    .every((i) => (inputs[i.key] || '').trim() !== '');

  const runPreflight = async () => {
    setErr(null); setBusy(true); setPreflight(null);
    try {
      const pf = await api.post('/platform/provision/preflight', {
        blueprintKey: bpKey, inputs,
        admin: { name: adminName || undefined, email: adminEmail || undefined },
        planKey: planKey || undefined,
      });
      setPreflight(pf);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const idempotencySuffix = inputs.slug || inputs.customerName || bpKey;

  const provision = async () => {
    setErr(null); setBusy(true);
    try {
      const r = await api.post('/platform/tenants', {
        blueprintKey: bpKey, inputs,
        admin: { name: adminName || undefined, email: adminEmail || undefined, password: adminPassword || undefined },
        planKey: planKey || undefined,
        idempotencyKey: `wiz-${bpKey}-${idempotencySuffix}`,
      });
      setResult(r);
      setStep(4);
      onProvisioned?.();
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const reset = () => {
    setStep(0); setBpKey(''); setInputs({}); setAdminName(''); setAdminEmail(''); setAdminPassword('');
    setPlanKey(''); setPreflight(null); setResult(null); setErr(null); setCopied(false);
  };

  const copyLink = async (link) => {
    try { await navigator.clipboard.writeText(link); setCopied(true); } catch { /* ignore */ }
  };

  // Per-step Next gate
  const adminPasswordOk = adminPassword === '' || adminPassword.length >= 8;
  const canNext =
    step === 0 ? !!bpKey :
    step === 1 ? requiredFilled :
    step === 2 ? adminPasswordOk :
    false;

  const go = (n) => { setErr(null); setStep(n); };

  // entering Review → auto preflight
  React.useEffect(() => { if (step === 3 && !preflight && !busy) runPreflight(); /* eslint-disable-next-line */ }, [step]);

  return (
    <div style={card}>
      {/* Stepper */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }} data-testid="wizard-steps">
        {STEPS.map((s, i) => (
          <span key={s} style={stepChip(i === step, i < step)}>{i + 1}. {s}</span>
        ))}
      </div>

      {err && <div style={{ ...errBar, marginBottom: 12 }} data-testid="wizard-err"><Icon name="flash" size={13} /> {err}</div>}

      {/* Step 0 — Template */}
      {step === 0 && (
        <div style={{ display: 'grid', gap: 12 }}>
          <label style={fieldLabel}>
            Blueprint
            <select value={bpKey} onChange={(e) => chooseBp(e.target.value)} style={selectStyle} data-testid="wiz-bp">
              <option value="">— select a blueprint —</option>
              {sortedBps.map((b) => (
                <option key={b.key} value={b.key}>
                  {b.name} ({b.key}) · v{b.version}{b.status !== 'PUBLISHED' ? ` [${b.status}]` : ''}
                </option>
              ))}
            </select>
          </label>
          {selectedBp && (
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
              Template: <strong>{selectedBp.name}</strong> · status {selectedBp.status}
            </div>
          )}
        </div>
      )}

      {/* Step 1 — Customer */}
      {step === 1 && (
        <div style={{ display: 'grid', gap: 10 }}>
          {specInputs.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>This blueprint defines no inputs.</div>}
          {specInputs.map((inp) => {
            const htmlType = inp.type === 'number' ? 'number' : inp.type === 'email' ? 'email' : 'text';
            return (
              <label key={inp.key} style={fieldLabel}>
                {inp.label}{inp.required && <span style={{ color: 'var(--status-red, #e05)', marginLeft: 2 }}>*</span>}
                <input type={htmlType} value={inputs[inp.key] || ''} placeholder={inp.default != null ? String(inp.default) : ''}
                  onChange={(e) => setInput(inp.key, e.target.value)} style={inputStyle} data-testid={`wiz-input-${inp.key}`} />
              </label>
            );
          })}
        </div>
      )}

      {/* Step 2 — Admin & plan */}
      {step === 2 && (
        <div style={{ display: 'grid', gap: 10 }}>
          <label style={fieldLabel}>Admin name
            <input type="text" value={adminName} onChange={(e) => { setAdminName(e.target.value); setPreflight(null); }} style={inputStyle} data-testid="wiz-admin-name" />
          </label>
          <label style={fieldLabel}>Admin email
            <input type="email" value={adminEmail} onChange={(e) => { setAdminEmail(e.target.value); setPreflight(null); }} style={inputStyle} data-testid="wiz-admin-email" />
          </label>
          <label style={fieldLabel}>Admin password <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>(optional)</span>
            <input type="password" value={adminPassword} autoComplete="new-password"
              onChange={(e) => { setAdminPassword(e.target.value); setPreflight(null); }}
              style={inputStyle} data-testid="wiz-admin-password" placeholder="min 8 chars" />
            <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-tertiary)' }}>
              {adminPassword
                ? (adminPassword.length >= 8 ? 'Admin can log in immediately with this password.' : 'Too short — needs at least 8 characters.')
                : 'Leave blank to create the admin via an invite link instead.'}
            </span>
          </label>
          <label style={fieldLabel}>Plan
            <select value={planKey} onChange={(e) => { setPlanKey(e.target.value); setPreflight(null); }} style={selectStyle} data-testid="wiz-plan">
              <option value="">— blueprint default —</option>
              {plans.map((p) => <option key={p.key} value={p.key}>{p.key}</option>)}
            </select>
          </label>
        </div>
      )}

      {/* Step 3 — Review */}
      {step === 3 && (
        <div style={{ display: 'grid', gap: 12 }} data-testid="wiz-review">
          {busy && <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Validating…</div>}
          {preflight && (
            <>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <strong>Slug</strong> <code style={codeChip}>{preflight.slug}</code>
                <span style={preflight.slugAvailable ? okPill : badPill}>{preflight.slugAvailable ? 'available' : 'taken'}</span>
                <strong style={{ marginLeft: 12 }}>Plan</strong> <code style={codeChip}>{preflight.resolvedPlanKey}</code>
                <strong style={{ marginLeft: 12 }}>Admin</strong> <span style={{ fontSize: 12 }}>{preflight.adminEmail}</span>
                <span style={adminPassword ? okPill : neutralPill} data-testid="wiz-admin-access">
                  {adminPassword ? 'password set · can log in now' : 'invite link'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-secondary)' }} data-testid="wiz-summary">
                {Object.entries(preflight.summary).map(([k, v]) => (
                  <span key={k}><strong>{v}</strong> {k}</span>
                ))}
              </div>
              {preflight.issues.length > 0 && (
                <div style={{ display: 'grid', gap: 6 }}>
                  {preflight.issues.map((iss, i) => (
                    <div key={i} style={iss.level === 'error' ? issueErr : issueWarn}>{iss.level}: {iss.message}</div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Step 4 — Done */}
      {step === 4 && result && (
        <div style={{ display: 'grid', gap: 12 }} data-testid="wiz-done">
          <div style={successBar}><strong>Provisioned:</strong> <code style={codeChip}>{result.slug}</code></div>
          {result.adminLoginOrInviteLink && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <a href={result.adminLoginOrInviteLink} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent, #0070f3)' }} data-testid="wiz-link">Admin invite link</a>
              <button style={miniBtn} onClick={() => copyLink(result.adminLoginOrInviteLink)}>{copied ? 'Copied' : 'Copy'}</button>
            </div>
          )}
          <div><button style={primaryBtn} onClick={reset}>Provision another</button></div>
        </div>
      )}

      {/* Nav */}
      {step < 4 && (
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          {step > 0 && <button style={miniBtn} onClick={() => go(step - 1)} data-testid="wiz-back">Back</button>}
          {step < 3 && <button style={canNext ? primaryBtn : disabledBtn} disabled={!canNext} onClick={() => go(step + 1)} data-testid="wiz-next">Next</button>}
          {step === 3 && (
            <button style={preflight?.ok && !busy ? primaryBtn : disabledBtn} disabled={!preflight?.ok || busy} onClick={provision} data-testid="wiz-provision">
              {busy ? 'Provisioning…' : 'Provision'}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

const card = { background: 'var(--bg-muted)', border: '1px solid var(--border)', borderRadius: 8, padding: '14px 16px' };
const codeChip = { fontFamily: 'var(--mono)', fontSize: 11, padding: '1px 6px', border: '1px solid var(--border-strong, #333)', borderRadius: 3, color: 'var(--text-secondary)' };
const fieldLabel = { display: 'flex', flexDirection: 'column', gap: 5, fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 };
const selectStyle = { fontSize: 13, padding: '5px 8px', borderRadius: 5, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)', cursor: 'pointer', marginTop: 2 };
const inputStyle = { fontSize: 13, padding: '5px 8px', borderRadius: 5, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)', marginTop: 2 };
const primaryBtn = { fontSize: 13, padding: '5px 14px', borderRadius: 5, border: '1px solid var(--accent, #0070f3)', background: 'var(--accent, #0070f3)', color: '#fff', cursor: 'pointer', fontWeight: 500 };
const disabledBtn = { fontSize: 13, padding: '5px 14px', borderRadius: 5, border: '1px solid var(--border)', background: 'var(--bg-muted)', color: 'var(--text-tertiary)', cursor: 'not-allowed', fontWeight: 500 };
const miniBtn = { fontSize: 12, padding: '3px 8px', borderRadius: 5, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-secondary)', cursor: 'pointer' };
const errBar = { padding: '8px 12px', borderRadius: 6, background: 'var(--bg-muted)', border: '1px solid var(--status-red, #e05)', color: 'var(--status-red, #e05)', fontSize: 13, display: 'flex', gap: 8, alignItems: 'center' };
const successBar = { padding: '8px 12px', borderRadius: 6, background: 'rgba(0,160,80,0.08)', border: '1px solid rgba(0,160,80,0.25)', color: 'var(--status-green, #0a0)', fontSize: 13 };
const okPill = { fontSize: 10, padding: '1px 6px', borderRadius: 3, background: 'rgba(0,160,80,0.12)', color: 'var(--status-green, #0a0)', border: '1px solid rgba(0,160,80,0.25)' };
const badPill = { fontSize: 10, padding: '1px 6px', borderRadius: 3, background: 'rgba(224,0,85,0.1)', color: 'var(--status-red, #e05)', border: '1px solid rgba(224,0,85,0.25)' };
const neutralPill = { fontSize: 10, padding: '1px 6px', borderRadius: 3, background: 'var(--bg)', color: 'var(--text-tertiary)', border: '1px solid var(--border)' };
const issueErr = { fontSize: 12, padding: '6px 10px', borderRadius: 5, background: 'rgba(224,0,85,0.08)', border: '1px solid rgba(224,0,85,0.25)', color: 'var(--status-red, #e05)' };
const issueWarn = { fontSize: 12, padding: '6px 10px', borderRadius: 5, background: 'rgba(220,150,0,0.08)', border: '1px solid rgba(220,150,0,0.3)', color: 'var(--status-amber, #b80)' };
const stepChip = (active, done) => ({
  fontSize: 11, padding: '2px 8px', borderRadius: 12,
  background: active ? 'var(--accent, #0070f3)' : done ? 'rgba(0,112,243,0.12)' : 'var(--bg)',
  color: active ? '#fff' : done ? 'var(--accent, #0070f3)' : 'var(--text-tertiary)',
  border: `1px solid ${active || done ? 'rgba(0,112,243,0.4)' : 'var(--border)'}`,
});
