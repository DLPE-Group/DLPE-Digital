import React from 'react';
import { Icon } from './icons.jsx';
import { COUNTRY_DEFAULTS } from './admin_data.js';
import { api } from './api/client.js';
import { SimBadge } from './primitives.jsx';

/* Normalize a server OrgNode tree (uppercase enum kind) to the lowercase
   shape the UI expects, recursively. */
function normalizeTree(node) {
  if (!node) return node;
  return {
    ...node,
    kind: String(node.kind || '').toLowerCase(),
    children: (node.children || []).map(normalizeTree),
  };
}

/* ============================================================
   GROUP STRUCTURE — multi-company / multi-country tree with
   cascading, overridable settings.  (Spec §1)
   ============================================================ */

const KIND_LABEL = { group: 'Group', region: 'Region', country: 'Country', company: 'Company' };

/* Walk the tree to find a node and the chain of ancestors (root → node). */
function findPath(node, id, trail = []) {
  const here = [...trail, node];
  if (node.id === id) return here;
  for (const c of (node.children || [])) {
    const r = findPath(c, id, here);
    if (r) return r;
  }
  return null;
}

/* Resolve a setting key by walking up the path; returns
   { value, sourceName, sourceId, inherited, overridden }. */
function resolveSetting(path, key) {
  // own value on the selected node?
  const self = path[path.length - 1];
  const ownExplicit = (self.settings && key in self.settings) || (self.overrides && key in self.overrides);
  const ownVal = (self.overrides && self.overrides[key]) ?? (self.settings && self.settings[key]);

  // find nearest ancestor (excluding self) that defines it
  let inheritedFrom = null, inheritedVal;
  for (let i = path.length - 2; i >= 0; i--) {
    const n = path[i];
    const v = (n.settings && n.settings[key]) ?? (n.overrides && n.overrides[key]);
    if (v != null) { inheritedFrom = n; inheritedVal = v; break; }
  }

  if (ownExplicit && ownVal != null) {
    return { value: ownVal, inherited: false, overridden: !!inheritedFrom,
             sourceName: inheritedFrom ? inheritedFrom.name : null };
  }
  if (inheritedFrom) {
    return { value: inheritedVal, inherited: true, overridden: false, sourceName: inheritedFrom.name };
  }
  return { value: null, inherited: false, overridden: false, sourceName: null };
}

const TreeNode = ({ node, depth, selectedId, onSelect, expanded, toggle, onAdd }) => {
  const hasChildren = node.children && node.children.length > 0;
  const isOpen = expanded[node.id] !== false; // default open
  const canAdd = node.kind === 'country' || node.kind === 'region' || node.kind === 'group';
  return (
    <>
      <div className={`treeNode ${selectedId === node.id ? 'sel' : ''}`}
           style={{ paddingLeft: 8 + depth * 16 }}
           onClick={() => onSelect(node.id)}>
        <button className="treeCaret" onClick={(e) => { e.stopPropagation(); if (hasChildren) toggle(node.id); }}
                style={{ visibility: hasChildren ? 'visible' : 'hidden' }}>
          <Icon name="chevron" size={12} className={isOpen ? '' : 'rot'} />
        </button>
        <span className={`treeDot k-${node.kind}`} />
        <span className="treeName">{node.name}</span>
        <span className="treeCode">{node.code}</span>
        {canAdd && (
          <button className="treeAdd" title={`Add under ${node.name}`}
                  onClick={(e) => { e.stopPropagation(); onAdd(node); }}>
            <Icon name="plus" size={11} strokeWidth={2} />
          </button>
        )}
      </div>
      {hasChildren && isOpen && node.children.map(c => (
        <TreeNode key={c.id} node={c} depth={depth + 1} selectedId={selectedId}
                  onSelect={onSelect} expanded={expanded} toggle={toggle} onAdd={onAdd} />
      ))}
    </>
  );
};

const SettingRow = ({ label, resolved, parentKindLabel }) => {
  if (!resolved || resolved.value == null) {
    return (
      <div className="setRow">
        <div className="setLabel">{label}</div>
        <div className="setVal empty">— not set —</div>
      </div>
    );
  }
  return (
    <div className="setRow">
      <div className="setLabel">{label}</div>
      <div className={`setVal ${resolved.inherited ? 'inherited' : ''}`}>
        <span className="setValText">{resolved.value}</span>
        {resolved.inherited ? (
          <span className="inheritTag"><Icon name="arrow" size={10} className="up" /> inherited from {resolved.sourceName}</span>
        ) : resolved.overridden ? (
          <span className="overrideTag">overrides {resolved.sourceName} · <button className="revertLink">↩ revert</button></span>
        ) : (
          <span className="setHereTag">set here</span>
        )}
      </div>
    </div>
  );
};

/* Editable variant — when an override is staged in the draft it shows an input;
   otherwise it shows the resolved (inherited/own) value with an "override" action. */
const EditableSettingRow = ({ label, settingKey, resolved, draftValue, onEdit, onRevert }) => {
  const editing = draftValue !== undefined;
  return (
    <div className="setRow">
      <div className="setLabel">{label}</div>
      {editing ? (
        <div className="setVal">
          <input className="textInput" style={{ maxWidth: 220 }} value={draftValue}
                 autoFocus onChange={e => onEdit(settingKey, e.target.value)} />
          <span className="overrideTag">override · <button className="revertLink" onClick={() => onRevert(settingKey)}>↩ revert</button></span>
        </div>
      ) : (
        <div className={`setVal ${resolved.inherited ? 'inherited' : ''}`}>
          <span className="setValText">{resolved.value ?? '— not set —'}</span>
          {resolved.inherited ? (
            <span className="inheritTag"><Icon name="arrow" size={10} className="up" /> inherited from {resolved.sourceName} · <button className="revertLink" onClick={() => onEdit(settingKey, resolved.value ?? '')}>override</button></span>
          ) : resolved.overridden ? (
            <span className="overrideTag">overrides {resolved.sourceName} · <button className="revertLink" onClick={() => onRevert(settingKey)}>↩ revert</button></span>
          ) : (
            <span className="setHereTag">set here · <button className="revertLink" onClick={() => onEdit(settingKey, resolved.value ?? '')}>edit</button></span>
          )}
        </div>
      )}
    </div>
  );
};

const AddCompanyPanel = ({ country, childKind = 'company', onClose, onSave }) => {
  const def = COUNTRY_DEFAULTS[country.code] || {};
  const [name, setName] = React.useState('');
  const [entity, setEntity] = React.useState('');
  const kindCap = childKind.charAt(0).toUpperCase() + childKind.slice(1);
  const isCompany = childKind === 'company';
  return (
    <div className="overlay" onClick={onClose}>
      <div className="sidePanel" onClick={e => e.stopPropagation()}>
        <div className="sidePanelHead">
          <div>
            <h2>Add {childKind}</h2>
            <div className="sub">Under {country.name} ({country.code}){isCompany ? ' · regulatory settings pre-fill from the country' : ''}</div>
          </div>
          <button className="iconBtn" onClick={onClose}><Icon name="close" size={16} /></button>
        </div>
        <div className="sidePanelBody">
          <label className="fieldBlock">
            <span className="fl">{kindCap} name</span>
            <input className="textInput" autoFocus value={name} onChange={e => setName(e.target.value)} placeholder={isCompany ? 'e.g. Ghent Branch' : `e.g. new ${childKind}`} />
          </label>
          {isCompany && <label className="fieldBlock">
            <span className="fl">Legal entity number</span>
            <input className="textInput" value={entity} onChange={e => setEntity(e.target.value)} placeholder="BCE / KvK / HRB number" />
          </label>}
          {isCompany && (<>
            <div className="prefillNote">
              <Icon name="check" size={13} /> Pre-filled from {country.name} — change only if this branch differs.
            </div>
            <div className="prefillGrid">
              <div><div className="k">VAT</div><div className="v">{def.vat}</div></div>
              <div><div className="k">Currency</div><div className="v">{def.currency}</div></div>
              <div style={{ gridColumn: 'span 2' }}><div className="k">PEPPOL profile</div><div className="v">{def.peppol}</div></div>
              <div style={{ gridColumn: 'span 2' }}><div className="k">Languages</div><div className="v">{def.languages}</div></div>
            </div>
          </>)}
        </div>
        <div className="sidePanelFoot">
          <button className="cta ghost" onClick={onClose}>Cancel</button>
          <button className="cta" disabled={!name.trim()} onClick={() => onSave(name.trim())}>
            <Icon name="plus" size={12} strokeWidth={2} /> Add {childKind}
          </button>
        </div>
      </div>
    </div>
  );
};

export const GroupStructureView = () => {
  // Tenant's real org tree / data-sharing / user count — never the demo fixtures.
  const [tree, setTree] = React.useState(null);
  const [selectedId, setSelectedId] = React.useState(null);
  const [expanded, setExpanded] = React.useState({});
  const [query, setQuery] = React.useState('');
  const [addUnder, setAddUnder] = React.useState(null);
  const [sharingRows, setSharingRows] = React.useState([]);
  const [sharing, setSharing] = React.useState({});
  const [userCount, setUserCount] = React.useState(null);
  const [renaming, setRenaming] = React.useState(false);
  const [draft, setDraft] = React.useState({ name: '', overrides: {} });
  const [savingStruct, setSavingStruct] = React.useState(false);

  // Load the org tree + data-sharing + user count from the API.
  React.useEffect(() => {
    let cancelled = false;
    api.get('/admin/structure').then((root) => {
      if (cancelled || !root) return;
      const t = normalizeTree(root);
      setTree(t);
      setSelectedId((cur) => cur || t.id);   // select the root by default
    }).catch(() => { /* leave empty on network error */ });
    api.get('/admin/data-sharing').then((rows) => {
      if (cancelled || !Array.isArray(rows)) return;
      setSharingRows(rows);
      setSharing(Object.fromEntries(rows.map(d => [d.type, d.mode])));
    }).catch(() => { /* leave empty on network error */ });
    api.get('/admin/users').then((rows) => {
      if (cancelled || !Array.isArray(rows)) return;
      setUserCount(rows.length);
    }).catch(() => { /* leave unknown on network error */ });
    return () => { cancelled = true; };
  }, []);

  const toggle = (id) => setExpanded(e => ({ ...e, [id]: e[id] === false ? true : false }));
  // Null-safe until the tree loads (an early return below renders a loading state).
  const path = tree ? (findPath(tree, selectedId) || [tree]) : [];
  const node = path[path.length - 1] || { id: null, name: '', overrides: {}, children: [] };
  const parent = path.length > 1 ? path[path.length - 2] : null;

  const counts = React.useMemo(() => {
    let countries = 0, companies = 0, regions = 0;
    const walk = n => { if (!n) return; if (n.kind === 'country') countries++; if (n.kind === 'company') companies++; if (n.kind === 'region') regions++; (n.children || []).forEach(walk); };
    walk(tree);
    return { countries, companies, regions };
  }, [tree]);

  // Add a child node of the appropriate kind under the selected parent:
  // group → region, region → country, country → company.
  const childKindOf = (parentKind) =>
    parentKind === 'group' ? 'region' : parentKind === 'region' ? 'country' : 'company';

  const addNodeUnder = async (name) => {
    const par = addUnder;
    const childKind = childKindOf(par.kind);
    let created = null;
    try {
      if (childKind === 'company') {
        const code = (par.code || par.name).slice(0, 6) + '-' + name.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase();
        const row = await api.post('/admin/structure/' + par.id + '/companies', {
          name, code,
          meta: { entity: 'New entity · pending registration', address: '—' },
          overrides: { invoiceSeq: code + '-2026-####' },
        });
        created = { ...row, kind: 'company', children: [] };
      } else {
        const row = await api.post('/admin/structure/' + par.id + '/nodes', { kind: childKind.toUpperCase(), name });
        created = { ...row, kind: childKind, children: [] };
      }
    } catch (e) {
      window.alert(e.message || `Failed to add ${childKind}`);
      return;
    }
    const clone = JSON.parse(JSON.stringify(tree));
    const p = findPath(clone, par.id);
    p[p.length - 1].children = [...(p[p.length - 1].children || []), created];
    setTree(clone);
    setAddUnder(null);
    setSelectedId(created.id);
  };

  // Delete the selected node (server enforces: no children / entities / scopes).
  const deleteSelectedNode = async () => {
    if (node.kind === 'group') return;
    if (!window.confirm(`Delete ${node.kind} "${node.name}"? This cannot be undone.`)) return;
    try {
      await api.del('/admin/structure/' + node.id);
      const clone = JSON.parse(JSON.stringify(tree));
      const par = parent ? findPath(clone, parent.id) : null;
      if (par) {
        const pn = par[par.length - 1];
        pn.children = (pn.children || []).filter((c) => c.id !== node.id);
      }
      setTree(clone);
      setSelectedId(parent ? parent.id : tree.id);
    } catch (e) { window.alert(e.message || 'Could not delete node'); }
  };

  // Persist a data-sharing mode change via PUT (most-restrictive set of rows).
  const setSharingMode = (type, mode) => {
    setSharing(prev => {
      const next = { ...prev, [type]: mode };
      const rows = sharingRows.map(d => ({ type: d.type, mode: next[d.type] ?? d.mode, note: d.note || '' }));
      api.put('/admin/data-sharing', { rows }).catch(e => console.error('Failed to save data-sharing', e));
      return next;
    });
  };

  // Reset the edit draft whenever the selected node changes.
  React.useEffect(() => {
    setDraft({ name: node.name, overrides: { ...(node.overrides || {}) } });
    setRenaming(false);
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty =
    draft.name !== node.name ||
    JSON.stringify(draft.overrides || {}) !== JSON.stringify(node.overrides || {});

  // Until the tenant's org tree loads, show a neutral placeholder — never the demo tree.
  if (!tree) {
    return <div className="view"><div className="emptyHint" style={{ margin: 24 }}>Loading organisation structure…</div></div>;
  }

  const patchNodeInTree = (id, patch) => {
    setTree(prev => {
      const clone = JSON.parse(JSON.stringify(prev));
      const p = findPath(clone, id);
      if (p) Object.assign(p[p.length - 1], patch);
      return clone;
    });
  };

  const editOverride = (key, value) =>
    setDraft(d => ({ ...d, overrides: { ...d.overrides, [key]: value } }));
  const revertOverride = (key) =>
    setDraft(d => { const o = { ...d.overrides }; delete o[key]; return { ...d, overrides: o }; });

  const saveStructChanges = async () => {
    setSavingStruct(true);
    const body = { name: draft.name, overrides: draft.overrides };
    try {
      const row = await api.patch('/admin/structure/' + node.id, body);
      patchNodeInTree(node.id, {
        name: row?.name ?? draft.name,
        overrides: row?.overrides ?? draft.overrides,
      });
    } catch (e) {
      console.error('Failed to save node', e);
      // optimistic local apply so the UI still reflects the edit
      patchNodeInTree(node.id, { name: draft.name, overrides: draft.overrides });
    }
    setSavingStruct(false);
  };

  // Resolved setting, accounting for any staged draft override on the selected node.
  const r = (key) => {
    if (draft.overrides && key in draft.overrides) {
      return { value: draft.overrides[key], inherited: false, overridden: false, sourceName: null };
    }
    return resolveSetting(path, key);
  };
  const dv = (key) => (draft.overrides && key in draft.overrides ? draft.overrides[key] : undefined);

  return (
    <div className="viewWrap" style={{ maxWidth: 1240 }}>
      <div className="viewHero">
        <div>
          <h1>Group structure</h1>
          <div className="sub">The organizational tree — group, regions, countries and companies. Settings cascade down each level; any level can override the one above. Inherited values appear greyed.</div>
        </div>
        <button className="cta ghost" onClick={() => {
          const url = URL.createObjectURL(new Blob([JSON.stringify(tree, null, 2)], { type: 'application/json' }));
          const a = document.createElement('a'); a.href = url; a.download = 'org-structure.json'; a.click(); URL.revokeObjectURL(url);
        }}><Icon name="download" size={12} strokeWidth={2} /> Export structure</button>
      </div>

      <div className="viewStats" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
        <div className="viewStat"><div className="l">Countries</div><div className="v">{counts.countries}</div><div className="s">NL · BE · LU · DE</div></div>
        <div className="viewStat"><div className="l">Companies</div><div className="v">{counts.companies}</div><div className="s">legal entities / branches</div></div>
        <div className="viewStat"><div className="l">Regions</div><div className="v">{counts.regions}</div><div className="s">Benelux + DE direct</div></div>
        <div className="viewStat good"><div className="l">Users</div><div className="v">{userCount ?? '—'}</div><div className="s">across all scopes</div></div>
      </div>

      <div className="structLayout">
        {/* ---- Tree ---- */}
        <div className="structTree">
          <div className="treeSearch">
            <Icon name="search" size={13} />
            <input placeholder="Filter companies…" value={query} onChange={e => setQuery(e.target.value)} />
          </div>
          <div className="treeScroll">
            <TreeNode node={tree} depth={0} selectedId={selectedId} onSelect={setSelectedId}
                      expanded={expanded} toggle={toggle} onAdd={(n) => setAddUnder(n)} />
          </div>
          <div className="treeLegend">
            <span><span className="treeDot k-group" /> Group</span>
            <span><span className="treeDot k-region" /> Region</span>
            <span><span className="treeDot k-country" /> Country</span>
            <span><span className="treeDot k-company" /> Company</span>
          </div>
        </div>

        {/* ---- Settings panel ---- */}
        <div className="structPanel">
          <div className="structPanelHead">
            <div>
              <div className="sphKind">{KIND_LABEL[node.kind]}{parent ? ` · in ${parent.name}` : ''}</div>
              {renaming ? (
                <h2>
                  <input className="textInput" style={{ maxWidth: 320, fontSize: '1em' }} autoFocus
                         value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
                         onKeyDown={e => { if (e.key === 'Enter') setRenaming(false); }} />
                  {' '}<span className="sphCode">{node.code}</span>
                </h2>
              ) : (
                <h2>{draft.name || node.name} <span className="sphCode">{node.code}</span></h2>
              )}
            </div>
            <div className="sphActions">
              {node.kind === 'company' && <span className="statusPill ok"><span className="d" /> Active</span>}
              <button className="miniBtn" onClick={() => setRenaming(v => !v)}>
                <Icon name="settings" size={11} /> {renaming ? 'Done' : 'Rename'}
              </button>
              {node.kind !== 'group' && (
                <button className="miniBtn" onClick={deleteSelectedNode} style={{ color: 'var(--status-red, #e05)' }}>
                  <Icon name="close" size={11} /> Delete
                </button>
              )}
            </div>
          </div>

          {/* General */}
          <div className="setGroup">
            <div className="setGroupHead">General</div>
            <div className="setRow"><div className="setLabel">Name</div><div className="setVal"><span className="setValText">{node.name}</span><span className="setHereTag">set here</span></div></div>
            <div className="setRow"><div className="setLabel">Code</div><div className="setVal"><span className="setValText">{node.code}</span><span className="setHereTag">set here</span></div></div>
            {node.meta?.entity && <div className="setRow"><div className="setLabel">Legal entity</div><div className="setVal"><span className="setValText">{node.meta.entity}</span></div></div>}
            {node.meta?.address && <div className="setRow"><div className="setLabel">Address</div><div className="setVal"><span className="setValText">{node.meta.address}</span></div></div>}
            {node.meta?.manager && <div className="setRow"><div className="setLabel">Regional manager</div><div className="setVal"><span className="setValText">{node.meta.manager}</span></div></div>}
          </div>

          {/* Regulatory */}
          <div className="setGroup">
            <div className="setGroupHead">Regulatory</div>
            <EditableSettingRow label="VAT rate(s)" settingKey="vat" resolved={r('vat')} draftValue={dv('vat')} onEdit={editOverride} onRevert={revertOverride} />
            <EditableSettingRow label="Currency" settingKey="currency" resolved={r('currency')} draftValue={dv('currency')} onEdit={editOverride} onRevert={revertOverride} />
            <EditableSettingRow label="PEPPOL profile" settingKey="peppol" resolved={r('peppol')} draftValue={dv('peppol')} onEdit={editOverride} onRevert={revertOverride} />
            <EditableSettingRow label="Language(s)" settingKey="languages" resolved={r('languages')} draftValue={dv('languages')} onEdit={editOverride} onRevert={revertOverride} />
            <EditableSettingRow label="Fiscal year start" settingKey="fiscalYear" resolved={r('fiscalYear')} draftValue={dv('fiscalYear')} onEdit={editOverride} onRevert={revertOverride} />
            {node.kind === 'company' && <EditableSettingRow label="Invoice number sequence" settingKey="invoiceSeq" resolved={r('invoiceSeq')} draftValue={dv('invoiceSeq')} onEdit={editOverride} onRevert={revertOverride} />}
          </div>

          {/* Operational */}
          <div className="setGroup">
            <div className="setGroupHead">Operational</div>
            <EditableSettingRow label="Service interval" settingKey="serviceInterval" resolved={r('serviceInterval')} draftValue={dv('serviceInterval')} onEdit={editOverride} onRevert={revertOverride} />
            <EditableSettingRow label="Working hours" settingKey="workingHours" resolved={r('workingHours')} draftValue={dv('workingHours')} onEdit={editOverride} onRevert={revertOverride} />
          </div>

          {/* Data sharing — only meaningful at group/country */}
          {(node.kind === 'group' || node.kind === 'country' || node.kind === 'region') && (
            <div className="setGroup">
              <div className="setGroupHead">Data sharing <SimBadge label="Advisory" title="These modes are saved, but cross-company sharing is not yet enforced at runtime — row-level access is governed by user scope (see Users)." />
                <span className="setGroupHint">defaults for {node.name}’s companies · saved, not yet runtime-enforced</span>
              </div>
              {sharingRows.map(d => (
                <div className="shareRow" key={d.type}>
                  <div className="shareMain">
                    <div className="shareType">{d.type}</div>
                    <div className="shareNote">{d.note}</div>
                  </div>
                  <div className="shareSeg">
                    {['private', 'shared', 'group'].map(m => {
                      const disabled = d.mode === 'group'; // user accounts fixed
                      const on = sharing[d.type] === m;
                      const labels = { private: 'Company-private', shared: 'Shared in group', group: 'Group-level' };
                      if (m === 'group' && d.mode !== 'group') return null;
                      if (m !== 'group' && d.mode === 'group') return null;
                      return (
                        <button key={m} className={`segBtn ${on ? 'on' : ''}`} disabled={disabled}
                                onClick={() => !disabled && setSharingMode(d.type, m)}>
                          {labels[m]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="structFoot">
            <span className="muted">Inherited settings are greyed. Override any field, then ↩ revert to fall back to the parent.</span>
            <button className="cta" disabled={!dirty || savingStruct} onClick={saveStructChanges}>
              <Icon name="check" size={12} strokeWidth={2} /> {savingStruct ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
            </button>
          </div>
        </div>
      </div>

      {addUnder && <AddCompanyPanel country={addUnder} childKind={childKindOf(addUnder.kind)} onClose={() => setAddUnder(null)} onSave={addNodeUnder} />}
    </div>
  );
};
