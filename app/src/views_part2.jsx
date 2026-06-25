import React from 'react';
import { Icon } from './icons.jsx';
import { StageConfigEditor, CrossTrackTriggerEditor } from './editors.jsx';
import { api } from './api/client.js';
import { SimBadge } from './primitives.jsx';

/* ============================================================
   SETTINGS
   ============================================================ */

export const SettingsView = () => {
  const [toggles, setToggles] = React.useState({
    enforceLocks: true, peppol: true, emailNotif: true, slackNotif: false, dailyDigest: true, autoEscalate: true,
  });

  // Load this user's saved preferences (fallback to defaults on failure).
  React.useEffect(() => {
    let cancelled = false;
    api.get('/me/preferences').then((p) => {
      if (!cancelled && p && typeof p === 'object') setToggles(t => ({ ...t, ...p }));
    }).catch(() => { /* keep defaults */ });
    return () => { cancelled = true; };
  }, []);

  const flip = (k) => setToggles(t => {
    const next = { ...t, [k]: !t[k] };
    api.put('/me/preferences', { [k]: next[k] }).catch(e => console.error('Failed to save preference', e));
    return next;
  });

  return (
    <div className="viewWrap">
      <div className="viewHero">
        <div>
          <h1>Settings</h1>
          <div className="sub">Stage definitions, SLA thresholds, lock conditions and cross-track triggers — all config-driven. Changes here propagate to every dashboard view without code changes.</div>
        </div>
        <button className="cta ghost" onClick={() => {
          const cfg = { exportedAt: new Date().toISOString(), preferences: toggles };
          const url = URL.createObjectURL(new Blob([JSON.stringify(cfg, null, 2)], { type: 'application/json' }));
          const a = document.createElement('a'); a.href = url; a.download = 'workspace-config.json'; a.click(); URL.revokeObjectURL(url);
        }}><Icon name="download" size={12} strokeWidth={2} /> Export config (JSON)</button>
      </div>

      <StageConfigEditor />

      <CrossTrackTriggerEditor />

      <div className="settingsSection">
        <div className="h">
          <h3>Notifications & rules</h3>
          <div className="hint">Per-user; affects this account only.</div>
        </div>
        <div className="settingsBody">
          <div className="toggleRow">
            <div>
              <div className="t">Enforce stage locks</div>
              <div className="d">Block users from advancing a card past a locked stage. Disable for advisory-only mode (shows a warning instead).</div>
            </div>
            <div className={`toggle ${toggles.enforceLocks ? 'on' : ''}`} onClick={() => flip('enforceLocks')} />
          </div>
          <div className="toggleRow">
            <div>
              <div className="t">PEPPOL outbound preferred</div>
              <div className="d">Where the customer supports it, default to PEPPOL e-invoicing over email PDF. Falls back automatically if delivery fails.</div>
            </div>
            <div className={`toggle ${toggles.peppol ? 'on' : ''}`} onClick={() => flip('peppol')} />
          </div>
          <div className="toggleRow">
            <div>
              <div className="t">Email notifications <SimBadge label="No delivery" title="Preference is saved, but no email backend is connected" /></div>
              <div className="d">Receive emails for items at red status on tracks you own.</div>
            </div>
            <div className={`toggle ${toggles.emailNotif ? 'on' : ''}`} onClick={() => flip('emailNotif')} />
          </div>
          <div className="toggleRow">
            <div>
              <div className="t">Slack notifications <SimBadge label="No delivery" title="Preference is saved, but no Slack backend is connected" /></div>
              <div className="d">Post to <code>#fleet-ops-benelux</code> when cross-track cascades fire.</div>
            </div>
            <div className={`toggle ${toggles.slackNotif ? 'on' : ''}`} onClick={() => flip('slackNotif')} />
          </div>
          <div className="toggleRow">
            <div>
              <div className="t">Daily morning digest <SimBadge label="No delivery" title="Preference is saved, but no email scheduler is connected" /></div>
              <div className="d">A snapshot of red and amber items emailed at 07:30 your local time.</div>
            </div>
            <div className={`toggle ${toggles.dailyDigest ? 'on' : ''}`} onClick={() => flip('dailyDigest')} />
          </div>
          <div className="toggleRow">
            <div>
              <div className="t">Auto-escalate stuck items</div>
              <div className="d">If an item stays in the same stage past 2× SLA, escalate to the track owner's manager. Red status applied automatically.</div>
            </div>
            <div className={`toggle ${toggles.autoEscalate ? 'on' : ''}`} onClick={() => flip('autoEscalate')} />
          </div>
        </div>
      </div>

      <div className="settingsSection">
        <div className="h">
          <h3>Workspace</h3>
          <div className="hint">Defaults applied to all users in this workspace.</div>
        </div>
        <div className="settingsBody">
          <table className="stageTable">
            <tbody>
              <tr><td style={{ width: 220, color: 'var(--text-tertiary)' }}>Country scope</td><td>Belgium · Netherlands · Luxembourg · Germany</td></tr>
              <tr><td style={{ color: 'var(--text-tertiary)' }}>Currency</td><td>EUR · two-decimal · DE/NL number formatting</td></tr>
              <tr><td style={{ color: 'var(--text-tertiary)' }}>Working calendar</td><td>5-day · public holidays per country</td></tr>
              <tr><td style={{ color: 'var(--text-tertiary)' }}>Languages</td><td>English (default) · Dutch · French · German</td></tr>
              <tr><td style={{ color: 'var(--text-tertiary)' }}>Timezone</td><td>UTC</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

/* ============================================================
   VEHICLES & TIMELINES
   ============================================================ */

export const VehiclesView = ({ onOpenTimeline }) => {
  const [vehicles, setVehicles] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [filter, setFilter] = React.useState('all');
  const [query, setQuery] = React.useState('');

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.get('/vehicles').then((data) => {
      if (!cancelled) setVehicles(Array.isArray(data) ? data : []);
    }).catch(() => {
      if (!cancelled) setVehicles([]);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const filtered = vehicles.filter(v => {
    if (filter === 'service') { if (v.status !== 'warn') return false; }
    else if (filter === 'workshop') { if (v.status !== 'busy') return false; }
    else if (filter === 'delivery') { if (v.statusLabel !== 'Awaiting delivery' && v.statusLabel !== 'Delivery slipping') return false; }
    else if (filter === 'late') { if (v.status !== 'late') return false; }
    if (query && !`${v.plate} ${v.operator ?? ''} ${v.model ?? ''}`.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  const countBy = (fn) => vehicles.filter(fn).length;

  return (
    <div className="viewWrap">
      <div className="viewHero">
        <div>
          <h1>Vehicle timelines</h1>
          <div className="sub">One vehicle, one timeline — the killer drill-down. Each vehicle threads through Sales → Operations → Workshop → Finance over its multi-year lifecycle. Click any vehicle to see every stage it has passed through and what's next.</div>
        </div>
      </div>

      <div className="viewStats">
        <div className="viewStat"><div className="l">Total fleet</div><div className="v">{vehicles.length}</div><div className="s">across {new Set(vehicles.map(v => v.operator).filter(Boolean)).size} operators</div></div>
        <div className="viewStat warn"><div className="l">Service due</div><div className="v">{countBy(v => v.status === 'warn')}</div><div className="s">vehicles needing attention</div></div>
        <div className="viewStat"><div className="l">In workshop</div><div className="v">{countBy(v => v.status === 'busy')}</div><div className="s">currently occupied</div></div>
        <div className="viewStat bad"><div className="l">Delivery slipping</div><div className="v">{countBy(v => v.statusLabel === 'Delivery slipping')}</div><div className="s">late deliveries</div></div>
      </div>

      <div className="searchWrap" style={{ maxWidth: 'none', marginBottom: 12 }}>
        <Icon name="search" size={15} />
        <input placeholder="Search by plate, VIN tail, operator name…"
               value={query} onChange={e => setQuery(e.target.value)} />
        {query && <button className="miniBtn" onClick={() => setQuery('')}>Clear</button>}
      </div>

      <div className="vehicleFilters">
        {[
          ['all', `All · ${vehicles.length}`],
          ['service', `Service due · ${countBy(v => v.status === 'warn')}`],
          ['workshop', `In workshop · ${countBy(v => v.status === 'busy')}`],
          ['delivery', `Awaiting delivery · ${countBy(v => v.statusLabel === 'Awaiting delivery' || v.statusLabel === 'Delivery slipping')}`],
          ['late', `Slipping · ${countBy(v => v.status === 'late')}`],
        ].map(([id, label]) => (
          <button key={id} className={`filterChip ${filter === id ? 'active' : ''}`}
                  onClick={() => setFilter(id)}>{label}</button>
        ))}
      </div>

      {loading && (
        <div className="rewardState"><div className="big">Loading…</div>Fetching vehicles from the API.</div>
      )}

      {!loading && vehicles.length === 0 && (
        <div className="rewardState"><div className="big">No vehicles yet</div>No vehicles have been added to this tenant's fleet. Vehicles appear here once they are registered.</div>
      )}

      {!loading && vehicles.length > 0 && filtered.map(v => (
        <div key={v.id} className="vehicleResult" onClick={() => onOpenTimeline(v)}>
          <span className="plate">{v.plate}</span>
          <div>
            <div className="vrName">{v.operator ?? '—'}</div>
            <div className="vrSub">{v.model ?? '—'}</div>
          </div>
          <div className="vrProgress">
            <div className="vrProgressLabel">
              <span>Status</span>
              <span>{v.statusLabel ?? '—'}</span>
            </div>
            <div className="vrProgressBar">
              {Array.from({ length: 8 }).map((_, i) => (
                <i key={i} />
              ))}
            </div>
          </div>
          <div className="vrNext">
            <div className="l">Note</div>
            <div>{v.note ?? '—'}</div>
          </div>
          <span className={`statusPill ${v.status ?? ''}`}>
            <span className="d" />{v.statusLabel ?? 'Unknown'}
          </span>
        </div>
      ))}

      {!loading && vehicles.length > 0 && filtered.length === 0 && (
        <div className="rewardState"><div className="big">No matches</div>Try clearing filters or adjusting the search query.</div>
      )}
    </div>
  );
};
