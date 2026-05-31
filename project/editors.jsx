/* ============================================================
   StageConfigEditor — drag-reorder, rename, edit SLA + lock,
   add / remove stages, per track. Local state (demo).
   CrossTrackTriggerEditor — visual when→then builder.
   ============================================================ */

const TRACK_KEYS = ['sales', 'operations', 'workshop', 'finance'];
const TRACK_TITLE = { sales: 'Sales', operations: 'Operations', workshop: 'Workshop', finance: 'Finance' };
const trackVar = (k) => `var(--track-${k === 'operations' ? 'ops' : k})`;

let _uid = 1000;
const uid = () => 'st' + (++_uid);

/* ---------------- Stage config editor ---------------- */

const StageConfigEditor = () => {
  const { t } = useT();
  const [trackTab, setTrackTab] = React.useState('sales');
  // deep clone seed config into editable state, give every stage a stable uid
  const [config, setConfig] = React.useState(() => {
    const c = {};
    TRACK_KEYS.forEach(k => {
      c[k] = STAGE_CONFIG[k].map(s => ({ ...s, uid: uid() }));
    });
    return c;
  });
  const [dirty, setDirty] = React.useState(false);
  const [dragIdx, setDragIdx] = React.useState(null);
  const [overIdx, setOverIdx] = React.useState(null);

  const stages = config[trackTab];
  const setStages = (next) => {
    setConfig(c => ({ ...c, [trackTab]: typeof next === 'function' ? next(c[trackTab]) : next }));
    setDirty(true);
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
            {dirty && <><span className="dirtyDot" /> Unsaved changes</>}
            <button className="cta ghost" disabled={!dirty}
                    onClick={() => setDirty(false)}>Discard</button>
            <button className="cta" disabled={!dirty}
                    onClick={() => setDirty(false)}>
              <Icon name="check" size={12} strokeWidth={2.5} /> Save config
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

const CrossTrackTriggerEditor = () => {
  const [triggers, setTriggers] = React.useState(() =>
    CROSS_TRIGGERS.map((t, i) => ({ ...t, uid: 'tg' + i })));
  const [flashUid, setFlashUid] = React.useState(null);

  // builder state
  const [whenTrack, setWhenTrack] = React.useState('sales');
  const [whenStage, setWhenStage] = React.useState('');
  const [thenTrack, setThenTrack] = React.useState('operations');
  const [thenStage, setThenStage] = React.useState('');

  const stagesOf = (k) => STAGE_CONFIG[k] || [];

  const canAdd = whenStage && thenStage && whenTrack !== thenTrack;

  const addTrigger = () => {
    if (!canAdd) return;
    const ws = stagesOf(whenTrack).find(s => s.id === whenStage);
    const ts = stagesOf(thenTrack).find(s => s.id === thenStage);
    const newUid = 'tg' + Date.now();
    setTriggers(prev => [...prev, {
      uid: newUid,
      whenTrack, whenStage: ws.label,
      thenTrack, thenStage: ts.label,
      note: 'Creates a new card · auto-assigned to track owner',
    }]);
    setFlashUid(newUid);
    setTimeout(() => setFlashUid(null), 1500);
    setWhenStage(''); setThenStage('');
  };

  const removeTrigger = (uid) => setTriggers(prev => prev.filter(t => t.uid !== uid));

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

Object.assign(window, { StageConfigEditor, CrossTrackTriggerEditor });
