/* ============================================================
   SETTINGS
   ============================================================ */

const STAGE_CONFIG = {
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

const CROSS_TRIGGERS = [
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

const SettingsView = () => {
  const [trackTab, setTrackTab] = React.useState('sales');
  const [toggles, setToggles] = React.useState({
    enforceLocks: true, peppol: true, emailNotif: true, slackNotif: false, dailyDigest: true, autoEscalate: true,
  });
  const flip = (k) => setToggles(t => ({ ...t, [k]: !t[k] }));

  const TRACK_LABELS = {
    sales: 'Sales',
    operations: 'Operations',
    workshop: 'Workshop',
    finance: 'Finance',
  };

  return (
    <div className="viewWrap">
      <div className="viewHero">
        <div>
          <h1>Settings</h1>
          <div className="sub">Stage definitions, SLA thresholds, lock conditions and cross-track triggers — all config-driven. Changes here propagate to every dashboard view without code changes.</div>
        </div>
        <button className="cta ghost"><Icon name="download" size={12} strokeWidth={2} /> Export config (JSON)</button>
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
              <div className="d">For Benelux fleet operators, default to PEPPOL e-invoicing over email PDF. Falls back automatically if delivery fails.</div>
            </div>
            <div className={`toggle ${toggles.peppol ? 'on' : ''}`} onClick={() => flip('peppol')} />
          </div>
          <div className="toggleRow">
            <div>
              <div className="t">Email notifications</div>
              <div className="d">Receive emails for items at red status on tracks you own.</div>
            </div>
            <div className={`toggle ${toggles.emailNotif ? 'on' : ''}`} onClick={() => flip('emailNotif')} />
          </div>
          <div className="toggleRow">
            <div>
              <div className="t">Slack notifications</div>
              <div className="d">Post to <code>#fleet-ops-benelux</code> when cross-track cascades fire.</div>
            </div>
            <div className={`toggle ${toggles.slackNotif ? 'on' : ''}`} onClick={() => flip('slackNotif')} />
          </div>
          <div className="toggleRow">
            <div>
              <div className="t">Daily morning digest</div>
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
              <tr><td style={{ color: 'var(--text-tertiary)' }}>Timezone</td><td>Europe/Brussels</td></tr>
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

const VEHICLE_DATA = [
  { plate: 'TRK-7702', customer: 'Düsseldorf Bau B.V.',         model: 'MAN TGS 26.420',           year: 2024,
    currentTrack: 'workshop',   stageIdx: 4, stageName: 'In repair · brake system',
    status: 'busy',  statusLabel: 'In workshop',  nextEvent: 'Expected back · 02 Jun' },
  { plate: 'VAN-3344', customer: 'Rotterdam Logistics B.V.',    model: 'Mercedes Sprinter 314',    year: 2023,
    currentTrack: 'workshop',   stageIdx: 7, stageName: 'Released — pickup pending',
    status: 'ok',    statusLabel: 'Ready for pickup', nextEvent: 'Today · 07:00–18:00' },
  { plate: 'TRK-1108', customer: 'Amsterdam Cold Chain N.V.',   model: 'Volvo FH 460',             year: 2022,
    currentTrack: 'operations', stageIdx: 4, stageName: 'Service due · 12 days',
    status: 'warn',  statusLabel: 'Service due',  nextEvent: 'Workshop visit · 04 Jun' },
  { plate: 'VAN-4421', customer: 'Köln Last Mile GmbH',         model: 'Mercedes Sprinter 317',    year: 2024,
    currentTrack: 'operations', stageIdx: 1, stageName: 'Expected delivery · 3d late',
    status: 'late',  statusLabel: 'Delivery slipping', nextEvent: 'Supplier confirm · Jun 04' },
  { plate: 'TRK-5520', customer: 'Antwerp Retail Group NV',     model: 'DAF XF 480',               year: 2023,
    currentTrack: 'workshop',   stageIdx: 4, stageName: 'In repair · transmission',
    status: 'busy',  statusLabel: 'In workshop',  nextEvent: 'Expected back · 30 May' },
  { plate: 'TRK-9012', customer: 'Hamburg Distribution GmbH',   model: 'MAN TGS 26.500',           year: 2022,
    currentTrack: 'operations', stageIdx: 5, stageName: 'Replacement out · day 1 of 5',
    status: 'busy',  statusLabel: 'Loaner active', nextEvent: 'Return · 02 Jun' },
  { plate: 'VAN-8801', customer: 'Köln Last Mile GmbH',         model: 'Ford Transit Custom',      year: 2024,
    currentTrack: 'operations', stageIdx: 3, stageName: 'In fleet · routine',
    status: 'ok',    statusLabel: 'Active',       nextEvent: 'Next service · 47 days' },
  { plate: 'VAN-2210', customer: 'Antwerp Retail Group NV',     model: 'Mercedes Sprinter 314',    year: 2023,
    currentTrack: 'operations', stageIdx: 4, stageName: 'Inspection proof received',
    status: 'ok',    statusLabel: 'Active',       nextEvent: 'Next service · 364 days' },
  { plate: 'TRK-2284', customer: 'Rotterdam Logistics B.V.',    model: 'Volvo FH 460',             year: 2026,
    currentTrack: 'operations', stageIdx: 1, stageName: 'Expected delivery · 18 Jun',
    status: 'busy',  statusLabel: 'Awaiting delivery', nextEvent: 'Delivery · Jun 18' },
  { plate: 'VAN-5571', customer: 'Rotterdam Logistics B.V.',    model: 'Ford Transit Custom',      year: 2022,
    currentTrack: 'operations', stageIdx: 4, stageName: 'Service due · 21 days',
    status: 'warn',  statusLabel: 'Service due',  nextEvent: 'Awaiting operator confirmation' },
];

const VehiclesView = ({ onOpenTimeline }) => {
  const [filter, setFilter] = React.useState('all');
  const [query, setQuery] = React.useState('');

  const TOTAL_STAGES = 8;
  const filtered = VEHICLE_DATA.filter(v => {
    if (filter === 'all') {}
    else if (filter === 'service') { if (v.status !== 'warn') return false; }
    else if (filter === 'workshop') { if (v.currentTrack !== 'workshop') return false; }
    else if (filter === 'delivery') { if (v.statusLabel !== 'Awaiting delivery' && v.statusLabel !== 'Delivery slipping') return false; }
    else if (filter === 'late')    { if (v.status !== 'late') return false; }
    if (query && !`${v.plate} ${v.customer} ${v.model}`.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="viewWrap">
      <div className="viewHero">
        <div>
          <h1>Vehicle timelines</h1>
          <div className="sub">One vehicle, one timeline — the killer drill-down. Each vehicle threads through Sales → Operations → Workshop → Finance over its multi-year lifecycle. Click any vehicle to see every stage it has passed through and what's next.</div>
        </div>
      </div>

      <div className="viewStats">
        <div className="viewStat"><div className="l">Total fleet</div><div className="v">487</div><div className="s">across {new Set(VEHICLE_DATA.map(v => v.customer)).size}+ operators</div></div>
        <div className="viewStat warn"><div className="l">Service due 90d</div><div className="v">14</div><div className="s">3 amber · 11 on track</div></div>
        <div className="viewStat"><div className="l">In workshop</div><div className="v">3</div><div className="s">avg 4.2 days</div></div>
        <div className="viewStat bad"><div className="l">Delivery slipping</div><div className="v">1</div><div className="s">VAN-4421 · 3 days late</div></div>
      </div>

      <div className="searchWrap" style={{ maxWidth: 'none', marginBottom: 12 }}>
        <Icon name="search" size={15} />
        <input placeholder="Search by plate, VIN tail, customer name…"
               value={query} onChange={e => setQuery(e.target.value)} />
        {query && <button className="miniBtn" onClick={() => setQuery('')}>Clear</button>}
      </div>

      <div className="vehicleFilters">
        {[
          ['all', `All · ${VEHICLE_DATA.length}`],
          ['service', `Service due · ${VEHICLE_DATA.filter(v => v.status === 'warn').length}`],
          ['workshop', `In workshop · ${VEHICLE_DATA.filter(v => v.currentTrack === 'workshop').length}`],
          ['delivery', `Awaiting delivery · ${VEHICLE_DATA.filter(v => v.statusLabel === 'Awaiting delivery' || v.statusLabel === 'Delivery slipping').length}`],
          ['late', `Slipping · ${VEHICLE_DATA.filter(v => v.status === 'late').length}`],
        ].map(([id, label]) => (
          <button key={id} className={`filterChip ${filter === id ? 'active' : ''}`}
                  onClick={() => setFilter(id)}>{label}</button>
        ))}
      </div>

      {filtered.map(v => (
        <div key={v.plate} className="vehicleResult" onClick={() => onOpenTimeline(v)}>
          <span className="plate">{v.plate}</span>
          <div>
            <div className="vrName">{v.customer}</div>
            <div className="vrSub">{v.model} · {v.year}</div>
          </div>
          <div className="vrProgress">
            <div className="vrProgressLabel">
              <span>Lifecycle</span>
              <span>{v.stageName}</span>
            </div>
            <div className="vrProgressBar">
              {Array.from({ length: TOTAL_STAGES }).map((_, i) => (
                <i key={i} className={i < v.stageIdx ? 'done' : i === v.stageIdx ? 'active' : ''} />
              ))}
            </div>
          </div>
          <div className="vrNext">
            <div className="l">Next event</div>
            <div>{v.nextEvent}</div>
          </div>
          <span className={`statusPill ${v.status}`}>
            <span className="d" />{v.statusLabel}
          </span>
        </div>
      ))}

      {filtered.length === 0 && (
        <div className="rewardState"><div className="big">No matches</div>Try clearing filters or adjusting the search query.</div>
      )}
    </div>
  );
};

Object.assign(window, { SettingsView, VehiclesView, VEHICLE_DATA, STAGE_CONFIG, CROSS_TRIGGERS });
