import React from 'react';
import { Icon } from './icons.jsx';
import { Avatar, fmtMoney, TrackTag } from './primitives.jsx';

/* Vehicle timeline drill-down — modal overlay */

export const VehicleTimeline = ({ data, onClose }) => {
  React.useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="overlayPanel" onClick={e => e.stopPropagation()}>
        <div className="overlayHead">
          <div style={{ flex: 1 }}>
            <h2>{data.customer}</h2>
            <div className="sub">{data.vehicle}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>Contract value</div>
            <div style={{ fontSize: 16, fontWeight: 500 }}>{fmtMoney(data.contractValue)}</div>
          </div>
          <Avatar name={data.account} muted />
          <button className="iconBtn" onClick={onClose} title="Close (Esc)">
            <Icon name="close" size={16} />
          </button>
        </div>
        <div className="overlayBody">
          <div style={{ display: 'flex', gap: 10, marginBottom: 18, alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="legendRow">
              <span className="lk"><span className="d" style={{ background: 'var(--track-workshop)' }} />Complete</span>
              <span className="lk"><span className="d" style={{ background: 'var(--brand)' }} />Active now</span>
              <span className="lk"><span className="d" style={{ background: 'white', boxShadow: 'inset 0 0 0 2px var(--border-strong)' }} />Upcoming</span>
            </div>
            <div className="legendRow">
              <span className="lk"><TrackTag track="sales">Sales</TrackTag></span>
              <span className="lk"><TrackTag track="operations">Ops</TrackTag></span>
              <span className="lk"><TrackTag track="workshop">Workshop</TrackTag></span>
              <span className="lk"><TrackTag track="finance">Finance</TrackTag></span>
            </div>
          </div>

          <div className="timeline">
            {data.events.map((ev, i) => (
              <div key={i} className={`tlItem ${ev.state}`}>
                <div className="tlMeta">
                  <TrackTag track={ev.track}>{ev.track}</TrackTag>
                  <span>{ev.date}</span>
                  <span>·</span>
                  <span>{ev.owner}</span>
                </div>
                <div className="tlStage">{ev.stage}</div>
                <div className="tlDetail">{ev.detail}</div>
                {ev.docs && (
                  <div className="tlDocs">
                    {ev.docs.map((d, j) => (
                      <span key={j} className="tlDoc">
                        <Icon name="document" size={11} strokeWidth={2} />{d}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
