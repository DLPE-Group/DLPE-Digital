/* Mobile app — Intelligence Layer (iOS) */

/* ---------- Helpers ---------- */

const M_fmtMoney = (n) => {
  if (n == null) return '';
  if (n >= 1_000_000) return '€' + (n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 2) + 'M';
  if (n >= 1_000)     return '€' + Math.round(n / 1_000) + 'k';
  return '€' + n.toLocaleString('en-EU');
};

const TRACK_COLOR_M = {
  sales: 'var(--track-sales)',
  operations: 'var(--track-ops)',
  workshop: 'var(--track-workshop)',
  finance: 'var(--track-finance)',
};

const TRACK_LABEL_M = {
  sales: 'Sales pipeline',
  operations: 'Operations',
  workshop: 'Own workshop',
  finance: 'Finance',
};

const TRACK_OWNER_M = {
  sales: 'Eva de Vries',
  operations: 'Tom Janssens',
  workshop: 'Lars Pieters',
  finance: 'Ines Vandeput',
};

/* ---------- Snapshot card ---------- */

const SnapshotCard = ({ urgent, watch }) => (
  <div className="snapshotCard">
    <div className={`snapshotIcon ${urgent > 0 ? 'red' : 'green'}`}>
      <Icon name={urgent > 0 ? 'bolt' : 'check'} size={20} strokeWidth={2.5} />
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div className="t">
        {urgent > 0
          ? `${urgent} blocked · ${watch} approaching SLA`
          : `Everything is on track`}
      </div>
      <div className="s">Thursday morning · 28 May 2026</div>
    </div>
  </div>
);

/* ---------- Mobile scorecard ---------- */

const MobileScorecard = ({ trackId, items, hero, onOpen, onAct }) => {
  const reds   = items.filter(i => i.status === 'red');
  const ambers = items.filter(i => i.status === 'amber');
  const greens = items.filter(i => i.status === 'green');
  const total  = items.length || 1;
  const urgent = reds[0] || [...ambers].sort((a, b) => (b.days || 0) - (a.days || 0))[0] || null;

  return (
    <div className="mobScorecard" onClick={() => onOpen(trackId)}>
      <div className="mscHead">
        <span className="mscSwatch" style={{ background: TRACK_COLOR_M[trackId] }} />
        <span className="mscName">{TRACK_LABEL_M[trackId]}</span>
        <span className="mscCount">{items.length}</span>
        <span className="mscChev"><Icon name="chevronRight" size={14} /></span>
      </div>
      <div className="mscHero">
        <span className="num">{hero.value}</span>
        <span className="sub">{hero.label}</span>
      </div>
      <div className="mscBar">
        {greens.length > 0 && <i style={{ width: `${(greens.length/total)*100}%`, background: 'var(--status-green)' }} />}
        {ambers.length > 0 && <i style={{ width: `${(ambers.length/total)*100}%`, background: 'var(--status-amber)' }} />}
        {reds.length > 0   && <i style={{ width: `${(reds.length/total)*100}%`,   background: 'var(--status-red)' }} />}
      </div>
      <div className="mscLegend">
        <span className="l"><span className="d" style={{ background: 'var(--status-green)' }} />{greens.length} on track</span>
        <span className="l"><span className="d" style={{ background: 'var(--status-amber)' }} />{ambers.length} amber</span>
        <span className="l"><span className="d" style={{ background: 'var(--status-red)' }} />{reds.length} red</span>
      </div>
      {urgent ? (
        <div className="mscUrgent" data-status={urgent.status}>
          <div className="uLabel">
            {urgent.status === 'red' ? 'Blocked · action today' : 'Approaching SLA'}
          </div>
          <div className="uName">{urgent.customer}</div>
          <div className="uStage">
            {urgent.stageName} · {urgent.daysLabel || `${urgent.days}d`}
            {urgent.vehicle ? ` · ${urgent.vehicle}` : ''}
          </div>
          <button className={`btnPrimary ${urgent.status === 'red' ? 'attention' : ''}`}
                  onClick={(e) => { e.stopPropagation(); onAct(urgent); }}>
            {urgent.cta}
            <Icon name="arrow" size={11} strokeWidth={2.5} />
          </button>
        </div>
      ) : (
        <div className="mscOkBlock">
          <Icon name="check" size={18} strokeWidth={2.5} />
          All on track
        </div>
      )}
    </div>
  );
};

/* ---------- Today screen ---------- */

const TodayScreen = ({ state, onOpenPipeline, onAct }) => {
  const { sales, ops, workshop, finance } = state;
  const urgent = [...sales, ...ops, ...workshop, ...finance].filter(i => i.status === 'red').length;
  const watch  = [...sales, ...ops, ...workshop, ...finance].filter(i => i.status === 'amber').length;
  const pipeline = sales.reduce((s, i) => s + (i.value || 0), 0);
  const finOverdue = finance.filter(i => i.stageId === 'overdue').reduce((s, i) => s + (i.value || 0), 0);

  return (
    <>
      <header className="mobHeader">
        <div className="h-text">
          <h1>Today</h1>
          <div className="h-sub">Markus Weber · Country manager</div>
        </div>
        <div className="avatar">MW</div>
      </header>

      <SnapshotCard urgent={urgent} watch={watch} />

      <div className="sectionLabel">Pipelines</div>

      <MobileScorecard trackId="sales" items={sales}
        hero={{ value: M_fmtMoney(pipeline), label: 'pipeline value' }}
        onOpen={onOpenPipeline} onAct={onAct} />
      <MobileScorecard trackId="operations" items={ops}
        hero={{ value: 14, label: 'service due 90d' }}
        onOpen={onOpenPipeline} onAct={onAct} />
      <MobileScorecard trackId="workshop" items={workshop}
        hero={{ value: workshop.length, label: 'open work orders' }}
        onOpen={onOpenPipeline} onAct={onAct} />
      <MobileScorecard trackId="finance" items={finance}
        hero={{ value: M_fmtMoney(finOverdue || 94000), label: 'overdue · longest 31d' }}
        onOpen={onOpenPipeline} onAct={onAct} />

      <div className="sectionLabel">
        <span>Recent activity</span>
        <a className="more" href="#">See all</a>
      </div>
      <div className="activityCard">
        {[
          { track: 'sales',      icon: 'mail',    actor: 'Eva de Vries',     verb: 'sent follow-up to', target: 'Rotterdam Logistics', when: '16 min ago' },
          { track: 'operations', icon: 'truck',   actor: 'Tom Janssens',     verb: 'confirmed delivery for', target: 'Köln Last Mile · VAN-4421', when: '2 hours ago' },
          { track: 'finance',    icon: 'receipt', actor: 'Ines Vandeput',    verb: 'approved PEPPOL invoice for', target: 'MAN Trucks · €87.5k', when: 'Yesterday' },
          { track: 'workshop',   icon: 'check',   actor: 'Lars Pieters',     verb: 'released for pickup', target: 'VAN-3344 · Rotterdam', when: 'Yesterday' },
        ].map((a, i) => (
          <div key={i} className="activityRow">
            <div className="activityIcon" data-track={a.track}>
              <Icon name={a.icon} size={14} strokeWidth={2} />
            </div>
            <div className="activityBody">
              <div className="t">
                <span className="actor">{a.actor}</span>{' '}
                <span>{a.verb}</span>{' '}
                <span className="target">{a.target}</span>
              </div>
              <div className="meta">{a.when}</div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
};

/* ---------- Pipeline detail screen ---------- */

const stagesFor = (id) => ({
  sales: SALES_STAGES, operations: OPS_STAGES,
  workshop: WORKSHOP_STAGES, finance: FINANCE_STAGES,
})[id];

const PipelineScreen = ({ trackId, items, onBack, onAct, onOpenItem }) => {
  const [filter, setFilter] = React.useState(null);
  const stages = stagesFor(trackId);
  const counts = buildStageCounts(items, stages);
  const visible = filter ? items.filter(i => i.stageId === filter) : items;
  const present = activeStages(items, stages);
  const activeIdx = stages.findIndex(s => s.id === present[present.length - 1]);

  return (
    <>
      <div className="subHeader">
        <button className="backBtn" onClick={onBack}>
          <Icon name="chevron" size={16} strokeWidth={2.5} style={{ transform: 'rotate(90deg)' }} />
          Back
        </button>
        <h1>{TRACK_LABEL_M[trackId]}</h1>
      </div>

      <div className="subTitle">
        <h2>{items.length} {items.length === 1 ? 'item' : 'items'}</h2>
        <div className="s">Owned by {TRACK_OWNER_M[trackId]}</div>
      </div>

      <div className="stageRailM">
        {stages.map((s, i) => {
          const count = counts[s.id];
          let state = 'locked';
          if (i < activeIdx) state = 'done';
          else if (i === activeIdx || present.includes(s.id) || count > 0) state = 'active';
          const filtered = filter === s.id;
          return (
            <button key={s.id} className={`stageM ${state} ${filtered ? 'filtered' : ''}`}
                    onClick={() => count > 0 && setFilter(filtered ? null : s.id)}>
              <span className="dot" />
              <span>{s.label}</span>
              {count > 0 && <span className="ct">{count}</span>}
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <div className="previewEmptyM">
          <Icon name="filter" size={14} /> No items at this stage right now.
          <div style={{ marginTop: 8 }}>
            <button className="btnSecondary" onClick={() => setFilter(null)}>Clear filter</button>
          </div>
        </div>
      ) : (
        visible.map(item => (
          <div key={item.id} className="pdCard" data-status={item.status}>
            <div className="pdHead">
              <div className="pdMain">
                <div className="pdBadges">
                  <span className="kindBadge" data-kind={item.type}>{item.type}</span>
                </div>
                <div className="pdName">{item.customer}</div>
                <div className="pdSub">
                  {item.vehicle && <span className="plate">{item.vehicle}</span>}
                  <span>{item.sub}</span>
                </div>
              </div>
              {item.value != null && (
                <div className="pdValue">
                  <div>{M_fmtMoney(item.value)}</div>
                  <div className="vSub">{item.type === 'INVOICE' || item.type === 'SUPPLIER' ? 'invoice' : 'contract'}</div>
                </div>
              )}
            </div>
            <div className="pdRow">
              <span>{item.stageName}</span>
              <span className={`daysChipM ${item.status === 'red' ? 'red' : item.status === 'amber' ? 'amber' : 'green'}`}>
                <Icon name="clock" size={11} strokeWidth={2} />
                {item.daysLabel || `${item.days}d`}
              </span>
            </div>
            <div className="pdActions">
              <button className={`btnPrimary full ${item.status === 'red' ? 'attention' : ''}`}
                      onClick={() => onAct(item)}>
                {item.cta}
                <Icon name="arrow" size={11} strokeWidth={2.5} />
              </button>
              {item.vehicle && (
                <button className="btnSecondary" onClick={() => onOpenItem(item)}>
                  <Icon name="timeline" size={13} />
                </button>
              )}
            </div>
          </div>
        ))
      )}
      <div style={{ height: 30 }} />
    </>
  );
};

window.MobileScorecard = MobileScorecard;
window.SnapshotCard = SnapshotCard;
window.TodayScreen = TodayScreen;
window.PipelineScreen = PipelineScreen;
window.M_fmtMoney = M_fmtMoney;
window.TRACK_LABEL_M = TRACK_LABEL_M;
window.TRACK_COLOR_M = TRACK_COLOR_M;
window.TRACK_OWNER_M = TRACK_OWNER_M;
window.stagesFor = stagesFor;
