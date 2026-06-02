import React from 'react';
import { api } from './api/client.js';
import { Icon } from './icons.jsx';

/* Data model — no-code authoring of the data-driven meta-model (tracks +
   entity types + fields). Reads GET /admin/data-model; creates/edits via the
   /admin/data-model/* endpoints (group-admin only). */

const KIND_LABEL = { pipeline: 'Pipeline', reference: 'Reference' };
const DATA_KINDS = ['text', 'money', 'date', 'select', 'number', 'bool'];

export const DataModelView = () => {
  const [model, setModel] = React.useState(null);
  const [err, setErr] = React.useState(null);
  const [newTrack, setNewTrack] = React.useState(null); // {key,label,color} | null
  const [newType, setNewType] = React.useState(null); // {key,label,kind,trackKey} | null
  const [addFieldFor, setAddFieldFor] = React.useState(null); // typeKey | null
  const [field, setField] = React.useState({ key: '', label: '', category: '', dataKind: 'text' });

  const reload = React.useCallback(() => {
    return api.get('/admin/data-model').then(setModel).catch((e) => setErr(e.message));
  }, []);
  React.useEffect(() => { reload(); }, [reload]);

  // Run a mutation, surface errors, then refresh.
  const run = async (p) => {
    setErr(null);
    try { await p; await reload(); return true; }
    catch (e) { setErr(e.message || 'Request failed'); return false; }
  };

  const createTrack = async () => {
    if (await run(api.post('/admin/data-model/tracks', newTrack))) setNewTrack(null);
  };
  const createType = async () => {
    const body = { ...newType };
    if (body.kind !== 'pipeline') delete body.trackKey;
    if (await run(api.post('/admin/data-model/types', body))) setNewType(null);
  };
  const addField = async (typeKey) => {
    if (await run(api.post(`/admin/data-model/types/${typeKey}/fields`, field))) {
      setAddFieldFor(null); setField({ key: '', label: '', category: '', dataKind: 'text' });
    }
  };
  const deleteField = (typeKey, fieldKey) =>
    run(api.del(`/admin/data-model/types/${typeKey}/fields/${fieldKey}`));

  return (
    <>
      <div className="contextBar">
        <div>
          <h1>Data model</h1>
          <div className="pageSub">
            Tracks, entity types and fields that drive the whole system — create and edit them here, no code.
          </div>
        </div>
        <div className="right" style={{ display: 'flex', gap: 8 }}>
          <button className="cta" onClick={() => setNewTrack({ key: '', label: '', color: '' })}>
            <Icon name="bolt" size={12} /> New track
          </button>
          <button className="cta" onClick={() => setNewType({ key: '', label: '', kind: 'pipeline', trackKey: model?.tracks?.[0]?.key || '' })}>
            <Icon name="document" size={12} /> New entity type
          </button>
        </div>
      </div>

      {err && <div style={errBar}><Icon name="flash" size={13} /> {err}</div>}
      {!model && !err && <div style={{ padding: 14, color: 'var(--text-tertiary)', fontSize: 13 }}>Loading…</div>}

      {newTrack && (
        <Form title="New track" onCancel={() => setNewTrack(null)} onSave={createTrack}>
          <In ph="key (e.g. insurance)" v={newTrack.key} on={(v) => setNewTrack({ ...newTrack, key: v })} />
          <In ph="Label" v={newTrack.label} on={(v) => setNewTrack({ ...newTrack, label: v })} />
          <In ph="color (optional, e.g. #39c)" v={newTrack.color} on={(v) => setNewTrack({ ...newTrack, color: v })} />
        </Form>
      )}
      {newType && (
        <Form title="New entity type" onCancel={() => setNewType(null)} onSave={createType}>
          <In ph="key (e.g. claim)" v={newType.key} on={(v) => setNewType({ ...newType, key: v })} />
          <In ph="Label" v={newType.label} on={(v) => setNewType({ ...newType, label: v })} />
          <select value={newType.kind} onChange={(e) => setNewType({ ...newType, kind: e.target.value })} style={inp}>
            <option value="pipeline">Pipeline (has a track + stages)</option>
            <option value="reference">Reference (a record, no stages)</option>
          </select>
          {newType.kind === 'pipeline' && (
            <select value={newType.trackKey} onChange={(e) => setNewType({ ...newType, trackKey: e.target.value })} style={inp}>
              {(model?.tracks || []).map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          )}
        </Form>
      )}

      {model && (
        <div style={{ display: 'grid', gap: 24, marginTop: 8 }}>
          <section>
            <SectionHead icon="eye" label="Tracks (pipelines)" count={model.tracks.length} />
            <div style={{ display: 'grid', gap: 10 }}>
              {model.tracks.map((t) => (
                <div key={t.key} style={card}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: t.color || 'var(--brand)' }} />
                    <strong>{t.label}</strong>
                    <code style={codeChip}>{t.key}</code>
                    {t.builtin && <span style={badge}>built-in</span>}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {t.stages.map((s) => (
                      <span key={s.stageId} style={stageChip} title={`SLA ${s.sla}d${s.lock ? ` · needs ${s.lock}` : ''}`}>{s.label}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <SectionHead icon="document" label="Entity types" count={model.types.length} />
            <div style={{ display: 'grid', gap: 10 }}>
              {model.types.map((e) => (
                <div key={e.key} style={card}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                    <strong>{e.label}</strong>
                    <code style={codeChip}>{e.key}</code>
                    <span style={{ ...badge, background: e.kind === 'pipeline' ? 'var(--track-sales, #46c)' : 'var(--text-tertiary, #888)', color: '#fff' }}>
                      {KIND_LABEL[e.kind] || e.kind}
                    </span>
                    {e.trackKey && <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>→ {e.trackKey} track</span>}
                    {e.builtin && <span style={badge}>built-in</span>}
                    <button style={miniBtn} onClick={() => { setAddFieldFor(e.key); setField({ key: '', label: '', category: '', dataKind: 'text' }); }}>
                      + Add field
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {e.fields.length === 0 && <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>No fields yet.</span>}
                    {e.fields.map((f) => (
                      <span key={f.key} style={fieldChip} title={`${f.category || ''} · ${f.dataKind}`}>
                        {f.label}
                        <button style={xBtn} title="Remove field" onClick={() => deleteField(e.key, f.key)}>×</button>
                      </span>
                    ))}
                  </div>
                  {addFieldFor === e.key && (
                    <div style={{ marginTop: 10 }}>
                      <Form title={`Add field to ${e.label}`} onCancel={() => setAddFieldFor(null)} onSave={() => addField(e.key)} compact>
                        <In ph="key (e.g. premium)" v={field.key} on={(v) => setField({ ...field, key: v })} />
                        <In ph="Label" v={field.label} on={(v) => setField({ ...field, label: v })} />
                        <In ph="Category (optional)" v={field.category} on={(v) => setField({ ...field, category: v })} />
                        <select value={field.dataKind} onChange={(ev) => setField({ ...field, dataKind: ev.target.value })} style={inp}>
                          {DATA_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
                        </select>
                      </Form>
                    </div>
                  )}
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

const Form = ({ title, children, onCancel, onSave, compact }) => (
  <div style={{ ...card, marginBottom: compact ? 0 : 16, borderColor: 'var(--brand, #46c)' }}>
    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>{title}</div>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
      {children}
      <button className="cta" onClick={onSave}>Save</button>
      <button style={miniBtn} onClick={onCancel}>Cancel</button>
    </div>
  </div>
);

const In = ({ ph, v, on }) => (
  <input placeholder={ph} value={v} onChange={(e) => on(e.target.value)} style={inp} />
);

const card = { background: 'var(--bg-muted)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px' };
const codeChip = { fontFamily: 'var(--mono)', fontSize: 11, padding: '1px 6px', border: '1px solid var(--border-strong, #333)', borderRadius: 3, color: 'var(--text-secondary)' };
const badge = { fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.4, padding: '1px 6px', borderRadius: 3, background: 'var(--bg)', color: 'var(--text-tertiary)', border: '1px solid var(--border)' };
const stageChip = { fontSize: 12, padding: '2px 8px', borderRadius: 12, background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-secondary)' };
const fieldChip = { fontSize: 12, padding: '2px 4px 2px 8px', borderRadius: 4, background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 4 };
const xBtn = { border: 'none', background: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: '0 2px' };
const miniBtn = { fontSize: 12, padding: '3px 8px', borderRadius: 5, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-secondary)', cursor: 'pointer' };
const inp = { padding: '6px 9px', borderRadius: 6, border: '1px solid var(--border, #333)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 };
const errBar = { margin: '10px 0', padding: '8px 12px', borderRadius: 6, background: 'var(--bg-muted)', border: '1px solid var(--status-red, #e05)', color: 'var(--status-red, #e05)', fontSize: 13, display: 'flex', gap: 8, alignItems: 'center' };
