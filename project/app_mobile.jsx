/* Mobile app — part 3: ActionFlow sheet, TabBar, main App */

/* ---------- Action flow sheet (mobile bottom sheet) ---------- */

const M_FOLLOWUP_TEMPLATES = [
  { id: 'gentle',   label: 'Gentle nudge',   description: 'Friendly check-in. Default for offers that have gone quiet.', tag: 'Default' },
  { id: 'status',   label: 'Status check',   description: 'Asks for a timeline. Use after >10 days of silence.' },
  { id: 'director', label: 'Escalate',       description: 'CC procurement director. Reserved for renewals at risk.', tag: 'High' },
];

const buildMobileFlow = (item) => {
  // Brussels Energy "Mark contract signed" — cascade demo
  if (item.id === 's5' && item.stageId !== 'signed') {
    return {
      kind: 'Cascades to 3 tracks',
      title: 'Sign contract',
      subtitle: `${item.customer} · ${M_fmtMoney(item.value)} · 78 vehicles`,
      steps: [
        { label: 'Review',
          render: () => (
            <>
              <p className="sheetLead">All signature blocks received. Final confirmation before the cascade fires.</p>
              <div className="summaryCardM">
                <div className="summaryRowM"><span className="k">Contract value</span><span className="v">{M_fmtMoney(item.value)}</span></div>
                <div className="summaryRowM"><span className="k">Term</span><span className="v">60 months</span></div>
                <div className="summaryRowM"><span className="k">Vehicles</span><span className="v">78 mixed</span></div>
                <div className="summaryRowM"><span className="k">Signed by</span><span className="v">Anke Vermeulen · COO</span></div>
                <div className="summaryRowM"><span className="k">Signed at</span><span className="v">28 May · 09:14 CET</span></div>
              </div>
            </>
          ) },
        { label: 'Cascade',
          render: () => (
            <>
              <p className="sheetLead">Three downstream actions will fire automatically. All reversible from the audit log.</p>
              <div className="cascadeCardM">
                <span className="badge" data-track="operations">ops</span>
                <div>
                  <div className="t">"Vehicle ordered · 78 vehicles"</div>
                  <div className="d">Assigned to Tom Janssens · supplier confirm in 5 working days</div>
                </div>
              </div>
              <div className="cascadeCardM">
                <span className="badge" data-track="finance">finance</span>
                <div>
                  <div className="t">"Invoice to create · {M_fmtMoney(item.value)}"</div>
                  <div className="d">Assigned to Ines Vandeput · master invoice for first delivery</div>
                </div>
              </div>
              <div className="cascadeCardM">
                <span className="badge" data-track="sales">portal</span>
                <div>
                  <div className="t">Customer portal updated</div>
                  <div className="d">"Order confirmed — delivery dates being coordinated"</div>
                </div>
              </div>
            </>
          ) },
      ],
      confirmLabel: 'Confirm & cascade',
      successTitle: 'Contract signed — cascade fired',
      successDetail: 'Three downstream actions created. Watch Operations and Finance scorecards back on Today.',
      onPatch: () => ({ stageId: 'signed', stageName: 'Signed', status: 'green', daysLabel: 'signed now', cta: 'Open in CRM' }),
      cascade: 'brussels',
    };
  }
  // Dunning
  if (item.id === 'f2') {
    return {
      kind: 'Finance · overdue',
      title: 'Send dunning notice',
      subtitle: `${item.customer} · ${M_fmtMoney(item.value)} · ${item.daysLabel}`,
      initialState: { level: 'formal' },
      steps: [
        { label: 'Escalation',
          render: ({ state, setState }) => (
            <>
              <p className="sheetLead">Third overdue notice on this invoice. Formal is recommended at 31+ days.</p>
              <div className="choiceListM">
                {[
                  { id: 'reminder', label: 'Polite reminder', description: 'Already sent twice', tag: 'Sent ×2' },
                  { id: 'formal',   label: 'Formal notice',   description: '14-day pay-or-escalate', tag: 'Recommended' },
                  { id: 'collections', label: 'Hand off to collections', description: 'Removes the receivable from the dashboard' },
                ].map(o => (
                  <div key={o.id} className={`choiceCardM ${state.level === o.id ? 'selected' : ''}`}
                       onClick={() => setState(s => ({ ...s, level: o.id }))}>
                    <span className="rad" />
                    <div>
                      <div className="ct">{o.label}</div>
                      <div className="cd">{o.description}</div>
                    </div>
                    {o.tag && <span className="tg">{o.tag}</span>}
                  </div>
                ))}
              </div>
            </>
          ) },
        { label: 'Confirm',
          render: ({ state }) => (
            <>
              <p className="sheetLead">Sending via PEPPOL + email · logged to the audit trail.</p>
              <div className="summaryCardM">
                <div className="summaryRowM"><span className="k">Recipient</span><span className="v">ap@munichfoods.com</span></div>
                <div className="summaryRowM"><span className="k">Level</span><span className="v">{state.level === 'formal' ? 'Formal notice' : state.level === 'collections' ? 'Collections' : 'Polite reminder'}</span></div>
                <div className="summaryRowM"><span className="k">Amount</span><span className="v">{M_fmtMoney(item.value)}</span></div>
                <div className="summaryRowM"><span className="k">Status after</span><span className="v">{state.level === 'collections' ? 'Handed off' : 'Notice sent'}</span></div>
              </div>
            </>
          ) },
      ],
      confirmLabel: 'Send notice',
      successTitle: 'Notice sent',
      successDetail: 'Logged to audit · counter resets.',
      onPatch: (s) => s.level === 'collections'
        ? { stageId: 'paid', stageName: 'In collections', daysLabel: 'handed off' }
        : { daysLabel: 'notice sent', cta: 'Awaiting response' },
    };
  }
  // PEPPOL approval
  if (item.id === 'w4') {
    return {
      kind: 'Workshop · supplier invoice',
      title: 'Approve PEPPOL invoice',
      subtitle: `Bosch Mobility · ${M_fmtMoney(item.value)}`,
      steps: [
        { label: 'Match',
          render: () => (
            <>
              <p className="sheetLead">Auto-matched against workshop order WO-2026-118. 3-way match clean.</p>
              <div className="summaryCardM">
                <div className="summaryRowM"><span className="k">Supplier</span><span className="v">Bosch Mobility</span></div>
                <div className="summaryRowM"><span className="k">Invoice ref</span><span className="v">BMS-2026-04421</span></div>
                <div className="summaryRowM"><span className="k">Matched to</span><span className="v">WO-2026-118 · TRK-7702</span></div>
                <div className="summaryRowM"><span className="k">Auto-match</span><span className="v" style={{ color: 'var(--status-green)' }}>98% · 3-way clean</span></div>
                <div className="summaryRowM"><span className="k">Net</span><span className="v">{M_fmtMoney(item.value)} incl. VAT</span></div>
              </div>
            </>
          ) },
        { label: 'Approve',
          render: () => (
            <p className="sheetLead">Approving will route this invoice to Finance for scheduled payment under net-30 terms.</p>
          ) },
      ],
      confirmLabel: 'Approve & route',
      successTitle: 'Approved',
      successDetail: 'Hand-off to Finance complete. Payment scheduled for 27 Jun.',
      onPatch: () => ({ stageName: 'Invoice approved', daysLabel: 'approved now', cta: 'View in Finance' }),
    };
  }
  // Default: follow-up email
  return {
    kind: 'Sales action',
    title: `Send follow-up`,
    subtitle: `${item.customer} · ${item.stageName} · ${item.daysLabel || item.days + 'd'}`,
    initialState: { template: 'gentle' },
    steps: [
      { label: 'Template',
        render: ({ state, setState }) => (
          <>
            <p className="sheetLead">Pick a tone — drafted in the customer's primary language and logged to the CRM thread.</p>
            <div className="choiceListM">
              {M_FOLLOWUP_TEMPLATES.map(o => (
                <div key={o.id} className={`choiceCardM ${state.template === o.id ? 'selected' : ''}`}
                     onClick={() => setState(s => ({ ...s, template: o.id }))}>
                  <span className="rad" />
                  <div>
                    <div className="ct">{o.label}</div>
                    <div className="cd">{o.description}</div>
                  </div>
                  {o.tag && <span className="tg">{o.tag}</span>}
                </div>
              ))}
            </div>
          </>
        ) },
      { label: 'Confirm',
        render: ({ state }) => (
          <>
            <p className="sheetLead">Email logged to CRM thread on send. Card counter resets to 0 days.</p>
            <div className="summaryCardM">
              <div className="summaryRowM"><span className="k">To</span><span className="v">procurement</span></div>
              <div className="summaryRowM"><span className="k">Template</span><span className="v">{M_FOLLOWUP_TEMPLATES.find(t => t.id === state.template).label}</span></div>
              <div className="summaryRowM"><span className="k">After send</span><span className="v">Counter resets · amber</span></div>
            </div>
          </>
        ) },
    ],
    confirmLabel: 'Send email',
    successTitle: 'Follow-up sent',
    successDetail: 'CRM thread updated · card flipped amber.',
    onPatch: () => ({ status: 'amber', daysLabel: 'just now', days: 0 }),
  };
};

const ActionSheet = ({ flow, onClose, onComplete }) => {
  const [stepIdx, setStepIdx] = React.useState(0);
  const [state, setState] = React.useState(flow.initialState || {});
  const [completed, setCompleted] = React.useState(false);

  const step = flow.steps[stepIdx];
  const isLast = stepIdx === flow.steps.length - 1;

  const next = () => {
    if (isLast) {
      setCompleted(true);
      setTimeout(() => { onComplete(state); onClose(); }, 1600);
    } else {
      setStepIdx(s => s + 1);
    }
  };
  const back = () => setStepIdx(s => Math.max(0, s - 1));

  return (
    <div className="sheetOverlay" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheetGrip" />
        <div className="sheetHead">
          <div className="kind">{flow.kind}</div>
          <h2>{flow.title}</h2>
          <div className="sub">{flow.subtitle}</div>
        </div>
        {!completed && (
          <div className="sheetSteps">
            {flow.steps.map((s, i) => (
              <React.Fragment key={s.label}>
                <span className={`stepM ${i === stepIdx ? 'active' : i < stepIdx ? 'done' : ''}`}>
                  <span className="num">{i < stepIdx ? <Icon name="check" size={9} strokeWidth={3} /> : i + 1}</span>
                  <span>{s.label}</span>
                </span>
                {i < flow.steps.length - 1 && <span className={`stepLineM ${i < stepIdx ? 'done' : ''}`} />}
              </React.Fragment>
            ))}
          </div>
        )}
        <div className="sheetBody">
          {completed ? (
            <div className="sheetSuccess">
              <div className="successMarkM"><Icon name="check" size={28} strokeWidth={2.5} /></div>
              <h3>{flow.successTitle}</h3>
              <p>{flow.successDetail}</p>
            </div>
          ) : (
            step.render({ state, setState, next, back, item: flow.item })
          )}
        </div>
        {!completed && (
          <div className="sheetFoot">
            <button className="btnSecondary" style={{ flex: 1 }}
                    onClick={stepIdx > 0 ? back : onClose}>
              {stepIdx > 0 ? 'Back' : 'Cancel'}
            </button>
            <button className="btnPrimary" style={{ flex: 1.6, justifyContent: 'center' }} onClick={next}>
              {isLast ? flow.confirmLabel : 'Continue'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

/* ---------- Bottom tab bar ---------- */

const TabBar = ({ tab, setTab }) => {
  const tabs = [
    { id: 'today',    icon: 'eye',      label: 'Today' },
    { id: 'vehicles', icon: 'truck',    label: 'Vehicles' },
    { id: 'more',     icon: 'settings', label: 'More' },
  ];
  return (
    <div className="tabBar">
      {tabs.map(t => (
        <button key={t.id} className={`tabBtn ${tab === t.id ? 'active' : ''}`}
                onClick={() => setTab(t.id)}>
          <Icon name={t.icon} size={20} strokeWidth={1.8} />
          <span className="tlabel">{t.label}</span>
        </button>
      ))}
    </div>
  );
};

/* ---------- Main mobile app ---------- */

const MobileApp = () => {
  const [tab, setTab] = React.useState('today');
  const [pipeline, setPipeline] = React.useState(null);
  const [subScreen, setSubScreen] = React.useState(null);
  const [vehicleDetail, setVehicleDetail] = React.useState(null);
  const [activeFlow, setActiveFlow] = React.useState(null);
  const [toast, setToast] = React.useState(null);

  const [sales, setSales] = React.useState(SEED_SALES);
  const [ops, setOps] = React.useState(SEED_OPS);
  const [workshop, setWorkshop] = React.useState(SEED_WORKSHOP);
  const [finance, setFinance] = React.useState(SEED_FINANCE);

  const trackItems = { sales, operations: ops, workshop, finance };
  const setterFor = (id) => sales.some(s => s.id === id) ? setSales
                          : ops.some(s => s.id === id) ? setOps
                          : workshop.some(s => s.id === id) ? setWorkshop
                          : finance.some(s => s.id === id) ? setFinance : null;

  const openFlow = (item) => {
    const flow = buildMobileFlow(item);
    flow.item = item;
    setActiveFlow({
      ...flow,
      onComplete: (finalState) => {
        const patch = flow.onPatch ? flow.onPatch(finalState, item) : null;
        if (patch) {
          const setter = setterFor(item.id);
          if (setter) setter(prev => prev.map(x => x.id === item.id ? { ...x, ...patch } : x));
        }
        if (flow.cascade === 'brussels') {
          // Fire Operations + Finance cascade
          const newOps = {
            id: 'o1', customer: 'Brussels Energy SA', vehicle: 'Fleet · 78 vehicles',
            type: 'DELIVERY', sub: 'Auto-triggered · 5-year FSL',
            stageId: 'ordered', stageName: 'Vehicle ordered',
            days: 0, daysLabel: 'day 0 of 90', owner: 'Tom Janssens',
            status: 'green', cta: 'Confirm with supplier', sources: ['API','Talend']
          };
          const newFin = {
            id: 'f1', customer: 'Brussels Energy SA', value: 2460000, type: 'INVOICE',
            sub: 'Master invoice · auto', stageId: 'to_make', stageName: 'To create',
            days: 0, daysLabel: 'just now', owner: 'Ines Vandeput',
            status: 'green', cta: 'Generate invoice', sources: ['API']
          };
          setOps(prev => prev.find(o => o.id === 'o1') ? prev : [newOps, ...prev]);
          setFinance(prev => prev.find(f => f.id === 'f1') ? prev : [newFin, ...prev]);
          setToast({
            title: 'Cascade fired',
            lines: ['Ops · new "Vehicle ordered" · 78 veh.', 'Finance · €2.46M invoice to create'],
          });
          setTimeout(() => setToast(null), 5000);
        }
      }
    });
  };

  const onBackToTab = () => { setPipeline(null); setSubScreen(null); setVehicleDetail(null); };

  let screen;
  if (vehicleDetail) {
    // Vehicle detail — show the timeline data
    const data = VEHICLE_TIMELINE; // single demo timeline
    screen = (
      <SubScreen title={vehicleDetail.plate}
                 sub={`${vehicleDetail.customer} · ${vehicleDetail.model}`}
                 onBack={onBackToTab}>
        <div style={{ padding: '0 16px 24px' }}>
          <div className="signedBanner">
            <Icon name="timeline" size={13} />
            One vehicle, one timeline — full lifecycle across all four tracks
          </div>
          <div style={{ position: 'relative', paddingLeft: 22 }}>
            <div style={{ position: 'absolute', left: 7, top: 6, bottom: 6, width: 1, background: 'var(--border-strong)' }} />
            {data.events.map((ev, i) => (
              <div key={i} style={{ position: 'relative', paddingBottom: 18 }}>
                <div style={{
                  position: 'absolute', left: -19, top: 5,
                  width: 13, height: 13, borderRadius: 999,
                  background: ev.state === 'done' ? 'var(--track-workshop)'
                            : ev.state === 'active' ? 'var(--brand)' : 'white',
                  border: '2px solid ' + (ev.state === 'done' ? 'var(--track-workshop)'
                                       : ev.state === 'active' ? 'var(--brand)' : 'var(--border-strong)'),
                  boxShadow: ev.state === 'active' ? '0 0 0 4px var(--brand-tint)' : 'none',
                }} />
                <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 2 }}>
                  <span className="badge" style={{
                    background: `var(--track-${ev.track === 'operations' ? 'ops' : ev.track}-tint)`,
                    color: `var(--track-${ev.track === 'operations' ? 'ops' : ev.track})`,
                    fontSize: 9, fontWeight: 600, padding: '1px 6px', borderRadius: 3,
                    letterSpacing: '0.05em', textTransform: 'uppercase'
                  }}>{ev.track}</span>
                  <span>{ev.date}</span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{ev.stage}</div>
                <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 3 }}>{ev.detail}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 4 }}>{ev.owner}</div>
              </div>
            ))}
          </div>
        </div>
      </SubScreen>
    );
  } else if (pipeline) {
    screen = <PipelineScreen trackId={pipeline} items={trackItems[pipeline]}
                             onBack={onBackToTab} onAct={openFlow}
                             onOpenItem={() => setVehicleDetail({ plate: 'BES-2026', customer: 'Brussels Energy SA', model: 'Fleet master' })} />;
  } else if (subScreen === 'portal') {
    screen = <PortalScreenM onBack={onBackToTab} />;
  } else if (subScreen === 'integrations') {
    screen = <IntegrationsScreenM onBack={onBackToTab} />;
  } else if (subScreen === 'audit') {
    screen = <AuditScreenM onBack={onBackToTab} />;
  } else if (subScreen === 'settings') {
    screen = <SettingsScreenM onBack={onBackToTab} />;
  } else if (subScreen === 'messages') {
    screen = <MessagesScreenM onBack={onBackToTab} />;
  } else if (tab === 'today') {
    screen = <TodayScreen state={{ sales, ops, workshop, finance }}
                         onOpenPipeline={(id) => setPipeline(id)} onAct={openFlow} />;
  } else if (tab === 'vehicles') {
    screen = <VehiclesScreen onOpenVehicle={(v) => setVehicleDetail(v)} />;
  } else if (tab === 'more') {
    screen = <MoreScreen onOpen={setSubScreen} />;
  }

  return (
    <div className="mobApp" style={{ paddingTop: 54 }}>
      <div className="mobScroll">{screen}</div>
      <TabBar tab={tab} setTab={(t) => { setTab(t); setPipeline(null); setSubScreen(null); setVehicleDetail(null); }} />
      {activeFlow && (
        <ActionSheet flow={activeFlow} onClose={() => setActiveFlow(null)}
                     onComplete={activeFlow.onComplete} />
      )}
      {toast && (
        <div className="toastM">
          <span className="toastDotM" />
          <div>
            <div className="ttl">{toast.title}</div>
            {toast.lines.map((l, i) => <div key={i} className="lns">{l}</div>)}
          </div>
        </div>
      )}
    </div>
  );
};

// Render into the IOSDevice frame
const MobileRoot = () => (
  <div style={{
    minHeight: '100vh', display: 'grid', placeItems: 'center',
    background: '#1a1a1a', padding: '40px 0',
  }}>
    <IOSDevice>
      <MobileApp />
    </IOSDevice>
  </div>
);

ReactDOM.createRoot(document.getElementById('root')).render(<MobileRoot />);
