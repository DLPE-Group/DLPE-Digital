import React from 'react';
import { Icon } from './icons.jsx';
import { useT } from './i18n.jsx';
import { TrackTag } from './primitives.jsx';
import { api } from './api/client.js';

/* ============================================================
   StageConfigEditor — drag-reorder, rename, edit SLA + lock,
   add / remove stages, per track. Local state (demo).
   CrossTrackTriggerEditor — visual when→then builder.
   ============================================================ */

export const STAGE_CONFIG = {
  sales: [
    { id: 'lead',     label: 'Lead',                  sla: 5,  lock: null,       cta: 'Qualify' },
    { id: 'meeting',  label: 'Qualification meeting', sla: 10, lock: 'lead',     cta: 'Send offer' },
    { id: 'offer',    label: 'Offer sent',            sla: 14, lock: 'meeting',  cta: 'Send follow-up' },
    { id: 'contract', label: 'Contract drafted',      sla: 10, lock: 'offer',    cta: 'Mark contract signed' },
    { id: 'signed',   label: 'Signed',                sla: 1,  lock: 'contract', cta: 'Open in CRM' },
    { id: 'ordered',  label: 'Vehicle ordered',       sla: 0,  lock: 'signed',   cta: 'Hand off to operations' },
  ],
  operations: [
    { id: 'ordered',     label: 'Vehicle ordered',     sla: 90, lock: null,       cta: 'Confirm with supplier' },
    { id: 'expected',    label: 'Expected delivery',   sla: 7,  lock: 'ordered',  cta: 'Chase supplier' },
    { id: 'confirmed',   label: 'Delivery confirmed',  sla: 3,  lock: 'expected', cta: 'Notify operator' },
    { id: 'in_fleet',    label: 'In fleet',            sla: 0,  lock: 'confirmed', cta: 'Activate' },
    { id: 'service_due', label: 'Service due 90 days', sla: 90, lock: 'in_fleet', cta: 'Plan workshop visit' },
    { id: 'replacement', label: 'Replacement out',     sla: 5,  lock: 'service_due', cta: 'Track loaner' },
    { id: 'moved',       label: 'Moved to workshop',   sla: 5,  lock: 'replacement', cta: 'View workshop order' },
    { id: 'pickup',      label: 'Ready for pickup',    sla: 1,  lock: 'moved',    cta: 'Notify fleet operator' },
  ],
  workshop: [
    { id: 'planned',    label: 'Planned',             sla: 2, lock: null,       cta: 'Create work order' },
    { id: 'order',      label: 'Order created',       sla: 1, lock: 'planned',  cta: 'Order parts' },
    { id: 'parts',      label: 'Order parts',         sla: 3, lock: 'order',    cta: 'Confirm parts arrival' },
    { id: 'arrived',    label: 'Vehicle arrived',     sla: 1, lock: 'parts',    cta: 'Begin repair' },
    { id: 'in_repair',  label: 'In repair',           sla: 5, lock: 'arrived',  cta: 'Update progress' },
    { id: 'invoice_in', label: 'PEPPOL invoice received', sla: 1, lock: 'in_repair', cta: 'Approve & route to Finance' },
    { id: 'released',   label: 'Released for pickup', sla: 1, lock: 'invoice_in', cta: 'Notify fleet operator' },
    { id: 'invoiced',   label: 'Invoiced PEPPOL',     sla: 0, lock: 'released', cta: 'Close order' },
  ],
  finance: [
    { id: 'to_make',  label: 'Invoice to create',   sla: 2,  lock: null,        cta: 'Generate invoice' },
    { id: 'awaiting', label: 'Awaiting payment',    sla: 30, lock: 'to_make',   cta: 'Send reminder' },
    { id: 'overdue',  label: 'Overdue',             sla: 14, lock: 'awaiting',  cta: 'Send dunning notice' },
    { id: 'paid',     label: 'Paid',                sla: 0,  lock: 'awaiting',  cta: 'View receipt' },
    { id: 'supplier', label: 'Supplier invoice received', sla: 5, lock: null,   cta: 'Approve for payment' },
    { id: 'approved', label: 'Approved & paid',     sla: 0,  lock: 'supplier',  cta: 'View payment' },
  ],
};

export const CROSS_TRIGGERS = [
  { whenTrack: 'sales',      whenStage: 'Contract signed',
    thenTrack: 'operations', thenStage: 'Vehicle ordered',
    note: 'Creates a new card · auto-assigned to fleet ops manager' },
  { whenTrack: 'sales',      whenStage: 'Contract signed',
    thenTrack: 'finance',    thenStage: 'Invoice to create',
    note: 'Creates a new card · auto-assigned to AR' },
  { whenTrack: 'operations', whenStage: 'Replacement out',
    thenTrack: 'workshop',   thenStage: 'Planned',
    note: 'Creates a workshop order for the original vehicle' },
  { whenTrack: 'workshop',   whenStage: 'PEPPOL invoice received',
    thenTrack: 'finance',    thenStage: 'Supplier invoice received',
    note: 'Routes the approved supplier invoice to finance for payment' },
  { whenTrack: 'workshop',   whenStage: 'Invoiced PEPPOL',
    thenTrack: 'finance',    thenStage: 'Awaiting payment',
    note: 'Outbound customer invoice opens a finance receivable' },
];

const TRACK_KEYS = ['sales', 'operations', 'workshop', 'finance'];
const TRACK_TITLE = { sales: 'Sales', operations: 'Operations', workshop: 'Workshop', finance: 'Finance' };
const trackVar = (k) => `var(--track-${k === 'operations' ? 'ops' : k})`;

let _uid = 1000;
const uid = () => 'st' + (++_uid);

/* ---------------- Stage config editor ---------------- */

// Build the local uid-tagged config shape from seed fallback.
const seedConfig = () => {
  const c = {};
  TRACK_KEYS.forEach(k => {
    c[k] = STAGE_CONFIG[k].map(s => ({ ...s, uid: uid() }));
  });
  return c;
};

export const StageConfigEditor = () => {
  const { t } = useT();
  const [trackTab, setTrackTab] = React.useState('sales');
  // deep clone seed config into editable state, give every stage a stable uid
  const [config, setConfig] = React.useState(seedConfig);
  const [dirty, setDirty] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [saveErr, setSaveErr] = React.useState(null);
  const [dragIdx, setDragIdx] = React.useState(null);
  const [overIdx, setOverIdx] = React.useState(null);

  // Load persisted stage config from the API (fallback to seed on failure).
  // Extracted so "Discard" can re-fetch the server state instead of only
  // clearing the dirty flag.
  const loadConfig = React.useCallback(() => {
    return api.get('/admin/stage-config').then((rows) => {
      if (!Array.isArray(rows) || rows.length === 0) return;
      const byTrack = {};
      rows.forEach((r) => {
        const k = String(r.track || '').toLowerCase();
        if (!TRACK_KEYS.includes(k)) return;
        (byTrack[k] = byTrack[k] || []).push({
          uid: uid(), id: r.stageId, label: r.label, sla: r.sla, lock: r.lock ?? null, cta: r.cta ?? '',
        });
      });
      setConfig((prev) => {
        const next = { ...prev };
        TRACK_KEYS.forEach((k) => { if (byTrack[k]) next[k] = byTrack[k]; });
        return next;
      });
      setDirty(false);
      setSaved(false);
    }).catch(() => { /* keep current/seed state */ });
  }, []);

  React.useEffect(() => { loadConfig(); }, [loadConfig]);

  const stages = config[trackTab];
  const setStages = (next) => {
    setConfig(c => ({ ...c, [trackTab]: typeof next === 'function' ? next(c[trackTab]) : next }));
    setDirty(true);
    setSaved(false);
  };

  const saveConfig = async () => {
    setSaving(true);
    setSaveErr(null);
    try {
      const payload = {
        stages: config[trackTab].map((s) => ({
          stageId: s.id, label: s.label, sla: s.sla ?? 0, lock: s.lock ?? null, cta: s.cta ?? '',
        })),
      };
      await api.put('/admin/stage-config/' + trackTab, payload);
      setDirty(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } catch (e) {
      // Surface the failure (e.g. "can't remove a stage that still has records")
      // instead of silently leaving the change unsaved.
      setSaveErr(e?.message || 'Could not save stage configuration.');
    } finally {
      setSaving(false);
    }
  };

  const update = (uid, patch) => setStages(prev => prev.map(s => s.uid === uid ? { ...s, ...patch } : s));
  const remove = (uid) => setStages(prev => prev.filter(s => s.uid !== uid));
  const add = () => setStages(prev => [...prev, { uid: uid(), id: 'new_' + (prev.length+1), label: 'New stage', sla: 7, lock: prev.length ? prev[prev.length-1].id : null, cta: 'Action' }]);

  const onDrop = (toIdx) => {
    if (dragIdx === null || dragIdx === toIdx) { setDragIdx(null); setOverIdx(null); return; }
    setStages(prev => {
      const next = [...prev];
      const [moved] = next.splice(dragIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
    setDragIdx(null);
    setOverIdx(null);
  };

  return (
    <div className="settingsSection">
      <div className="h">
        <h3>Stage configuration</h3>
        <div className="hint">Drag to reorder · rename inline · edit SLA &amp; lock. Changes propagate to every view.</div>
      </div>
      <div className="settingsBody">
        <div className="editorToolbar">
          <div className="editorTrackTabs">
            {TRACK_KEYS.map(k => (
              <button key={k} className={`filterChip ${trackTab === k ? 'active' : ''}`}
                      onClick={() => setTrackTab(k)}>
                <span className="swatch" style={{ background: trackVar(k) }} />
                {TRACK_TITLE[k]}
                <span style={{ marginLeft: 4, opacity: 0.7 }}>{config[k].length}</span>
              </button>
            ))}
          </div>
          <div className="editorSaveBar">
            {saveErr && <span style={{ color: 'var(--status-red, #e05)', maxWidth: 460 }}>{saveErr}</span>}
            {dirty && !saveErr && <><span className="dirtyDot" /> Unsaved changes</>}
            {saved && !dirty && <span style={{ color: 'var(--ok, #2e7d32)' }}>Saved</span>}
            <button className="cta ghost" disabled={!dirty || saving}
                    onClick={() => loadConfig()}>Discard</button>
            <button className="cta" disabled={!dirty || saving}
                    onClick={saveConfig}>
              <Icon name="check" size={12} strokeWidth={2.5} /> {saving ? 'Saving…' : 'Save config'}
            </button>
          </div>
        </div>

        <div className="editorHeadRow">
          <span></span>
          <span>Stage name</span>
          <span>SLA (days)</span>
          <span>Lock condition</span>
          <span></span>
        </div>

        <div className="stageEditorList">
          {stages.map((s, i) => (
            <div key={s.uid}
                 className={`stageEditRow ${dragIdx === i ? 'dragging' : ''} ${overIdx === i ? 'dragOver' : ''}`}
                 draggable
                 onDragStart={() => setDragIdx(i)}
                 onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
                 onDragOver={(e) => { e.preventDefault(); setOverIdx(i); }}
                 onDrop={() => onDrop(i)}>
              <span className="grip" title="Drag to reorder">
                <Icon name="filter" size={14} />
              </span>
              <input type="text" value={s.label}
                     onChange={e => update(s.uid, { label: e.target.value })} />
              <div className="slaWrap">
                <input type="number" min="0" value={s.sla}
                       onChange={e => update(s.uid, { sla: parseInt(e.target.value || '0', 10) })} />
                <span>days</span>
              </div>
              <select value={s.lock || ''}
                      onChange={e => update(s.uid, { lock: e.target.value || null })}>
                <option value="">No lock — entry stage</option>
                {stages.filter(o => o.uid !== s.uid).map(o => (
                  <option key={o.uid} value={o.id}>requires: {o.label}</option>
                ))}
              </select>
              <button className="delBtn" onClick={() => remove(s.uid)} title="Remove stage">
                <Icon name="close" size={13} strokeWidth={2} />
              </button>
            </div>
          ))}
        </div>

        <div className="editorAddRow">
          <button className="editorAddBtn" onClick={add}>
            <Icon name="plus" size={13} strokeWidth={2} /> Add stage
          </button>
        </div>
      </div>
    </div>
  );
};

/* ---------------- Cross-track trigger editor ---------------- */

export const CrossTrackTriggerEditor = () => {
  const [triggers, setTriggers] = React.useState(() =>
    CROSS_TRIGGERS.map((t, i) => ({ ...t, uid: 'tg' + i })));
  const [flashUid, setFlashUid] = React.useState(null);

  // builder state
  const [whenTrack, setWhenTrack] = React.useState('sales');
  const [whenStage, setWhenStage] = React.useState('');
  const [thenTrack, setThenTrack] = React.useState('operations');
  const [thenStage, setThenStage] = React.useState('');

  // Load persisted triggers from the API (fallback to seed on failure).
  React.useEffect(() => {
    let cancelled = false;
    api.get('/admin/triggers').then((rows) => {
      if (cancelled || !Array.isArray(rows)) return;
      setTriggers(rows.map((r) => ({ ...r, uid: r.id })));
    }).catch(() => { /* keep seed fallback */ });
    return () => { cancelled = true; };
  }, []);

  const stagesOf = (k) => STAGE_CONFIG[k] || [];

  const canAdd = whenStage && thenStage && whenTrack !== thenTrack;

  const addTrigger = async () => {
    if (!canAdd) return;
    const ws = stagesOf(whenTrack).find(s => s.id === whenStage);
    const ts = stagesOf(thenTrack).find(s => s.id === thenStage);
    const payload = {
      whenTrack, whenStage: ws.label,
      thenTrack, thenStage: ts.label,
      note: 'Creates a new card · auto-assigned to track owner',
    };
    try {
      const row = await api.post('/admin/triggers', payload);
      const newUid = row.id ?? ('tg' + Date.now());
      setTriggers(prev => [...prev, { ...row, uid: newUid }]);
      setFlashUid(newUid);
      setTimeout(() => setFlashUid(null), 1500);
      setWhenStage(''); setThenStage('');
    } catch (e) {
      console.error('Failed to add trigger', e);
    }
  };

  const removeTrigger = async (uid) => {
    const row = triggers.find(t => t.uid === uid);
    setTriggers(prev => prev.filter(t => t.uid !== uid));
    if (row && row.id) {
      try { await api.del('/admin/triggers/' + row.id); }
      catch (e) { console.error('Failed to delete trigger', e); }
    }
  };

  const editTrigger = async (tg) => {
    if (!tg.id) return;
    const note = window.prompt('Edit trigger note', tg.note || '');
    if (note == null) return;
    try {
      const row = await api.patch('/admin/triggers/' + tg.id, { note });
      setTriggers(prev => prev.map(t => t.uid === tg.uid ? { ...t, ...row, uid: t.uid } : t));
    } catch (e) { window.alert(e.message || 'Edit failed'); }
  };

  return (
    <div className="settingsSection">
      <div className="h">
        <h3>Cross-track triggers</h3>
        <div className="hint">When a stage completes in one track, automatically create a card in another. Build a rule below.</div>
      </div>
      <div className="settingsBody">
        {/* Visual builder */}
        <div className="triggerBuilder">
          <div className="tbRow">
            <div className="tbNode">
              <div className="lbl">When this completes</div>
              <select value={whenTrack} onChange={e => { setWhenTrack(e.target.value); setWhenStage(''); }}>
                {TRACK_KEYS.map(k => <option key={k} value={k}>{TRACK_TITLE[k]}</option>)}
              </select>
              <select value={whenStage} onChange={e => setWhenStage(e.target.value)}>
                <option value="">Select a stage…</option>
                {stagesOf(whenTrack).map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>

            <div className="tbArrow">
              <div className="tbArrowLine" />
            </div>

            <div className="tbNode">
              <div className="lbl">Then create a card in</div>
              <select value={thenTrack} onChange={e => { setThenTrack(e.target.value); setThenStage(''); }}>
                {TRACK_KEYS.filter(k => k !== whenTrack).map(k => <option key={k} value={k}>{TRACK_TITLE[k]}</option>)}
              </select>
              <select value={thenStage} onChange={e => setThenStage(e.target.value)}>
                <option value="">Select a stage…</option>
                {stagesOf(thenTrack).map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
          </div>
          <button className="tbAddBtn" disabled={!canAdd} onClick={addTrigger}>
            <Icon name="plus" size={13} strokeWidth={2.5} /> Add trigger
          </button>
        </div>

        {/* Existing triggers */}
        {triggers.map(tg => (
          <div key={tg.uid} className={`triggerListItem ${flashUid === tg.uid ? 'flash' : ''}`}>
            <div className="tliNode">
              <div className="nodeTrack"><TrackTag track={tg.whenTrack}>{tg.whenTrack}</TrackTag></div>
              <div className="nodeStage">{tg.whenStage}</div>
              <div className="nodeNote">stage completes</div>
            </div>
            <div className="tbConnector"><Icon name="arrow" size={16} strokeWidth={2.5} /></div>
            <div className="tliNode">
              <div className="nodeTrack"><TrackTag track={tg.thenTrack}>{tg.thenTrack}</TrackTag></div>
              <div className="nodeStage">{tg.thenStage}</div>
              <div className="nodeNote">{tg.note}</div>
            </div>
            <button className="tliDel" onClick={() => editTrigger(tg)} title="Edit note" style={{ marginRight: 4 }}>
              <Icon name="settings" size={13} strokeWidth={2} />
            </button>
            <button className="tliDel" onClick={() => removeTrigger(tg.uid)} title="Remove trigger">
              <Icon name="close" size={14} strokeWidth={2} />
            </button>
          </div>
        ))}
        {triggers.length === 0 && (
          <div className="previewEmpty">No triggers yet — build one above.</div>
        )}
      </div>
    </div>
  );
};
