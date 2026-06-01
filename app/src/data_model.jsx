import React from 'react';
import { api } from './api/client.js';
import { Icon } from './icons.jsx';

/* Data model — read-only viewer of the data-driven meta-model (tracks +
   entity types + fields). First slice of the no-code "Data model" admin area;
   authoring (create/edit) lands in a later phase. */

const KIND_LABEL = { pipeline: 'Pipeline', reference: 'Reference' };

export const DataModelView = () => {
  const [model, setModel] = React.useState(null);
  const [err, setErr] = React.useState(null);

  React.useEffect(() => {
    let alive = true;
    api.get('/admin/data-model')
      .then((m) => { if (alive) setModel(m); })
      .catch((e) => { if (alive) setErr(e.message || 'Failed to load'); });
    return () => { alive = false; };
  }, []);

  return (
    <>
      <div className="contextBar">
        <div>
          <h1>Data model</h1>
          <div className="pageSub">
            Tracks, entity types and fields that drive the whole system — defined as data, not code.
          </div>
        </div>
      </div>

      {err && (
        <div style={{ padding: 14, color: 'var(--status-red, #e05)', fontSize: 13 }}>{err}</div>
      )}
      {!model && !err && (
        <div style={{ padding: 14, color: 'var(--text-tertiary)', fontSize: 13 }}>Loading…</div>
      )}

      {model && (
        <div style={{ display: 'grid', gap: 24, marginTop: 8 }}>
          {/* Tracks */}
          <section>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
              <Icon name="eye" size={14} /> Tracks (pipelines)
              <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>· {model.tracks.length}</span>
            </div>
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
                      <span key={s.stageId} style={stageChip} title={`SLA ${s.sla}d${s.lock ? ` · needs ${s.lock}` : ''}`}>
                        {s.label}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Entity types */}
          <section>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
              <Icon name="document" size={14} /> Entity types
              <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>· {model.types.length}</span>
            </div>
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
                  </div>
                  {e.fields.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {e.fields.map((f) => (
                        <span key={f.key} style={fieldChip} title={`${f.category || ''} · ${f.dataKind}`}>
                          {f.label}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>No fields defined yet.</div>
                  )}
                </div>
              ))}
            </div>
          </section>

          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', display: 'flex', gap: 8, alignItems: 'center' }}>
            <Icon name="lock" size={12} /> Read-only for now — creating and editing tracks, types and fields lands in the next phase.
          </div>
        </div>
      )}
    </>
  );
};

const card = {
  background: 'var(--bg-muted)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px',
};
const codeChip = {
  fontFamily: 'var(--mono)', fontSize: 11, padding: '1px 6px', border: '1px solid var(--border-strong, #333)',
  borderRadius: 3, color: 'var(--text-secondary)',
};
const badge = {
  fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.4, padding: '1px 6px',
  borderRadius: 3, background: 'var(--bg)', color: 'var(--text-tertiary)', border: '1px solid var(--border)',
};
const stageChip = {
  fontSize: 12, padding: '2px 8px', borderRadius: 12, background: 'var(--bg)',
  border: '1px solid var(--border)', color: 'var(--text-secondary)',
};
const fieldChip = {
  fontSize: 12, padding: '2px 8px', borderRadius: 4, background: 'var(--bg)',
  border: '1px solid var(--border)', color: 'var(--text-secondary)',
};
