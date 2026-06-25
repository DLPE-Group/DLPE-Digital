import React from 'react';
import { Icon } from './icons.jsx';
import { DATA_TYPES, FIELD_RULES, DEFAULT_RULE, SAMPLE_RECORDS, FIELD_CATEGORIES } from './admin_data.js';
import { api } from './api/client.js';


/* Convert the server's flat FieldRule rows into the configurator's nested
   roleId -> dtId -> fieldId -> {visible,editable,masked,note} diff map. */
function rowsToRuleMap(rows) {
  const map = {};
  for (const r of rows || []) {
    (map[r.roleId] ||= {});
    (map[r.roleId][r.dataTypeId] ||= {});
    map[r.roleId][r.dataTypeId][r.fieldId] = {
      visible: r.visible, editable: r.editable, masked: r.masked,
      ...(r.note ? { note: r.note } : {}),
    };
  }
  return map;
}

/* Compute the diffs to persist for one role+dataType+scope from the nested map.
   We send the full set of fields the role overrides on this data type. */
function diffsForRole(rules, roleId, dtId, scopeEnum) {
  const byDt = rules[roleId]?.[dtId] || {};
  return Object.entries(byDt).map(([fieldId, r]) => ({
    roleId, dataTypeId: dtId, fieldId, scope: scopeEnum,
    visible: r.visible !== undefined ? r.visible : DEFAULT_RULE.visible,
    editable: r.editable !== undefined ? r.editable : DEFAULT_RULE.editable,
    masked: r.masked !== undefined ? r.masked : DEFAULT_RULE.masked,
    note: r.note || null,
  }));
}

/* ============================================================
   ROLES + FIELD-LEVEL RBAC CONFIGURATOR  (Spec §2, §3)
   ============================================================ */

/* Effective rule = field default merged with the role's override. */
function effRule(roleId, dtId, fieldId) {
  const o = FIELD_RULES[roleId]?.[dtId]?.[fieldId];
  return { ...DEFAULT_RULE, ...(o || {}) };
}
function isModified(roleId, dtId, fieldId) {
  return !!FIELD_RULES[roleId]?.[dtId]?.[fieldId];
}

/* Mask a sample value for the preview pane. */
function maskValue(fieldId, val) {
  if (fieldId === 'bank_account') return '•••• •••• •••• ' + val.slice(-4);
  if (fieldId === 'sales_rep' || fieldId === 'account_mgr') {
    return val.split(/\s+/).map(s => s[0]).join('.').toUpperCase() + '.';
  }
  if (/value|fee|cost|amount|margin|balance|limit/.test(fieldId)) return '€XXX,XXX';
  return val.replace(/[A-Za-z0-9]/g, 'X');
}

/* ---------------- Roles list ---------------- */
export const RolesView = ({ onConfigure }) => {
  const [q, setQ] = React.useState('');
  const [roles, setRoles] = React.useState([]);
  const [creating, setCreating] = React.useState(false);
  const [newName, setNewName] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const refresh = React.useCallback(() => {
    return api.get('/admin/roles')
      // The tenant's real roles always win — even an empty list — so no demo
      // role ever shows. (A provisioned tenant always has its system roles.)
      .then((rows) => { if (Array.isArray(rows)) setRoles(rows); })
      .catch(() => { /* leave list empty on network error */ });
  }, []);
  React.useEffect(() => { refresh(); }, [refresh]);

  const createRole = async () => {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    try {
      await api.post('/admin/roles', { name, desc: 'Custom role', tracks: [] });
      await refresh();
      setCreating(false); setNewName('');
    } catch (e) { console.error('Failed to create role', e); }
    setBusy(false);
  };

  const cloneRole = async (id) => {
    setBusy(true);
    try { await api.post(`/admin/roles/${id}/clone`, {}); await refresh(); }
    catch (e) { console.error('Failed to clone role', e); }
    setBusy(false);
  };

  const renameRole = async (r) => {
    const name = window.prompt('Rename role', r.name);
    if (!name || name.trim() === r.name) return;
    setBusy(true);
    try { await api.patch(`/admin/roles/${r.id}`, { name: name.trim() }); await refresh(); }
    catch (e) { window.alert(e.message || 'Rename failed'); }
    setBusy(false);
  };

  const deleteRole = async (r) => {
    if (!window.confirm(`Delete role "${r.name}"? This cannot be undone.`)) return;
    setBusy(true);
    try { await api.del(`/admin/roles/${r.id}`); await refresh(); }
    catch (e) { window.alert(e.message || 'Delete failed'); }
    setBusy(false);
  };

  const list = roles.filter(r => !q || `${r.name} ${r.desc}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="viewWrap" style={{ maxWidth: 1100 }}>
      <div className="viewHero">
        <div>
          <h1>Roles &amp; permissions</h1>
          <div className="sub">Roles bundle functional access (which tracks) with field-level rules (which fields are visible, editable or masked). Start from a system template, clone it, then tune fields in the configurator.</div>
        </div>
        <button className="cta" onClick={() => setCreating(v => !v)}><Icon name="plus" size={12} strokeWidth={2} /> New role</button>
      </div>

      {creating && (
        <div className="addScopeRow" style={{ marginBottom: 12 }}>
          <input className="textInput" autoFocus placeholder="New role name…" value={newName}
                 onChange={e => setNewName(e.target.value)}
                 onKeyDown={e => { if (e.key === 'Enter') createRole(); }} />
          <button className="cta" disabled={busy || !newName.trim()} onClick={createRole}>Create</button>
          <button className="cta ghost" onClick={() => { setCreating(false); setNewName(''); }}>Cancel</button>
        </div>
      )}

      <div className="filterBar">
        <div className="searchInline">
          <Icon name="search" size={13} />
          <input placeholder="Search roles…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>{roles.filter(r => r.system).length} system · {roles.filter(r => !r.system).length} custom</span>
      </div>

      <div className="roleGrid">
        {list.map(r => (
          <div className="roleCard" key={r.id}>
            <div className="roleCardTop">
              <div className="roleName">{r.name}
                {r.system ? <span className="roleTag sys">System</span> : <span className="roleTag custom">Custom</span>}
              </div>
              <span className="roleUsers" title="Users with this role"><Icon name="user" size={11} /> {r.users}</span>
            </div>
            <div className="roleDesc">{r.desc}</div>
            <div className="roleTracks">
              {r.tracks.map(t => <span className="trackChip" key={t}>{t}</span>)}
            </div>
            <div className="roleEdit"><span className="k">Edit rights</span> {r.edit}</div>
            <div className="roleActions">
              <button className="cta ghost sm" disabled={busy} onClick={() => cloneRole(r.id)}><Icon name="document" size={11} /> Clone</button>
              <button className="cta ghost sm" disabled={busy} onClick={() => renameRole(r)} title="Rename role">Rename</button>
              {!r.system && (
                <button className="cta ghost sm" disabled={busy} onClick={() => deleteRole(r)} title="Delete role"
                        style={{ color: 'var(--status-red, #e05)' }}>Delete</button>
              )}
              <button className="cta sm" onClick={() => onConfigure(r.id)}>
                <Icon name="settings" size={11} strokeWidth={2} /> Edit field permissions
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ---------------- Field matrix row ---------------- */
const MatrixRow = ({ field, rule, modified, onToggle }) => {
  const stateLabel = !rule.visible ? 'Hidden'
    : rule.masked ? 'Masked'
    : rule.editable ? 'Read / write' : 'Read only';
  const stateClass = !rule.visible ? 'hidden' : rule.masked ? 'masked' : rule.editable ? 'rw' : 'ro';
  return (
    <div className={`matrixRow ${!rule.visible ? 'isHidden' : ''}`}>
      <div className="mxField">
        {field.label}
        {modified && <span className="modDot" title="Modified from template" />}
      </div>
      <div className="mxCheck">
        <button className={`chk ${rule.visible ? 'on' : ''}`} onClick={() => onToggle('visible')}>
          {rule.visible && <Icon name="check" size={11} strokeWidth={2.5} />}
        </button>
      </div>
      <div className="mxCheck">
        <button className={`chk ${rule.editable ? 'on' : ''}`} disabled={!rule.visible} onClick={() => onToggle('editable')}>
          {rule.editable && rule.visible && <Icon name="check" size={11} strokeWidth={2.5} />}
        </button>
      </div>
      <div className="mxCheck">
        <button className={`chk ${rule.masked ? 'on' : ''}`} disabled={!rule.visible} onClick={() => onToggle('masked')}>
          {rule.masked && rule.visible && <Icon name="check" size={11} strokeWidth={2.5} />}
        </button>
      </div>
      <div className="mxState"><span className={`stateTag ${stateClass}`}>{stateLabel}</span></div>
      <div className="mxNote">{rule.note || ''}</div>
    </div>
  );
};

/* ---------------- Configurator ---------------- */
export const RbacConfigurator = ({ initialRole, onBack, onPreviewRole }) => {
  const [roleId, setRoleId] = React.useState(initialRole || '');
  // The tenant's real roles drive the dropdown + role meta (namespaced per tenant,
  // e.g. `<slug>-sales-rep`) — never the demo ROLES fixture.
  const [roles, setRoles] = React.useState([]);
  // Scope-refinement options built from the tenant's real org (no demo places).
  const [scopeOpts, setScopeOpts] = React.useState([{ value: 'ANY', label: 'Any scope (default)' }]);
  const [dtId, setDtId] = React.useState('contract');
  const [scope, setScope] = React.useState('ANY');
  const [dirty, setDirty] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  // Local editable rules: roleId -> dtId -> fieldId -> rule (only stores diffs).
  // Starts empty and is filled from the server per role — no demo rules shown.
  const [rules, setRules] = React.useState({});

  // Version history loaded from the server (empty until loaded — no demo history).
  const [versions, setVersions] = React.useState([]);
  const version = versions[0]?.v ?? 1;

  // Server-enforced filtered record for the preview pane (source of truth).
  const [serverRecord, setServerRecord] = React.useState(null);

  const role = roles.find(r => r.id === roleId);
  const dt = DATA_TYPES.find(d => d.id === dtId);

  // Load the tenant's real roles; default the selection to the first if unset/invalid.
  React.useEffect(() => {
    let cancelled = false;
    api.get('/admin/roles').then((rows) => {
      if (cancelled || !Array.isArray(rows)) return;
      setRoles(rows);
      setRoleId((cur) => (rows.some(r => r.id === cur) ? cur : (rows[0]?.id || '')));
    }).catch(() => { /* leave empty on network error */ });
    // Scope-refinement options from the tenant's real org (countries + companies).
    api.get('/admin/structure').then((root) => {
      if (cancelled || !root) return;
      const opts = [{ value: 'ANY', label: 'Any scope (default)' }];
      const walk = (n) => {
        if (!n) return;
        const k = String(n.kind || '').toLowerCase();
        if (k === 'country' || k === 'company') opts.push({ value: n.name, label: `${n.name} only` });
        (n.children || []).forEach(walk);
      };
      walk(root);
      setScopeOpts(opts);
    }).catch(() => { /* keep just 'Any scope' on network error */ });
    return () => { cancelled = true; };
  }, []);

  // Load this role's persisted rules from the server when the role changes.
  React.useEffect(() => {
    let cancelled = false;
    api.get(`/admin/field-rules?role=${encodeURIComponent(roleId)}`)
      .then(rows => {
        if (cancelled) return;
        const loaded = rowsToRuleMap(rows);
        setRules(prev => {
          const next = JSON.parse(JSON.stringify(prev));
          // Replace this role's rules wholesale with the server's truth.
          next[roleId] = loaded[roleId] || {};
          return next;
        });
        setDirty(false);
      })
      .catch(() => { /* keep imported FIELD_RULES fallback */ });
    return () => { cancelled = true; };
  }, [roleId]);

  // Load version history once on mount.
  React.useEffect(() => {
    api.get('/admin/rbac/versions')
      .then(vs => { if (Array.isArray(vs)) setVersions(vs); })
      .catch(() => { /* keep imported RBAC_VERSIONS fallback */ });
  }, []);

  // Fetch the server-filtered record for the preview pane whenever the
  // role/data-type changes or local edits are saved (server is source of truth).
  const refreshPreview = React.useCallback(() => {
    let cancelled = false;
    api.get(`/records/${dtId}?role=${encodeURIComponent(roleId)}`)
      .then(res => { if (!cancelled) setServerRecord(res.record); })
      .catch(() => { if (!cancelled) setServerRecord(null); });
    return () => { cancelled = true; };
  }, [roleId, dtId]);
  React.useEffect(() => refreshPreview(), [refreshPreview]);

  const getRule = (fid) => ({ ...DEFAULT_RULE, ...(rules[roleId]?.[dtId]?.[fid] || {}) });
  const modified = (fid) => !!rules[roleId]?.[dtId]?.[fid];

  const setRule = (fid, patch) => {
    setRules(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      next[roleId] = next[roleId] || {};
      next[roleId][dtId] = next[roleId][dtId] || {};
      const cur = { ...DEFAULT_RULE, ...(next[roleId][dtId][fid] || {}) };
      const merged = { ...cur, ...patch };
      // dependent logic: hidden field can't be editable/masked
      if (merged.visible === false) { merged.editable = false; merged.masked = false; }
      next[roleId][dtId][fid] = merged;
      return next;
    });
    setDirty(true);
  };

  const toggle = (fid, key) => {
    const cur = getRule(fid);
    if (key === 'visible' && cur.visible) setRule(fid, { visible: false });
    else if (key === 'visible') setRule(fid, { visible: true });
    else setRule(fid, { [key]: !cur[key] });
  };

  const bulk = (action) => {
    const target = {};
    dt.fields.forEach(f => {
      if (action === 'hideFin' && f.cat === 'Financial') target[f.id] = { visible: false, editable: false, masked: false };
      if (action === 'maskPII' && f.cat === 'Identity') target[f.id] = { visible: true, editable: false, masked: true };
      if (action === 'reset') target[f.id] = 'reset';
    });
    setRules(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      if (action === 'reset') {
        if (next[roleId]) delete next[roleId][dtId];
        return next;
      }
      next[roleId] = next[roleId] || {};
      next[roleId][dtId] = next[roleId][dtId] || {};
      Object.entries(target).forEach(([fid, r]) => {
        const cur = { ...DEFAULT_RULE, ...(next[roleId][dtId][fid] || {}) };
        next[roleId][dtId][fid] = { ...cur, ...r };
      });
      return next;
    });
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const scopeEnum = scope || 'ANY';
      const diffs = diffsForRole(rules, roleId, dtId, scopeEnum);
      await api.put('/admin/field-rules', {
        diffs,
        actor: 'Console admin',
        note: `Updated ${dt.label} rules for ${role?.name || roleId}`,
      });
      const vs = await api.get('/admin/rbac/versions');
      if (Array.isArray(vs)) setVersions(vs);
      setDirty(false);
      refreshPreview();
    } catch {
      // Optimistic local state is kept; leave dirty so the user can retry.
    } finally {
      setSaving(false);
    }
  };

  // Transactionally revert the whole field-rule set to a stored version,
  // then reload versions + this role's rules from the server.
  const revertVersion = async (v) => {
    setSaving(true);
    try {
      await api.post(`/admin/rbac/versions/${v}/revert`, { actor: 'Console admin' });
      const vs = await api.get('/admin/rbac/versions');
      if (Array.isArray(vs)) setVersions(vs);
      const rows = await api.get(`/admin/field-rules?role=${encodeURIComponent(roleId)}`);
      const loaded = rowsToRuleMap(rows);
      setRules(prev => { const next = JSON.parse(JSON.stringify(prev)); next[roleId] = loaded[roleId] || {}; return next; });
      setDirty(false);
      refreshPreview();
    } catch (e) {
      console.error('Failed to revert version', e);
    } finally {
      setSaving(false);
    }
  };

  const cats = FIELD_CATEGORIES.filter(c => dt.fields.some(f => f.cat === c));
  const sample = SAMPLE_RECORDS[dtId];

  return (
    <div className="viewWrap" style={{ maxWidth: 1240 }}>
      <div className="breadcrumb">
        <button className="crumbLink" onClick={onBack}>Roles &amp; permissions</button>
        <Icon name="chevronRight" size={12} />
        <span>Field configurator</span>
      </div>

      <div className="viewHero">
        <div>
          <h1>Field configurator</h1>
          <div className="sub">Set, per role, which fields are visible, editable or masked — no code. The preview shows exactly what this role sees on a real record.</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {dirty && <span className="dirtyTag"><span className="d" /> Unsaved changes</span>}
          <button className="cta ghost" onClick={() => onPreviewRole(roleId)}><Icon name="eye" size={13} strokeWidth={2} /> Preview as user</button>
          <button className="cta" onClick={save} disabled={!dirty || saving}><Icon name="check" size={12} strokeWidth={2} /> {saving ? 'Saving…' : 'Save & deploy'}</button>
        </div>
      </div>

      <div className="rbacLayout">
        {/* ---- Context selector ---- */}
        <aside className="rbacContext">
          <div className="ctxBlock">
            <div className="ctxLabel">Role</div>
            <select className="textInput" value={roleId} onChange={e => { setRoleId(e.target.value); }}>
              {roles.map(r => <option key={r.id} value={r.id}>{r.name}{r.system ? '' : ' (custom)'}</option>)}
            </select>
            <div className="ctxRoleMeta">{role?.desc}</div>
          </div>

          <div className="ctxBlock">
            <div className="ctxLabel">Scope <span className="opt">optional</span></div>
            <select className="textInput" value={scope} onChange={e => setScope(e.target.value)}>
              {scopeOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <div className="ctxRoleMeta">Apply this rule only when the role is exercised at a given company or country.</div>
          </div>

          <div className="ctxBlock">
            <div className="ctxLabel">Data type</div>
            <div className="dtTabs">
              {DATA_TYPES.map(d => (
                <button key={d.id} className={`dtTab ${dtId === d.id ? 'on' : ''}`} onClick={() => setDtId(d.id)}>
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <div className="precedenceBox">
            <div className="pbHead"><Icon name="lock" size={12} /> Most-restrictive wins</div>
            <p>When a user has multiple roles or scopes touching the same field, conflicts resolve to the most restrictive: <strong>hidden</strong> beats visible, <strong>read</strong> beats editable, <strong>masked</strong> beats full.</p>
          </div>

          <div className="versionBox">
            <div className="vbHead">Version history</div>
            {versions.map(v => (
              <div className="vbRow" key={v.v}>
                <span className={`vbVer ${v.v === version ? 'cur' : ''}`}>v{v.v}</span>
                <div>
                  <div className="vbNote">{v.note}</div>
                  <div className="vbMeta">{v.when} · {v.actor}{v.v === version ? ' · current' : <button className="revertLink" disabled={saving} onClick={() => revertVersion(v.v)}> · revert</button>}</div>
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* ---- Matrix + preview ---- */}
        <div className="rbacMain">
          <div className="bulkBar">
            <span className="bulkLabel">Bulk actions</span>
            <button className="miniBtn" onClick={() => bulk('hideFin')}>Hide all financial fields</button>
            <button className="miniBtn" onClick={() => bulk('maskPII')}>Mask all PII</button>
            <button className="miniBtn" onClick={() => bulk('reset')}><Icon name="refresh" size={11} /> Reset to template</button>
          </div>

          <div className="matrix">
            <div className="matrixHead">
              <div>Field on {dt.label}</div>
              <div className="mxCheck">Visible</div>
              <div className="mxCheck">Editable</div>
              <div className="mxCheck">Masked</div>
              <div className="mxState">State</div>
              <div className="mxNote">Reason / note</div>
            </div>
            {cats.map(cat => (
              <React.Fragment key={cat}>
                <div className="matrixCat">{cat}</div>
                {dt.fields.filter(f => f.cat === cat).map(f => (
                  <MatrixRow key={f.id} field={f} rule={getRule(f.id)} modified={modified(f.id)}
                             onToggle={(k) => toggle(f.id, k)} />
                ))}
              </React.Fragment>
            ))}
          </div>

          {/* Live preview */}
          <div className="previewPane">
            <div className="previewHead">
              <div><Icon name="eye" size={13} /> Live preview</div>
              <div className="previewSub">What a <strong>{role.name}</strong> sees when viewing a <strong>{dt.label.toLowerCase()}</strong></div>
            </div>
            <div className="recordCard">
              {dt.fields.map(f => {
                // Server response is the source of truth; fall back to local
                // effRule/maskValue for instant preview before it arrives.
                const useServer = serverRecord != null;
                const hidden = useServer
                  ? (serverRecord.__hidden || []).includes(f.id)
                  : !getRule(f.id).visible;
                if (hidden) {
                  return (
                    <div className="recRow hidden" key={f.id}>
                      <div className="recK">{f.label}</div>
                      <div className="recV"><span className="hiddenChip"><Icon name="lock" size={10} /> hidden</span></div>
                    </div>
                  );
                }
                const rule = getRule(f.id);
                const readonly = useServer
                  ? (serverRecord.__readonly || []).includes(f.id)
                  : !rule.editable;
                // The server has already masked the value; locally we mask on the fly.
                const displayVal = useServer
                  ? serverRecord[f.id]
                  : (rule.masked ? maskValue(f.id, sample[f.id]) : sample[f.id]);
                const masked = useServer
                  ? displayVal !== sample[f.id]
                  : rule.masked;
                return (
                  <div className="recRow" key={f.id}>
                    <div className="recK">{f.label}</div>
                    <div className="recV">
                      <span className={masked ? 'maskedVal' : ''}>{displayVal}</span>
                      {readonly && <Icon name="lock" size={10} className="lockMini" />}
                      {masked && <span className="maskBadge">masked</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
