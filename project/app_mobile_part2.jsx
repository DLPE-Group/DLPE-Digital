/* Mobile app — part 2: Vehicles, More, ActionFlow sheet, TabBar, main App */

/* ---------- Vehicles screen ---------- */

const VehiclesScreen = ({ onOpenVehicle }) => {
  const [filter, setFilter] = React.useState('all');
  const [query, setQuery] = React.useState('');

  const vehicles = VEHICLE_DATA.filter(v => {
    if (filter === 'service' && v.status !== 'warn') return false;
    if (filter === 'workshop' && v.currentTrack !== 'workshop') return false;
    if (filter === 'late' && v.status !== 'late') return false;
    if (query && !`${v.plate} ${v.customer} ${v.model}`.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  return (
    <>
      <header className="mobHeader">
        <div className="h-text">
          <h1>Vehicles</h1>
          <div className="h-sub">487 vehicles · 11 active operators</div>
        </div>
      </header>

      <div className="searchBarM">
        <Icon name="search" size={15} />
        <input placeholder="Search plate, customer, model…"
               value={query} onChange={e => setQuery(e.target.value)} />
      </div>

      <div className="filterChipsM">
        {[
          ['all', `All · ${VEHICLE_DATA.length}`],
          ['service', `Service due · ${VEHICLE_DATA.filter(v => v.status === 'warn').length}`],
          ['workshop', `In workshop · ${VEHICLE_DATA.filter(v => v.currentTrack === 'workshop').length}`],
          ['late', `Slipping · ${VEHICLE_DATA.filter(v => v.status === 'late').length}`],
        ].map(([id, label]) => (
          <button key={id} className={`filterChipM ${filter === id ? 'active' : ''}`}
                  onClick={() => setFilter(id)}>{label}</button>
        ))}
      </div>

      <div className="vList">
        {vehicles.map(v => (
          <div key={v.plate} className="vRow" onClick={() => onOpenVehicle(v)}>
            <span className="plateBig">{v.plate}</span>
            <div>
              <div className="vCust">{v.customer}</div>
              <div className="vMod">{v.model}</div>
              <div className="vProgressMini">
                {Array.from({ length: 8 }).map((_, i) => (
                  <i key={i} className={i < v.stageIdx ? 'done' : i === v.stageIdx ? 'active' : ''} />
                ))}
              </div>
            </div>
            <span className={`statusPillM ${v.status}`}>
              <span className="d" />
              {v.statusLabel}
            </span>
          </div>
        ))}

        {vehicles.length === 0 && (
          <div className="previewEmptyM">
            No vehicles match — try clearing filters.
            <div style={{ marginTop: 8 }}>
              <button className="btnSecondary" onClick={() => { setFilter('all'); setQuery(''); }}>Reset</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

/* ---------- More screen ---------- */

const MoreRow = ({ icon, iconBg, iconColor, label, meta, onClick }) => (
  <div className="moreRow" onClick={onClick}>
    <div className="moreIcon" style={{ background: iconBg, color: iconColor }}>
      <Icon name={icon} size={16} strokeWidth={2} />
    </div>
    <div className="label">{label}</div>
    {meta && <span className="meta">{meta}</span>}
    <span className="chev"><Icon name="chevronRight" size={14} /></span>
  </div>
);

const MoreScreen = ({ onOpen }) => (
  <>
    <header className="mobHeader">
      <div className="h-text">
        <h1>More</h1>
        <div className="h-sub">System views and customer-facing</div>
      </div>
    </header>

    <div className="sectionLabel">Customer-facing</div>
    <div className="moreCard">
      <MoreRow icon="user" iconBg="var(--track-sales-tint)" iconColor="var(--track-sales)"
               label="Customer portal" meta="Rotterdam Logistics" onClick={() => onOpen('portal')} />
      <MoreRow icon="mail" iconBg="var(--brand-tint)" iconColor="var(--brand)"
               label="Messages" meta="3 unread" onClick={() => onOpen('messages')} />
    </div>

    <div className="sectionLabel">System</div>
    <div className="moreCard">
      <MoreRow icon="bolt" iconBg="var(--status-amber-bg)" iconColor="var(--status-amber)"
               label="Integrations" meta="9 · 1 degraded" onClick={() => onOpen('integrations')} />
      <MoreRow icon="document" iconBg="var(--bg-muted)" iconColor="var(--text-secondary)"
               label="Audit log" meta="Today" onClick={() => onOpen('audit')} />
      <MoreRow icon="settings" iconBg="var(--bg-muted)" iconColor="var(--text-secondary)"
               label="Settings" onClick={() => onOpen('settings')} />
    </div>

    <div className="sectionLabel">Account</div>
    <div className="moreCard">
      <MoreRow icon="user" iconBg="var(--brand-tint)" iconColor="var(--brand)"
               label="Markus Weber" meta="Country manager · Benelux" />
      <MoreRow icon="document" iconBg="var(--bg-muted)" iconColor="var(--text-secondary)"
               label="Help & feedback" />
    </div>

    <div style={{ textAlign: 'center', fontSize: 11.5, color: 'var(--text-quiet)',
                  padding: '20px 16px 30px' }}>
      Intelligence Layer · v0.4 demo · all data is synthetic
    </div>
  </>
);

/* ---------- Stub sub-screens (Portal / Audit / Settings / Integrations) ---------- */

const SubScreen = ({ title, sub, onBack, children }) => (
  <>
    <div className="subHeader">
      <button className="backBtn" onClick={onBack}>
        <Icon name="chevron" size={16} strokeWidth={2.5} style={{ transform: 'rotate(90deg)' }} />
        More
      </button>
      <h1>{title}</h1>
    </div>
    <div className="subTitle">
      <h2>{title}</h2>
      {sub && <div className="s">{sub}</div>}
    </div>
    {children}
  </>
);

const IntegrationsScreenM = ({ onBack }) => (
  <SubScreen title="Integrations" sub="All systems feeding the DataSource" onBack={onBack}>
    <div style={{ padding: '0 16px 24px' }}>
      {INTEGRATIONS.slice(0, 6).map(it => (
        <div key={it.id} style={{ background: 'white', borderRadius: 12, padding: 14, marginBottom: 8, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ width: 38, height: 38, borderRadius: 8, background: 'var(--bg-muted)', display: 'grid', placeItems: 'center', color: 'var(--text-secondary)', fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 600 }}>{it.logo}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14.5, fontWeight: 600 }}>{it.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{it.kind}</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 6 }}>
              Sync · {it.lastSync} &middot; {it.throughput}
            </div>
          </div>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '3px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600,
            background: it.status === 'healthy' ? 'var(--status-green-bg)' :
                        it.status === 'degraded' ? 'var(--status-amber-bg)' : 'var(--bg-muted)',
            color: it.status === 'healthy' ? 'var(--status-green)' :
                   it.status === 'degraded' ? 'var(--status-amber)' : 'var(--text-tertiary)',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: 999,
              background: it.status === 'healthy' ? 'var(--status-green)' :
                          it.status === 'degraded' ? 'var(--status-amber)' : 'var(--text-quiet)' }} />
            {it.status}
          </span>
        </div>
      ))}
    </div>
  </SubScreen>
);

const AuditScreenM = ({ onBack }) => (
  <SubScreen title="Audit log" sub="Every action with cascades" onBack={onBack}>
    <div style={{ padding: '0 16px 24px' }}>
      {AUDIT.slice(0, 8).map(a => (
        <div key={a.id} style={{ background: 'white', borderRadius: 12, padding: 12, marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span className="kindBadge" data-kind="INVOICE"
              style={{ background: `var(--track-${a.track === 'operations' ? 'ops' : a.track}-tint)`,
                       color: `var(--track-${a.track === 'operations' ? 'ops' : a.track})` }}>
              {a.track}
            </span>
            <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>{a.time}</span>
          </div>
          <div style={{ fontSize: 13.5, lineHeight: 1.4 }}>
            <strong>{a.actor}</strong> {a.verb} <strong>{a.target}</strong>
          </div>
          {a.cascades && (
            <div style={{ fontSize: 12, color: 'var(--brand)', marginTop: 6, fontWeight: 500 }}>
              triggered {a.cascades.length} downstream actions ›
            </div>
          )}
        </div>
      ))}
    </div>
  </SubScreen>
);

const SettingsScreenM = ({ onBack }) => {
  const [toggles, setToggles] = React.useState({ enforceLocks: true, peppol: true, email: true, digest: true });
  const flip = k => setToggles(t => ({ ...t, [k]: !t[k] }));
  return (
    <SubScreen title="Settings" sub="Config-driven · per-account" onBack={onBack}>
      <div style={{ padding: '0 16px 24px' }}>
        <div style={{ fontSize: 11.5, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-tertiary)', letterSpacing: '0.05em', padding: '8px 4px' }}>Notifications</div>
        <div className="moreCard">
          {[
            ['enforceLocks', 'Enforce stage locks', 'Block users from advancing past locked stages'],
            ['peppol', 'PEPPOL outbound preferred', 'Default to PEPPOL e-invoicing over email PDF'],
            ['email', 'Email notifications', 'Receive emails for red items on your tracks'],
            ['digest', 'Daily morning digest', 'Snapshot emailed at 07:30'],
          ].map(([k, label, desc]) => (
            <div key={k} className="moreRow" onClick={() => flip(k)}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14.5 }}>{label}</div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{desc}</div>
              </div>
              <div style={{
                width: 44, height: 26, borderRadius: 999,
                background: toggles[k] ? 'var(--status-green)' : 'var(--border-strong)',
                position: 'relative', flexShrink: 0, transition: 'background .15s',
              }}>
                <div style={{
                  position: 'absolute', top: 2, left: 2,
                  width: 22, height: 22, borderRadius: 999, background: 'white',
                  transform: toggles[k] ? 'translateX(18px)' : 'translateX(0)',
                  transition: 'transform .15s',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                }} />
              </div>
            </div>
          ))}
        </div>

        <div style={{ fontSize: 11.5, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-tertiary)', letterSpacing: '0.05em', padding: '16px 4px 8px' }}>Workspace</div>
        <div className="moreCard">
          <div className="moreRow"><div style={{ flex: 1 }}>Country scope</div><span className="meta">BE · NL · LU · DE</span></div>
          <div className="moreRow"><div style={{ flex: 1 }}>Currency</div><span className="meta">EUR</span></div>
          <div className="moreRow"><div style={{ flex: 1 }}>Languages</div><span className="meta">EN · NL · FR · DE</span></div>
          <div className="moreRow"><div style={{ flex: 1 }}>Timezone</div><span className="meta">Europe/Brussels</span></div>
        </div>
      </div>
    </SubScreen>
  );
};

const PortalScreenM = ({ onBack }) => {
  const data = PORTAL_FLEET;
  return (
    <SubScreen title="Customer portal" sub={data.operator} onBack={onBack}>
      <div style={{ padding: '0 16px 24px' }}>
        <div className="signedBanner">
          <Icon name="user" size={13} strokeWidth={2} />
          Signed in as fleet manager — {data.contact.split('·')[0].trim()}
        </div>

        <div style={{ fontSize: 11.5, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-tertiary)', letterSpacing: '0.05em', padding: '8px 4px' }}>My vehicles</div>
        {data.vehicles.map((v, i) => (
          <div key={i} className="vRow" style={{ background: 'white', marginBottom: 8 }}>
            <span className="plateBig">{v.plate}</span>
            <div>
              <div className="vCust">{v.model}</div>
              <div className="vMod">{v.note}</div>
            </div>
            <span className={`statusPillM ${v.status}`}>
              <span className="d" />
              {v.statusLabel}
            </span>
          </div>
        ))}

        <div style={{ fontSize: 11.5, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-tertiary)', letterSpacing: '0.05em', padding: '16px 4px 8px' }}>Open invoices</div>
        <div className="moreCard">
          {data.invoices.map((inv, i) => (
            <div key={i} className="moreRow" style={{ cursor: 'default' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{inv.ref}</div>
                <div style={{ fontSize: 12, color: inv.status === 'late' ? 'var(--status-red)' : 'var(--text-tertiary)', marginTop: 2 }}>
                  {inv.due}
                </div>
              </div>
              <span style={{ fontWeight: 600 }}>{M_fmtMoney(inv.value)}</span>
            </div>
          ))}
        </div>

        <div style={{ fontSize: 11.5, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-tertiary)', letterSpacing: '0.05em', padding: '16px 4px 8px' }}>Messages from leasing team</div>
        <div className="moreCard">
          {data.messages.map((m, i) => (
            <div key={i} style={{ padding: '14px 16px', borderBottom: i < data.messages.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginBottom: 4 }}>{m.when}</div>
              <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.45 }}>{m.body}</div>
            </div>
          ))}
        </div>
      </div>
    </SubScreen>
  );
};

const MessagesScreenM = ({ onBack }) => (
  <SubScreen title="Messages" sub="Inbox · outbound + inbound" onBack={onBack}>
    <div style={{ padding: '0 16px 24px' }}>
      {[
        { from: 'Brussels Energy SA', subject: 'RE: Fleet refresh — counter-signed', when: '2 hrs', unread: true, preview: 'Hi Markus, the contract has been counter-signed and uploaded to your portal.' },
        { from: 'Rotterdam Logistics', subject: 'Question about VAN-3344 pickup', when: '6 hrs', unread: true, preview: 'Can you confirm what time the replacement van will be collected on Friday?' },
        { from: 'Eindhoven Construction', subject: 'Re: Renewal terms', when: 'Yesterday', unread: true, preview: 'We are reviewing the proposed terms internally. Will revert by end of week.' },
        { from: 'Köln Last Mile', subject: 'Delivery date for VAN-4421', when: 'Yesterday', preview: 'Just received notice that the delivery is delayed by 3 days...' },
        { from: 'System · PEPPOL', subject: 'Invoice received from MAN Trucks', when: 'May 27', preview: 'A new e-invoice has arrived in the inbox.' },
      ].map((m, i) => (
        <div key={i} className="vRow" style={{ gridTemplateColumns: '1fr auto', background: 'white' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {m.unread && <span style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--brand)' }} />}
              <span style={{ fontSize: 14, fontWeight: m.unread ? 700 : 600 }}>{m.from}</span>
            </div>
            <div style={{ fontSize: 13, fontWeight: 500, marginTop: 2 }}>{m.subject}</div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {m.preview}
            </div>
          </div>
          <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>{m.when}</span>
        </div>
      ))}
    </div>
  </SubScreen>
);

window.VehiclesScreen = VehiclesScreen;
window.MoreScreen = MoreScreen;
window.IntegrationsScreenM = IntegrationsScreenM;
window.AuditScreenM = AuditScreenM;
window.SettingsScreenM = SettingsScreenM;
window.PortalScreenM = PortalScreenM;
window.MessagesScreenM = MessagesScreenM;
window.SubScreen = SubScreen;
