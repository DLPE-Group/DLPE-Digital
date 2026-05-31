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
const RolesView = ({ onConfigure }) => {
  const [q, setQ] = React.useState('');
  const list = ROLES.filter(r => !q || `${r.name} ${r.desc}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="viewWrap" style={{ maxWidth: 1100 }}>
      <div className="viewHero">
        <div>
          <h1>Roles &amp; permissions</h1>
          <div className="sub">Roles bundle functional access (which tracks) with field-level rules (which fields are visible, editable or masked). Start from a system template, clone it, then tune fields in the configurator.</div>
        </div>
        <button className="cta"><Icon name="plus" size={12} strokeWidth={2} /> New role</button>
      </div>

      <div className="filterBar">
        <div className="searchInline">
          <Icon name="search" size={13} />
          <input placeholder="Search roles…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>{ROLES.filter(r => r.system).length} system · {ROLES.filter(r => !r.system).length} custom</span>
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
              <button className="cta ghost sm"><Icon name="document" size={11} /> Clone</button>
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
const RbacConfigurator = ({ initialRole, onBack, onPreviewRole }) => {
  const [roleId, setRoleId] = React.useState(initialRole || 'sales-rep');
  const [dtId, setDtId] = React.useState('contract');
  const [scope, setScope] = React.useState('any');
  const [version, setVersion] = React.useState(4);
  const [dirty, setDirty] = React.useState(false);

  // Local editable rules: roleId -> dtId -> fieldId -> rule (only stores diffs)
  const [rules, setRules] = React.useState(() => JSON.parse(JSON.stringify(FIELD_RULES)));

  const role = ROLES.find(r => r.id === roleId);
  const dt = DATA_TYPES.find(d => d.id === dtId);

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

  const save = () => { setVersion(v => v + 1); setDirty(false); };

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
          <button className="cta" onClick={save} disabled={!dirty}><Icon name="check" size={12} strokeWidth={2} /> Save &amp; deploy</button>
        </div>
      </div>

      <div className="rbacLayout">
        {/* ---- Context selector ---- */}
        <aside className="rbacContext">
          <div className="ctxBlock">
            <div className="ctxLabel">Role</div>
            <select className="textInput" value={roleId} onChange={e => { setRoleId(e.target.value); }}>
              {ROLES.map(r => <option key={r.id} value={r.id}>{r.name}{r.system ? '' : ' (custom)'}</option>)}
            </select>
            <div className="ctxRoleMeta">{role.desc}</div>
          </div>

          <div className="ctxBlock">
            <div className="ctxLabel">Scope <span className="opt">optional</span></div>
            <select className="textInput" value={scope} onChange={e => setScope(e.target.value)}>
              <option value="any">Any scope (default)</option>
              <option value="nl">Netherlands only</option>
              <option value="be">Belgium only</option>
              <option value="de">Germany only</option>
              <option value="rotterdam">Rotterdam Branch only</option>
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
            {RBAC_VERSIONS.map(v => (
              <div className="vbRow" key={v.v}>
                <span className={`vbVer ${v.v === version ? 'cur' : ''}`}>v{v.v}</span>
                <div>
                  <div className="vbNote">{v.note}</div>
                  <div className="vbMeta">{v.when} · {v.actor}{v.v === version ? ' · current' : <button className="revertLink"> · revert</button>}</div>
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
                const rule = getRule(f.id);
                const val = sample[f.id];
                if (!rule.visible) {
                  return (
                    <div className="recRow hidden" key={f.id}>
                      <div className="recK">{f.label}</div>
                      <div className="recV"><span className="hiddenChip"><Icon name="lock" size={10} /> hidden</span></div>
                    </div>
                  );
                }
                return (
                  <div className="recRow" key={f.id}>
                    <div className="recK">{f.label}</div>
                    <div className="recV">
                      <span className={rule.masked ? 'maskedVal' : ''}>{rule.masked ? maskValue(f.id, val) : val}</span>
                      {!rule.editable && <Icon name="lock" size={10} className="lockMini" />}
                      {rule.masked && <span className="maskBadge">masked</span>}
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

Object.assign(window, { RolesView, RbacConfigurator });
