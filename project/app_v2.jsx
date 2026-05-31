/* v2 App — Triage / Today view */

const SideStat = ({ icon, value, label, accent, active, onClick }) => (
  <button className={`sideStat ${accent || 'neutral'} ${active ? 'active' : ''}`} onClick={onClick}>
    <div className="icon"><Icon name={icon} size={15} strokeWidth={2} /></div>
    <div className="text">
      <span className="v">{value}</span>
      <span className="l">{label}</span>
    </div>
  </button>
);

const TrackHealthRow = ({ trackKey, label, items }) => {
  const greens = items.filter(i => i.status === 'green').length;
  const ambers = items.filter(i => i.status === 'amber').length;
  const reds   = items.filter(i => i.status === 'red').length;
  const total  = items.length || 1;
  const swColor = {
    sales: 'var(--track-sales)',
    operations: 'var(--track-ops)',
    workshop: 'var(--track-workshop)',
    finance: 'var(--track-finance)',
  }[trackKey];
  return (
    <div className="trackHealthRow">
      <span className="sw" style={{ background: swColor }} />
      <span className="nm">{label}</span>
      <span className="bar">
        <i style={{ width: `${(greens/total)*100}%`, background: 'var(--status-green)' }} />
        <i style={{ width: `${(ambers/total)*100}%`, background: 'var(--status-amber)' }} />
        <i style={{ width: `${(reds/total)*100}%`,   background: 'var(--status-red)' }} />
      </span>
      <span className="ct">{items.length}</span>
    </div>
  );
};

// Row item — denser than v1 card
const RowItem = ({ item, trackKey, stages, onOpen, flash }) => {
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (flash && ref.current) {
      ref.current.classList.add('flash');
      const t = setTimeout(() => ref.current && ref.current.classList.remove('flash'), 1500);
      return () => clearTimeout(t);
    }
  }, [flash]);

  const stageIdx = stages.findIndex(s => s.id === item.stageId);
  const progress = stageIdx >= 0 ? ((stageIdx + 1) / stages.length) * 100 : 25;

  const daysClass = item.status === 'red' ? 'red' : item.status === 'amber' ? 'amber' : '';

  return (
    <div ref={ref} className="rowItem" data-status={item.status} onClick={() => onOpen && onOpen(item)}>
      <div className="colTags">
        <span className="miniBadge" data-track={trackKey}>{trackKey === 'operations' ? 'OPS' : trackKey.toUpperCase()}</span>
        <span className="miniBadge kind" data-kind={item.type}>{item.type}</span>
      </div>

      <div className="colCustomer">
        <div className="name">{item.customer}</div>
        <div className="meta">
          {item.vehicle && <span className="plate">{item.vehicle}</span>}
          <span>{item.sub}</span>
        </div>
      </div>

      <div className="colStage">
        <span className="stageName">{item.stageName}</span>
        <span className="stageProg">
          <i style={{ width: `${progress}%`,
            background: item.status === 'red' ? 'var(--status-red)'
                       : item.status === 'amber' ? 'var(--status-amber)'
                       : 'var(--text-tertiary)' }} />
        </span>
      </div>

      <div className={`colDays ${daysClass}`}>
        <span className="big">{item.daysLabel || `${item.days}d`}</span>
        <span>in stage</span>
      </div>

      <div className="colValue">
        {item.value != null ? (
          <>
            <div>{fmtMoney(item.value)}</div>
            <div className="vSub">{item.type === 'INVOICE' || item.type === 'SUPPLIER' ? 'invoice' : 'contract'}</div>
          </>
        ) : (
          <>
            <div style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>—</div>
            <div className="vSub">no value yet</div>
          </>
        )}
      </div>

      <div className="colCta" onClick={e => e.stopPropagation()}>
        <Avatar name={item.owner} size="sm" muted />
        <button className={`cta ${item.status === 'red' ? 'attention' : ''}`}>
          {item.cta}
        </button>
      </div>
    </div>
  );
};

const trackOf = (id) => {
  if (id.startsWith('s')) return { key: 'sales', stages: SALES_STAGES };
  if (id.startsWith('o')) return { key: 'operations', stages: OPS_STAGES };
  if (id.startsWith('w')) return { key: 'workshop', stages: WORKSHOP_STAGES };
  if (id.startsWith('f')) return { key: 'finance', stages: FINANCE_STAGES };
  return { key: 'sales', stages: SALES_STAGES };
};

const App = () => {
  const [view, setView] = React.useState('dashboard');
  const [filter, setFilter] = React.useState('today'); // today | week | all | track
  const [trackFilter, setTrackFilter] = React.useState(null);
  const [timeline, setTimeline] = React.useState(null);
  const [toast, setToast] = React.useState(null);
  const [flashIds, setFlashIds] = React.useState([]);

  const [sales, setSales] = React.useState(SEED_SALES);
  const [ops, setOps] = React.useState(SEED_OPS);
  const [finance, setFinance] = React.useState(SEED_FINANCE);

  const brusselsSigned = sales.find(s => s.id === 's5')?.stageId === 'signed';

  const triggerSignDemo = () => {
    if (brusselsSigned) return;
    setSales(prev => prev.map(s =>
      s.id === 's5' ? { ...s, stageId: 'signed', stageName: 'Signed', status: 'green',
                       daysLabel: 'signed now', cta: 'Open in CRM' } : s
    ));
    const newOps = {
      id: 'o1', customer: 'Brussels Energy SA', vehicle: 'Fleet · 78 vehicles',
      type: 'DELIVERY', sub: 'Auto-triggered from Sales · 5-year FSL',
      stageId: 'ordered', stageName: 'Vehicle ordered',
      days: 0, daysLabel: 'day 0', owner: 'Tom Janssens', status: 'green',
      cta: 'Confirm with supplier', sources: ['API','Talend']
    };
    const newFin = {
      id: 'f1', customer: 'Brussels Energy SA', value: 2460000, type: 'INVOICE',
      sub: 'Master invoice · auto-triggered', stageId: 'to_make', stageName: 'To create',
      days: 0, daysLabel: 'just now', owner: 'Ines Vandeput', status: 'green',
      cta: 'Generate invoice', sources: ['API']
    };
    setOps(prev => [newOps, ...prev]);
    setFinance(prev => [newFin, ...prev]);
    setFlashIds(['s5','o1','f1']);
    setToast({
      title: 'Brussels Energy SA — contract signed',
      lines: [
        '→ New "Vehicle ordered" card · 78 vehicles',
        '→ New "Invoice to create" · €2.46M',
        '→ Customer portal updated',
      ],
    });
    setTimeout(() => setFlashIds([]), 1800);
    setTimeout(() => setToast(null), 6500);
  };

  // unified feed across all tracks, tagged
  const allItems = [
    ...sales.map(i => ({ ...i, _track: 'sales', _stages: SALES_STAGES })),
    ...ops.map(i => ({ ...i, _track: 'operations', _stages: OPS_STAGES })),
    ...SEED_WORKSHOP.map(i => ({ ...i, _track: 'workshop', _stages: WORKSHOP_STAGES })),
    ...finance.map(i => ({ ...i, _track: 'finance', _stages: FINANCE_STAGES })),
  ];

  // urgency buckets
  const urgent = allItems.filter(i => i.status === 'red');
  const thisWeek = allItems.filter(i => i.status === 'amber' || (i.daysLabel || '').startsWith('today') || (i.daysLabel || '').includes('day 0'));
  const onTrack = allItems.filter(i => i.status === 'green' && !thisWeek.includes(i));

  let visible;
  if (filter === 'today') visible = [...urgent, ...thisWeek];
  else if (filter === 'week') visible = [...urgent, ...thisWeek, ...onTrack.slice(0, 6)];
  else visible = allItems;

  if (trackFilter) visible = visible.filter(i => i._track === trackFilter);

  const groupedVisible = filter !== 'all' ? null : (() => {
    const by = { sales: [], operations: [], workshop: [], finance: [] };
    visible.forEach(i => by[i._track].push(i));
    return by;
  })();

  if (view === 'portal') {
    return (
      <div className="app">
        <AppHeader view={view} setView={setView} />
        <CustomerPortal />
      </div>
    );
  }

  return (
    <div className="app">
      <AppHeader view={view} setView={setView} />

      <div className="appV2">
        {/* LEFT RAIL */}
        <aside className="sideRail">
          <div className="sideHello">
            <div className="label">Thursday · 28 May</div>
            <h2>Good morning, Markus</h2>
            <div className="sub">Country manager · Benelux</div>
          </div>

          <SideStat icon="clock" value="14" label="Service due · 90 days"
                    active={trackFilter === 'service'} onClick={() => setTrackFilter(null)} />
          <SideStat icon="bolt" value="€1.15M" label="Renewals at risk" accent="amber" />
          <SideStat icon="document" value="€6.76M" label="Awaiting signature" />
          <SideStat icon="receipt" value="€94k" label="Overdue invoices" accent="red" />

          <div className="sideDiv" />

          <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase',
                        color: 'var(--text-tertiary)', marginBottom: 4 }}>
            Track health
          </div>
          <div className="sideTrackHealth">
            <TrackHealthRow trackKey="sales"      label="Sales"      items={sales} />
            <TrackHealthRow trackKey="operations" label="Operations" items={ops} />
            <TrackHealthRow trackKey="workshop"   label="Workshop"   items={SEED_WORKSHOP} />
            <TrackHealthRow trackKey="finance"    label="Finance"    items={finance} />
          </div>

          <div className="sideDiv" />

          <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase',
                        color: 'var(--text-tertiary)', marginBottom: 4 }}>
            Filter by track
          </div>
          {[
            ['sales','Sales','var(--track-sales)'],
            ['operations','Operations','var(--track-ops)'],
            ['workshop','Workshop','var(--track-workshop)'],
            ['finance','Finance','var(--track-finance)'],
          ].map(([k, l, c]) => (
            <button key={k}
              className={`trackHealthRow ${trackFilter === k ? '' : ''}`}
              style={{
                background: trackFilter === k ? 'var(--brand-tint)' : 'transparent',
                cursor: 'pointer', border: 0, textAlign: 'left'
              }}
              onClick={() => setTrackFilter(trackFilter === k ? null : k)}>
              <span className="sw" style={{ background: c }} />
              <span className="nm">{l}</span>
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <div style={{ fontSize: 11, color: 'var(--text-quiet)', padding: '8px 4px' }}>
            All sources synced · 2 min ago
          </div>
        </aside>

        {/* MAIN COLUMN */}
        <main className="mainV2">
          <div className="feedHead">
            <div>
              <div className="crumb">Triage view · today</div>
              <h1>{urgent.length + thisWeek.length} items need you this week</h1>
            </div>
            <div className="row">
              <button className="feedAction pulse" onClick={triggerSignDemo} disabled={brusselsSigned}>
                {!brusselsSigned && <span className="dot" />}
                <Icon name="bolt" size={12} strokeWidth={2} />
                {brusselsSigned ? 'Cascade complete' : 'Demo: sign Brussels Energy'}
              </button>
            </div>
          </div>

          <div className="feedTabs" style={{ marginBottom: 24 }}>
            <button className={filter === 'today' ? 'active' : ''} onClick={() => setFilter('today')}>
              <Icon name="bolt" size={12} strokeWidth={2} />
              Needs you now <span className="count">{urgent.length + thisWeek.length}</span>
            </button>
            <button className={filter === 'week' ? 'active' : ''} onClick={() => setFilter('week')}>
              <Icon name="clock" size={12} strokeWidth={2} />
              This week
            </button>
            <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>
              <Icon name="filter" size={12} strokeWidth={2} />
              All items <span className="count">{allItems.length}</span>
            </button>
          </div>

          {trackFilter && (
            <div className="banner" style={{ borderColor: 'var(--brand)', background: 'var(--brand-tint)', color: '#075a64', marginBottom: 16 }}>
              <Icon name="filter" size={14} strokeWidth={2} />
              Track filter: <strong style={{ marginLeft: 4, textTransform: 'capitalize' }}>{trackFilter}</strong>
              <button className="dismiss" onClick={() => setTrackFilter(null)}>Clear</button>
            </div>
          )}

          {filter !== 'all' ? (
            <>
              {urgent.length > 0 && (
                <div className="feedGroup">
                  <div className="feedGroupHead urgent">
                    <div className="t">Blocked or overdue <span className="pill">{urgent.length}</span></div>
                    <div className="sub">Action required today</div>
                  </div>
                  {urgent.filter(i => !trackFilter || i._track === trackFilter).map(it => (
                    <RowItem key={`${it._track}-${it.id}`} item={it} trackKey={it._track}
                             stages={it._stages} onOpen={() => setTimeline(VEHICLE_TIMELINE)}
                             flash={flashIds.includes(it.id)} />
                  ))}
                </div>
              )}

              {thisWeek.length > 0 && (
                <div className="feedGroup">
                  <div className="feedGroupHead amber">
                    <div className="t">Approaching SLA <span className="pill">{thisWeek.length}</span></div>
                    <div className="sub">Within the next 7 days · keep an eye on these</div>
                  </div>
                  {thisWeek.filter(i => !trackFilter || i._track === trackFilter).map(it => (
                    <RowItem key={`${it._track}-${it.id}`} item={it} trackKey={it._track}
                             stages={it._stages} onOpen={() => setTimeline(VEHICLE_TIMELINE)}
                             flash={flashIds.includes(it.id)} />
                  ))}
                </div>
              )}

              {filter === 'week' && onTrack.length > 0 && (
                <div className="feedGroup">
                  <div className="feedGroupHead">
                    <div className="t">On track <span className="pill">{onTrack.length}</span></div>
                    <div className="sub">No action required — informational</div>
                  </div>
                  {onTrack.slice(0, 8).filter(i => !trackFilter || i._track === trackFilter).map(it => (
                    <RowItem key={`${it._track}-${it.id}`} item={it} trackKey={it._track}
                             stages={it._stages} onOpen={() => setTimeline(VEHICLE_TIMELINE)}
                             flash={flashIds.includes(it.id)} />
                  ))}
                </div>
              )}

              {urgent.length === 0 && thisWeek.length === 0 && (
                <div className="rewardState">
                  <div className="big">✓ Everything is on track</div>
                  Nothing needs your attention right now. Twenty-three items are progressing normally across all four tracks.
                </div>
              )}
            </>
          ) : (
            <>
              {['sales','operations','workshop','finance'].map(t => {
                const items = groupedVisible[t];
                if (!items.length) return null;
                const labels = { sales: 'Sales', operations: 'Operations', workshop: 'Workshop', finance: 'Finance' };
                const stageSet = { sales: SALES_STAGES, operations: OPS_STAGES, workshop: WORKSHOP_STAGES, finance: FINANCE_STAGES };
                return (
                  <div className="feedGroup" key={t}>
                    <div className="feedGroupHead">
                      <div className="t">
                        <span className="miniBadge" data-track={t}>{t === 'operations' ? 'OPS' : t.toUpperCase()}</span>
                        {labels[t]} <span className="pill">{items.length}</span>
                      </div>
                    </div>
                    {items.map(it => (
                      <RowItem key={`${t}-${it.id}`} item={it} trackKey={t}
                               stages={stageSet[t]} onOpen={() => setTimeline(VEHICLE_TIMELINE)}
                               flash={flashIds.includes(it.id)} />
                    ))}
                  </div>
                );
              })}
            </>
          )}
        </main>
      </div>

      {timeline && <VehicleTimeline data={timeline} onClose={() => setTimeline(null)} />}

      {toast && (
        <div className="toast">
          <span className="toastDot" />
          <div>
            <div style={{ fontWeight: 500, marginBottom: 4 }}>{toast.title}</div>
            {toast.lines.map((l, i) => (
              <div key={i} style={{ fontSize: 12, opacity: 0.85 }}>{l}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
