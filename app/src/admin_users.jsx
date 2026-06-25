import React from 'react';
import { Icon } from './icons.jsx';
import { GROUP_TREE, ROLES, FIELD_RULES, DATA_TYPES, SCOPE_TYPE_LABEL, DEFAULT_RULE } from './admin_data.js';
import { api } from './api/client.js';

/* ============================================================
   USERS — list + detail with scopes, roles and a live
   plain-language effective-permissions summary.  (Spec §2, §7)
   ============================================================ */

const statusPillClass = { active: 'ok', invited: 'warn', disabled: 'late' };
const statusLabel = { active: 'Active', invited: 'Invited', disabled: 'Disabled' };

export const UserDetail = ({ user, onBack, onPreviewAs }) => {
  const [secondary, setSecondary] = React.useState(user.secondary);
  const [adding, setAdding] = React.useState(false);
  const [summary] = React.useState(user.summary);
  const [status, setStatus] = React.useState(user.status);

  const toggleStatus = async () => {
    const next = status === 'disabled' ? 'active' : 'disabled';
    if (next === 'disabled' && !window.confirm(`Deactivate ${user.name}? They will be unable to sign in.`)) return;
    try {
      await api.patch(`/admin/users/${user.id}`, { status: next });
      setStatus(next);
    } catch (e) { window.alert(e.message || 'Failed to update status'); }
  };

  // Load the real user's persisted secondary scopes (with server ids) on open.
  React.useEffect(() => {
    let cancelled = false;
    api.get(`/admin/users/${user.id}`).then((u) => {
      if (cancelled || !u || !Array.isArray(u.secondary)) return;
      setSecondary(u.secondary.map((s) => ({
        id: s.id,
        scope: s.scopeLabel || s.scopeNode?.name || 'Scope',
        role: s.roleLabel || s.role?.name || '—',
      })));
    }).catch(() => { /* keep seed-provided secondary */ });
    return () => { cancelled = true; };
  }, [user.id]);

  const addScope = async (scope, role) => {
    const roleId = (ROLES.find((r) => r.name === role) || {}).id || null;
    let created;
    try {
      created = await api.post(`/admin/users/${user.id}/scopes`,
        { scopeType: 'company', scopeLabel: scope, roleLabel: role, roleId });
    } catch (e) {
      console.error('Failed to add scope', e);
      created = { id: 'tmp-' + Date.now() };
    }
    setSecondary((s) => [...s, { id: created.id, scope, role }]);
    setAdding(false);
  };

  const removeScope = async (i) => {
    const row = secondary[i];
    setSecondary((arr) => arr.filter((_, j) => j !== i));
    if (row?.id && !String(row.id).startsWith('tmp-')) {
      api.del(`/admin/users/${user.id}/scopes/${row.id}`).catch((e) => console.error('Failed to remove scope', e));
    }
  };

  return (
    <div className="viewWrap" style={{ maxWidth: 1000 }}>
      <div className="breadcrumb">
        <button className="crumbLink" onClick={onBack}>Users</button>
        <Icon name="chevronRight" size={12} />
        <span>{user.name}</span>
      </div>

      <div className="viewHero">
        <div className="userHeroMain">
          <span className="userAvatarLg">{user.initials}</span>
          <div>
            <h1>{user.name}</h1>
            <div className="sub">{user.email} · <span className={`statusPill ${statusPillClass[status]}`}><span className="d" /> {statusLabel[status]}</span></div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {onPreviewAs && (
            <button className="cta" onClick={() => onPreviewAs(user)}>
              <Icon name="eye" size={13} strokeWidth={2} /> Preview as {user.name.split(' ')[0]}
            </button>
          )}
          <button className="cta ghost" onClick={toggleStatus}
                  style={status === 'disabled' ? undefined : { color: 'var(--status-red, #e05)' }}>
            <Icon name={status === 'disabled' ? 'check' : 'close'} size={13} />
            {status === 'disabled' ? 'Reactivate' : 'Deactivate'}
          </button>
        </div>
      </div>

      <div className="settingsSection">
        <div className="h"><h3>Primary scope</h3><div className="hint">One per user · defines the slice of the org they work in</div></div>
        <div className="settingsBody">
          <div className="scopeCard primary">
            <div className="scopeCardL">
              <span className="scopeBadge">{SCOPE_TYPE_LABEL[user.scopeType]}</span>
              <div>
                <div className="scopeName">{user.scopeLabel}</div>
                <div className="scopeRole">Role · <strong>{user.role}</strong></div>
              </div>
            </div>
            <button className="miniBtn"><Icon name="settings" size={11} /> Field overrides</button>
          </div>
        </div>
      </div>

      <div className="settingsSection">
        <div className="h">
          <h3>Secondary scopes</h3>
          <button className="miniBtn" onClick={() => setAdding(true)}><Icon name="plus" size={11} strokeWidth={2} /> Add scope</button>
        </div>
        <div className="settingsBody">
          {secondary.length === 0 && !adding && (
            <div className="emptyHint">No secondary scopes. Add one to grant read or edit access to another company or country.</div>
          )}
          {secondary.map((s, i) => (
            <div className="scopeCard" key={i}>
              <div className="scopeCardL">
                <span className="scopeBadge ro">Read-only</span>
                <div>
                  <div className="scopeName">{s.scope}</div>
                  <div className="scopeRole">Role · <strong>{s.role}</strong></div>
                </div>
              </div>
              <button className="miniBtn" onClick={() => removeScope(i)}>Remove</button>
            </div>
          ))}
          {adding && (
            <div className="addScopeRow">
              <select className="textInput" id="newScopeSel" defaultValue="Belgium">
                <option>Belgium</option><option>Netherlands</option><option>Germany</option><option>Luxembourg</option><option>Amsterdam Branch</option>
              </select>
              <select className="textInput" id="newRoleSel" defaultValue="Sales manager — read only">
                <option>Sales manager — read only</option><option>Sales rep</option><option>Ops coordinator</option><option>Finance manager</option>
              </select>
              <button className="cta" onClick={() => addScope(document.getElementById('newScopeSel').value, document.getElementById('newRoleSel').value)}>Add</button>
              <button className="cta ghost" onClick={() => setAdding(false)}>Cancel</button>
            </div>
          )}
        </div>
      </div>

      {/* Effective permissions — generated, plain-language */}
      <div className="settingsSection effPanel">
        <div className="h">
          <h3>Effective permissions</h3>
          <div className="hint">Generated from scopes + roles + field rules · updates live</div>
        </div>
        <div className="settingsBody">
          <div className="effGrid">
            <div className="effCol can">
              <div className="effHead"><Icon name="check" size={13} strokeWidth={2} /> {user.name.split(' ')[0]} can</div>
              {summary.can.map((c, i) => <div className="effItem" key={i}>{c}</div>)}
            </div>
            <div className="effCol cannot">
              <div className="effHead"><Icon name="lock" size={12} /> {user.name.split(' ')[0]} cannot</div>
              {summary.cannot.length === 0
                ? <div className="effItem muted">No restrictions — full access in scope</div>
                : summary.cannot.map((c, i) => <div className="effItem" key={i}>{c}</div>)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ---- scope targets, walked from the group tree ---- */
const ALL_COMPANIES = [];
const ALL_COUNTRIES = [];
(function walk(n) {
  if (n.kind === 'company') ALL_COMPANIES.push(n.name);
  if (n.kind === 'country') ALL_COUNTRIES.push(n.name);
  (n.children || []).forEach(walk);
})(GROUP_TREE);

const SCOPE_TARGETS = {
  group: ['Entire group'],
  region: ['Benelux'],
  country: ALL_COUNTRIES,
  multi_company: ALL_COMPANIES,   // pick 2+
  company: ALL_COMPANIES,
  self: ['Own / assigned records only'],
};

// Generic (non-demo) scope targets used until the real org structure loads, and
// as the fallback if it can't be fetched — never the demo Benelux/Rotterdam set.
const GENERIC_SCOPE_TARGETS = {
  group: ['Entire group'], region: [], country: [], multi_company: [], company: [],
  self: ['Own / assigned records only'],
};

// Flatten the tenant's real org tree into scope-target option lists by node kind.
function buildScopeTargets(root) {
  const companies = [], countries = [], regions = [];
  const walk = (n) => {
    if (!n) return;
    const k = String(n.kind || '').toLowerCase();
    if (k === 'company') companies.push(n.name);
    else if (k === 'country') countries.push(n.name);
    else if (k === 'region') regions.push(n.name);
    (n.children || []).forEach(walk);
  };
  walk(root);
  return {
    group: ['Entire group'],
    region: regions,
    country: countries,
    multi_company: companies,
    company: companies,
    self: ['Own / assigned records only'],
  };
}

/* Derive a live effective-permissions summary from the chosen role + scope.
   Pulls field restrictions straight out of the RBAC rule set so the invite
   preview matches what the configurator would produce. */
function deriveSummary(roleId, scopeLabel) {
  const role = ROLES.find(r => r.id === roleId);
  if (!role) return { can: [], cannot: [] };
  const can = [];
  const cannot = [];

  if (roleId === 'sys-integrator') {
    can.push('Configure integrations, endpoints and the environment across all companies');
    can.push('View sync status and error logs group-wide');
    cannot.push('See any business data — contracts, invoices, fleet operator names');
    return { can, cannot };
  }

  const tracks = role.tracks.join(' · ');
  can.push(`Access in ${scopeLabel}: ${tracks}`);
  can.push(`Edit rights — ${role.edit}`);

  const rules = FIELD_RULES[roleId];
  const hidden = [], masked = [];
  if (rules) {
    Object.entries(rules).forEach(([dt, fields]) => {
      Object.entries(fields).forEach(([fid, r]) => {
        const label = DATA_TYPES.find(d => d.id === dt)?.fields.find(f => f.id === fid)?.label || fid;
        if (r.visible === false) hidden.push(label);
        else if (r.masked) masked.push(label);
      });
    });
  }
  const uniq = a => [...new Set(a)];
  if (hidden.length) cannot.push('See: ' + uniq(hidden).slice(0, 5).join(', '));
  if (masked.length) cannot.push('See in full (shown masked): ' + uniq(masked).slice(0, 4).join(', '));
  if (!cannot.length) cannot.push(role.id === 'group-admin' ? 'Nothing — full control of the platform' : 'No field-level restrictions for this role in scope');
  return { can, cannot };
}

/* Map a server user row (with included role/scope rows) into the UI shape
   the views render: string role name, secondary [{scope,role}], summary, lastSeen. */
function adaptUser(u) {
  const roleId = u.roleId || (u.role && u.role.id) || 'sales-rep';
  const roleName = (u.role && u.role.name) || ROLES.find(r => r.id === roleId)?.name || roleId;
  const scopeLabel = u.scopeLabel || (u.scopeNode && u.scopeNode.name) || '—';
  const secondary = (u.secondary || []).map(s => ({
    scope: s.scopeLabel || (s.scopeNode && s.scopeNode.name) || '—',
    role: s.roleLabel || (s.role && s.role.name) || '',
    scopeType: s.scopeType || 'company',
  }));
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    initials: u.initials || (u.name || '').split(/\s+/).filter(Boolean).slice(0, 2).map(s => s[0]).join('').toUpperCase(),
    scopeLabel,
    scopeType: u.scopeType || 'company',
    role: roleName,
    lastSeen: u.lastSeen || (u.status === 'invited' ? 'Never · invite pending' : 'Recently'),
    status: u.status || 'active',
    secondary,
    summary: u.summary || deriveSummary(roleId, scopeLabel),
  };
}

const ScopeEditor = ({ scopeType, setScopeType, target, setTarget, roleId, setRoleId, compact, roles, scopeTargets }) => {
  const ST = scopeTargets || GENERIC_SCOPE_TARGETS;
  const targets = ST[scopeType] || [];
  const multi = scopeType === 'multi_company';
  // Use the tenant's real roles when available; fall back to demo ROLES only if
  // the API list hasn't loaded (keeps the literal-id demo tenant working too).
  const roleList = roles && roles.length ? roles : ROLES;
  return (
    <div className="scopeEditor">
      <div className="seGrid">
        <label className="seField">
          <span className="fl">Scope level</span>
          <select className="textInput" value={scopeType} onChange={e => { const v = e.target.value; setScopeType(v); setTarget(v === 'multi_company' ? [] : ((ST[v] || [])[0] || '')); }}>
            {Object.keys(SCOPE_TYPE_LABEL).map(k => <option key={k} value={k}>{SCOPE_TYPE_LABEL[k]}</option>)}
          </select>
        </label>
        <label className="seField">
          <span className="fl">Role</span>
          <select className="textInput" value={roleId} onChange={e => setRoleId(e.target.value)}>
            {roleList.map(r => <option key={r.id} value={r.id}>{r.name}{r.system ? '' : ' (custom)'}</option>)}
          </select>
        </label>
      </div>
      <div className="seField" style={{ marginTop: 10 }}>
        <span className="fl">{multi ? 'Companies (pick 2 or more)' : scopeType === 'self' || scopeType === 'group' || scopeType === 'region' ? 'Applies to' : 'Target'}</span>
        {multi ? (
          <div className="targetChips">
            {targets.map(c => {
              const on = Array.isArray(target) && target.includes(c);
              return (
                <button type="button" key={c} className={`targetChip ${on ? 'on' : ''}`}
                        onClick={() => setTarget(prev => {
                          const arr = Array.isArray(prev) ? prev : [];
                          return arr.includes(c) ? arr.filter(x => x !== c) : [...arr, c];
                        })}>
                  {on && <Icon name="check" size={10} strokeWidth={2.5} />} {c}
                </button>
              );
            })}
          </div>
        ) : targets.length > 1 ? (
          <select className="textInput" value={target} onChange={e => setTarget(e.target.value)}>
            {targets.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        ) : (
          <div className="targetFixed">{targets[0]}</div>
        )}
      </div>
    </div>
  );
};

export const CreateUserPanel = ({ onClose, onCreate, roles, scopeTargets }) => {
  const ST = scopeTargets || GENERIC_SCOPE_TARGETS;
  const genPw = () => {
    const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ', b = 'abcdefghijkmnpqrstuvwxyz', d = '23456789';
    const pick = s => s[Math.floor(Math.random() * s.length)];
    return pick(a) + pick(b) + pick(b) + pick(b) + pick(b) + '-' + pick(d) + pick(d) + pick(d) + pick(d);
  };
  // Tenant's real roles when available; fall back to demo ROLES until they load.
  const roleList = roles && roles.length ? roles : ROLES;
  // Prefer a non-admin role as the default (a sales-rep-like role if present),
  // else the first real role — never a hardcoded id that may not exist in-tenant.
  const defaultRoleId = (roleList.find(r => /sales-rep$/.test(r.id)) || roleList[0] || {}).id || '';
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [method, setMethod] = React.useState('password');
  const [pw, setPw] = React.useState(genPw);
  const [scopeType, setScopeType] = React.useState('company');
  const [target, setTarget] = React.useState((ST.company || [])[0] || '');
  const [roleId, setRoleId] = React.useState(defaultRoleId);
  const [secondary, setSecondary] = React.useState([]);
  const [addingSec, setAddingSec] = React.useState(false);

  // Once roles load (or change), keep the selection valid.
  React.useEffect(() => {
    if (!roleList.some(r => r.id === roleId)) setRoleId(defaultRoleId);
  }, [roleList, roleId, defaultRoleId]);

  const scopeLabel = Array.isArray(target) ? (target.length ? target.join(' + ') : '—') : target;
  const summary = deriveSummary(roleId, scopeLabel);
  const role = roleList.find(r => r.id === roleId);
  const credsOk = method === 'email' || pw.trim().length >= 6;
  const valid = name.trim() && /.+@.+\..+/.test(email) && credsOk && (Array.isArray(target) ? target.length >= 2 : !!target);

  const firstName = name.trim().split(/\s+/)[0] || 'They';

  const create = () => {
    const initials = name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(s => s[0]).join('').toUpperCase();
    onCreate({
      id: 'u-' + Date.now(), name: name.trim(), email: email.trim(), initials,
      scopeLabel, scopeType, role: role?.name ?? roleId, roleId,
      password: method === 'password' ? pw.trim() : undefined,
      lastSeen: method === 'email' ? 'Never · invite sent just now' : 'Never · created just now',
      status: method === 'email' ? 'invited' : 'active',
      secondary, summary,
    });
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sidePanel wide" onClick={e => e.stopPropagation()}>
        <div className="sidePanelHead">
          <div>
            <h2>Create user</h2>
            <div className="sub">Identity, sign-in, scope and role on one page. The account is provisioned immediately — access takes effect at first sign-in.</div>
          </div>
          <button className="iconBtn" onClick={onClose}><Icon name="close" size={16} /></button>
        </div>
        <div className="sidePanelBody">
          <div className="panelSection">
            <div className="psHead">Identity</div>
            <div className="seGrid">
              <label className="seField"><span className="fl">Full name</span>
                <input className="textInput" autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Marie Dubois" /></label>
              <label className="seField"><span className="fl">Work email</span>
                <input className="textInput" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@group.eu" /></label>
            </div>
          </div>

          <div className="panelSection">
            <div className="psHead">Sign-in</div>
            <div className="methodSeg">
              <button type="button" className={`mSeg ${method === 'password' ? 'on' : ''}`} onClick={() => setMethod('password')}>Set temporary password</button>
              <button type="button" className={`mSeg ${method === 'email' ? 'on' : ''}`} onClick={() => setMethod('email')}>Email a setup link</button>
            </div>
            {method === 'password' ? (
              <div className="pwRow">
                <input className="textInput mono" value={pw} onChange={e => setPw(e.target.value)} />
                <button className="miniBtn" type="button" onClick={() => setPw(genPw())}><Icon name="refresh" size={11} /> Generate</button>
              </div>
            ) : (
              <div className="roleHint"><Icon name="mail" size={11} /> {firstName} receives an email to set their own password before first sign-in.</div>
            )}
            {method === 'password' && <div className="roleHint">User will be prompted to change this on first sign-in.</div>}
          </div>

          <div className="panelSection">
            <div className="psHead">Primary scope &amp; role</div>
            <ScopeEditor scopeType={scopeType} setScopeType={setScopeType} target={target} setTarget={setTarget} roleId={roleId} setRoleId={setRoleId} roles={roles} scopeTargets={scopeTargets} />
            <div className="roleHint"><Icon name="lock" size={11} /> {role.desc}</div>
          </div>

          <div className="panelSection">
            <div className="psHead">Secondary scopes
              <button className="miniBtn" onClick={() => setAddingSec(true)}><Icon name="plus" size={11} strokeWidth={2} /> Add</button>
            </div>
            {secondary.length === 0 && !addingSec && <div className="emptyHint">Optional — e.g. read-only access to another country or branch.</div>}
            {secondary.map((s, i) => (
              <div className="scopeCard" key={i} style={{ marginBottom: 6 }}>
                <div className="scopeCardL">
                  <span className="scopeBadge ro">{SCOPE_TYPE_LABEL[s.scopeType] || 'Read-only'}</span>
                  <div><div className="scopeName">{s.scope}</div><div className="scopeRole">Role · <strong>{s.role}</strong></div></div>
                </div>
                <button className="miniBtn" onClick={() => setSecondary(arr => arr.filter((_, j) => j !== i))}>Remove</button>
              </div>
            ))}
            {addingSec && (
              <div className="addScopeRow">
                <select className="textInput" id="secScope" defaultValue={ALL_COUNTRIES[1]}>
                  {[...ALL_COUNTRIES, ...ALL_COMPANIES].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select className="textInput" id="secRole" defaultValue="Sales manager — read only">
                  <option>Sales manager — read only</option><option>Sales rep</option><option>Ops coordinator</option><option>Finance manager</option><option>Read-only group viewer</option>
                </select>
                <button className="cta" onClick={() => { setSecondary(a => [...a, { scope: document.getElementById('secScope').value, role: document.getElementById('secRole').value, scopeType: 'company' }]); setAddingSec(false); }}>Add</button>
                <button className="cta ghost" onClick={() => setAddingSec(false)}>Cancel</button>
              </div>
            )}
          </div>

          {/* live effective permissions */}
          <div className="panelSection">
            <div className="psHead">Effective permissions <span className="psHint">live · most-restrictive wins</span></div>
            <div className="effGrid">
              <div className="effCol can">
                <div className="effHead"><Icon name="check" size={13} strokeWidth={2} /> {firstName} will be able to</div>
                {summary.can.map((c, i) => <div className="effItem" key={i}>{c}</div>)}
                {secondary.map((s, i) => <div className="effItem" key={'s' + i}>Read access in {s.scope} ({s.role})</div>)}
              </div>
              <div className="effCol cannot">
                <div className="effHead"><Icon name="lock" size={12} /> {firstName} will not be able to</div>
                {summary.cannot.map((c, i) => <div className="effItem" key={i}>{c}</div>)}
              </div>
            </div>
          </div>
        </div>
        <div className="sidePanelFoot">
          <button className="cta ghost" onClick={onClose}>Cancel</button>
          <button className="cta" disabled={!valid} onClick={create}>
            <Icon name="user" size={12} strokeWidth={2} /> Create user
          </button>
        </div>
      </div>
    </div>
  );
};

export const UsersView = ({ onPreviewAs }) => {
  const [users, setUsers] = React.useState([]);
  const [roles, setRoles] = React.useState([]);
  const [scopeTargets, setScopeTargets] = React.useState(null);
  const [openUser, setOpenUser] = React.useState(null);
  const [q, setQ] = React.useState('');
  const [scopeFilter, setScopeFilter] = React.useState('all');
  const [creating, setCreating] = React.useState(false);
  const [importing, setImporting] = React.useState(false);
  const [csvText, setCsvText] = React.useState('name,email,roleId\nJane Doe,j.doe@group.eu,sales-rep');
  const [importMsg, setImportMsg] = React.useState(null);
  const [flashId, setFlashId] = React.useState(null);

  // Load users from the API (fallback to seed import on failure).
  React.useEffect(() => {
    let cancelled = false;
    // The tenant's real users always win — even an empty list — so no demo user shows.
    api.get('/admin/users').then((rows) => {
      if (cancelled || !Array.isArray(rows)) return;
      setUsers(rows.map(adaptUser));
    }).catch(() => { /* leave empty on network error */ });
    // Real tenant roles for the create form's role picker (namespaced per tenant,
    // e.g. `<slug>-sales-rep`). Without this the picker offers literal demo ids
    // that don't exist in a provisioned tenant, so the create would FK-fail.
    api.get('/admin/roles').then((rows) => {
      if (cancelled || !Array.isArray(rows)) return;
      setRoles(rows.map((r) => ({ id: r.id, name: r.name, system: r.system })));
    }).catch(() => { /* fall back to demo ROLES in the picker */ });
    // Real org structure → scope-target options (companies/countries/regions),
    // so the scope picker shows THIS tenant's places, not the demo's Benelux.
    api.get('/admin/structure').then((root) => {
      if (cancelled || !root) return;
      setScopeTargets(buildScopeTargets(root));
    }).catch(() => { /* fall back to generic scope targets */ });
    return () => { cancelled = true; };
  }, []);

  if (openUser) {
    return <UserDetail user={openUser} onBack={() => setOpenUser(null)} onPreviewAs={onPreviewAs} />;
  }

  const handleCreate = async (u) => {
    setCreating(false);
    try {
      const created = await api.post('/admin/users', {
        name: u.name,
        email: u.email,
        initials: u.initials,
        password: u.password,
        roleId: u.roleId,
        scopeType: u.scopeType,
        scopeLabel: u.scopeLabel,
        status: u.status,
      });
      const adapted = { ...adaptUser(created), secondary: u.secondary, summary: u.summary, lastSeen: u.lastSeen };
      setUsers(prev => [adapted, ...prev.filter(p => p.id !== adapted.id)]);
      setFlashId(adapted.id);
    } catch (e) {
      // Surface the real failure instead of faking success with an optimistic
      // insert — a wrong role id or hit plan limit must not look like it worked.
      console.error('Failed to create user', e);
      window.alert(e?.message || 'Could not create user.');
      return;
    }
    setTimeout(() => setFlashId(null), 2600);
  };

  const runImport = async () => {
    setImportMsg(null);
    try {
      const res = await api.post('/admin/users/import', { csv: csvText });
      const rows = await api.get('/admin/users');
      if (Array.isArray(rows)) setUsers(rows.map(adaptUser));
      setImportMsg(`Imported ${res.created} user(s)${res.errors?.length ? ` · ${res.errors.length} error(s)` : ''}.`);
    } catch (e) {
      setImportMsg(e?.message || 'Import failed');
    }
  };

  const filtered = users.filter(u => {
    if (scopeFilter !== 'all' && u.scopeType !== scopeFilter) return false;
    if (q && !`${u.name} ${u.email} ${u.role} ${u.scopeLabel}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="viewWrap" style={{ maxWidth: 1100 }}>
      <div className="viewHero">
        <div>
          <h1>Users</h1>
          <div className="sub">Everyone with a login. Each user belongs to the group and is granted one primary scope plus optional secondary scopes — inviting, scoping and role assignment all happen on one page.</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="cta ghost" onClick={() => { setImporting(true); setImportMsg(null); }}><Icon name="download" size={12} strokeWidth={2} /> Bulk import (CSV)</button>
          <button className="cta" onClick={() => setCreating(true)}><Icon name="plus" size={12} strokeWidth={2} /> Create user</button>
        </div>
      </div>

      <div className="viewStats">
        <div className="viewStat good"><div className="l">Active</div><div className="v">{users.filter(u => u.status === 'active').length}</div><div className="s">logged in last 30 days</div></div>
        <div className="viewStat warn"><div className="l">Invited</div><div className="v">{users.filter(u => u.status === 'invited').length}</div><div className="s">awaiting first login</div></div>
        <div className="viewStat"><div className="l">Group-scope</div><div className="v">{users.filter(u => u.scopeType === 'group').length}</div><div className="s">CEO · finance · IT</div></div>
        <div className="viewStat"><div className="l">Cross-company</div><div className="v">{users.filter(u => u.scopeType === 'multi_company' || u.secondary.length).length}</div><div className="s">multi-company or secondary scope</div></div>
      </div>

      <div className="filterBar">
        <div className="searchInline">
          <Icon name="search" size={13} />
          <input placeholder="Search name, email, role…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <div style={{ width: 1, height: 20, background: 'var(--border)' }} />
        {[['all', 'All scopes'], ['group', 'Group'], ['region', 'Region'], ['company', 'Company'], ['multi_company', 'Multi-company']].map(([id, label]) => (
          <button key={id} className={`filterChip ${scopeFilter === id ? 'active' : ''}`} onClick={() => setScopeFilter(id)}>{label}</button>
        ))}
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>{filtered.length} users</span>
      </div>

      <div className="userTable">
        <div className="userTableHead">
          <span>User</span><span>Primary scope</span><span>Role</span><span>Last seen</span><span>Status</span><span></span>
        </div>
        {filtered.map(u => (
          <div className={`userRow ${flashId === u.id ? 'flash' : ''}`} key={u.id} onClick={() => setOpenUser(u)}>
            <div className="userCell">
              <span className="userAvatar">{u.initials}</span>
              <div>
                <div className="urName">{u.name}</div>
                <div className="urEmail">{u.email}</div>
              </div>
            </div>
            <div className="userScope">
              <span className="scopeBadge sm">{SCOPE_TYPE_LABEL[u.scopeType]}</span>
              <span>{u.scopeLabel}</span>
              {u.secondary.length > 0 && <span className="secTag">+{u.secondary.length}</span>}
            </div>
            <div className="urRole">{u.role}</div>
            <div className="urSeen">{u.lastSeen}</div>
            <div><span className={`statusPill ${statusPillClass[u.status]}`}><span className="d" /> {statusLabel[u.status]}</span></div>
            <div className="urChevron"><Icon name="chevronRight" size={14} /></div>
          </div>
        ))}
      </div>

      {creating && <CreateUserPanel onClose={() => setCreating(false)} onCreate={handleCreate} roles={roles} scopeTargets={scopeTargets} />}

      {importing && (
        <div className="overlay" onClick={() => setImporting(false)}>
          <div className="sidePanel" onClick={e => e.stopPropagation()}>
            <div className="sidePanelHead">
              <div><h2>Bulk import users</h2>
                <div className="sub">Paste CSV. Header row required: <code>name,email,roleId</code> (optional: scopeType, scopeLabel, status). Default password is <code>demo1234</code>.</div></div>
              <button className="iconBtn" onClick={() => setImporting(false)}><Icon name="close" size={16} /></button>
            </div>
            <div className="sidePanelBody">
              <textarea className="textInput" rows={8} value={csvText} onChange={e => setCsvText(e.target.value)}
                        style={{ width: '100%', fontFamily: 'monospace', resize: 'vertical' }} />
              {importMsg && <div className="prefillNote" style={{ marginTop: 10 }}><Icon name="check" size={13} /> {importMsg}</div>}
            </div>
            <div className="sidePanelFoot">
              <button className="cta ghost" onClick={() => setImporting(false)}>Close</button>
              <button className="cta" onClick={runImport}><Icon name="download" size={12} strokeWidth={2} /> Import</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
