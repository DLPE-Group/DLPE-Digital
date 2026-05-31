/* Sample data + components for Integrations, Audit, Settings, Vehicles views */

/* ============================================================
   INTEGRATIONS
   ============================================================ */

const INTEGRATIONS = [
  { id: 'sf', name: 'Salesforce CRM', kind: 'CRM · inbound leads & deal sync',
    direction: 'inbound', logo: 'SF',
    status: 'healthy', lastSync: '2 min ago',
    throughput: '124 leads / day · 38 deals updated',
    latency: 'p95 · 280 ms',
    desc: 'Inbound leads land in the Sales track. Deal stage and contact updates flow both ways for active opportunities.' },
  { id: 'peppol-in', name: 'PEPPOL inbox', kind: 'E-invoicing · AP-NL-002',
    direction: 'inbound', logo: 'PEP',
    status: 'healthy', lastSync: '14 min ago',
    throughput: '23 invoices / day · 412 / month',
    latency: 'real-time · webhook',
    desc: 'Supplier e-invoices arrive here. Auto-matched against purchase order + goods receipt before they reach the workshop or finance.' },
  { id: 'man-api', name: 'MAN Trucks AG', kind: 'Supplier API · order status',
    direction: 'inbound', logo: 'MAN',
    status: 'degraded', lastSync: '47 min ago',
    throughput: '12 order updates / day',
    latency: 'p95 · 4.2 s · elevated',
    desc: 'Order status, expected delivery dates, build configuration confirmations for MAN commercial vehicles.' },
  { id: 'merc-api', name: 'Mercedes-Benz Trucks', kind: 'Supplier API · order status',
    direction: 'inbound', logo: 'MB',
    status: 'healthy', lastSync: '3 min ago',
    throughput: '18 order updates / day',
    latency: 'p95 · 410 ms',
    desc: 'Order and delivery confirmations from Mercedes-Benz commercial vehicles.' },
  { id: 'bosch-api', name: 'Bosch Mobility', kind: 'Supplier API · parts catalogue',
    direction: 'inbound', logo: 'BSH',
    status: 'healthy', lastSync: '8 min ago',
    throughput: '142 parts / day',
    latency: 'p95 · 520 ms',
    desc: 'Parts catalogue, lead times and order confirmations for own-workshop repairs.' },
  { id: 'talend', name: 'Talend ETL', kind: 'Data pipeline · bi-directional',
    direction: 'bi', logo: 'TLD',
    status: 'healthy', lastSync: '12 min ago',
    throughput: '1,240 records / sync · every 15 min',
    latency: 'batch · 15 min',
    desc: 'Cross-system data normalisation. Powers the unified DataSource abstraction the entire dashboard reads from.' },
  { id: 'peppol-out', name: 'PEPPOL access point', kind: 'E-invoicing · outbound',
    direction: 'outbound', logo: 'PEP',
    status: 'healthy', lastSync: '1 hour ago',
    throughput: '187 invoices / month',
    latency: 'real-time',
    desc: 'Outbound customer invoices to fleet operators registered on the PEPPOL network.' },
  { id: 'fin-sys', name: 'Exact Online', kind: 'Accounting · bi-directional',
    direction: 'bi', logo: 'EX',
    status: 'healthy', lastSync: '5 min ago',
    throughput: '210 entries / day',
    latency: 'p95 · 740 ms',
    desc: 'General ledger entries, payment confirmations, supplier payment scheduling.' },
  { id: 'csv-bulk', name: 'Bulk CSV upload', kind: 'Manual import',
    direction: 'inbound', logo: 'CSV',
    status: 'idle', lastSync: '3 days ago',
    throughput: '0 imports today',
    latency: 'on-demand',
    desc: 'Fallback for systems without API access. Used for legacy CRM exports and one-off data loads.' },
];

const IntegrationCard = ({ it }) => (
  <div className={`integrationCard ${it.nango ? 'viaNango' : ''}`}>
    <div className="integrationLogo" style={it.logoColor ? { background: it.logoColor, color: '#fff' } : undefined}>{it.logo}</div>
    <div className="integrationMain">
      <div className="nm">
        {it.name}
        {it.nango && <span className="nangoTag"><span className="ng">N</span> via Nango</span>}
        {it.transforms > 0 && <span className="nangoTag" style={{ marginLeft: 6 }}><span className="ng" style={{ background: 'var(--brand)', fontStyle: 'italic' }}>ƒ</span> {it.transforms} transform{it.transforms === 1 ? '' : 's'}</span>}
      </div>
      <div className="meta">{it.kind}</div>
      <div className="desc">{it.desc}</div>
      <div className="integrationFacts">
        <div><div className="k">Last sync</div><div className="v">{it.lastSync}</div></div>
        <div><div className="k">Latency</div><div className="v">{it.latency}</div></div>
        <div style={{ gridColumn: 'span 2' }}><div className="k">Throughput</div><div className="v">{it.throughput}</div></div>
      </div>
    </div>
    <div className="integrationActions">
      <span className={`intStatus ${it.status}`}><span className="d" />{it.status}</span>
      <button className="miniBtn"><Icon name="refresh" size={11} /> Test</button>
      <button className="miniBtn"><Icon name="document" size={11} /> Logs</button>
      <button className="miniBtn"><Icon name="settings" size={11} /> Config</button>
    </div>
  </div>
);

const CATEGORY_DIRECTION = {
  'CRM': 'inbound',
  'Accounting & Finance': 'bi',
  'ERP & Supply chain': 'bi',
  'Productivity & Comms': 'outbound',
};

const IntegrationsView = () => {
  const [added, setAdded] = React.useState([]);   // connected via Nango this session
  const [nangoOpen, setNangoOpen] = React.useState(false);
  const [mapping, setMapping] = React.useState(null); // provider being AI-mapped

  // Nango finished the connection -> hand off to the AI mapping pass.
  const onConnected = (provider) => { setNangoOpen(false); setMapping(provider); };

  // AI mapping confirmed -> the source now shows up as a live integration.
  const onMapped = (provider, transforms = []) => {
    setMapping(null);
    const tf = transforms.length;
    setAdded(prev => [{
      id: 'nango-' + provider.id,
      name: provider.name,
      kind: `${provider.cat} · ${provider.auth === 'oauth' ? 'OAuth' : 'API key'}`,
      direction: CATEGORY_DIRECTION[provider.cat] || 'inbound',
      logo: provider.mono.toUpperCase(),
      logoColor: provider.color,
      nango: true,
      transforms: tf,
      status: 'healthy',
      lastSync: 'just now',
      throughput: tf ? `initial sync running… · ${tf} transform${tf === 1 ? '' : 's'}` : 'initial sync running…',
      latency: provider.auth === 'oauth' ? 'real-time · OAuth' : 'real-time · API key',
      desc: provider.blurb + ' Auto-mapped onto the unified DataSource by the Intelligence Layer'
        + (tf ? `, with ${tf} prompt-defined transform${tf === 1 ? '' : 's'}.` : '.'),
    }, ...prev]);
  };

  const all = [...added, ...INTEGRATIONS];
  const total = all.length;
  const healthy = all.filter(i => i.status === 'healthy').length;
  const degraded = all.filter(i => i.status === 'degraded').length;
  const errorsToday = 7; // mock

  const inbound = all.filter(i => i.direction === 'inbound');
  const outbound = all.filter(i => i.direction === 'outbound');
  const bi = all.filter(i => i.direction === 'bi');

  return (
    <div className="viewWrap">
      <div className="viewHero">
        <div>
          <h1>Integrations</h1>
          <div className="sub">All systems feeding the unified DataSource abstraction. Anything you see on the dashboard arrived via one of these. The UI never knows whether a data point came from CRM, PEPPOL, Talend, or a CSV — it just renders state.</div>
        </div>
        <button className="cta" onClick={() => setNangoOpen(true)}><Icon name="plus" size={12} strokeWidth={2} /> Add integration</button>
      </div>

      <div className="viewStats">
        <div className="viewStat good"><div className="l">Connected</div><div className="v">{total}</div><div className="s">{healthy} healthy · {degraded} degraded</div></div>
        <div className="viewStat"><div className="l">Records today</div><div className="v">2,840</div><div className="s">across all sources</div></div>
        <div className="viewStat warn"><div className="l">Latency p95</div><div className="v">740 ms</div><div className="s">elevated · MAN supplier API</div></div>
        <div className="viewStat bad"><div className="l">Errors · 24h</div><div className="v">{errorsToday}</div><div className="s">all auto-retried</div></div>
      </div>

      <div className="integrationGroup">
        <div className="gh">Inbound · {inbound.length}</div>
        <div className="integrationGrid">
          {inbound.map(it => <IntegrationCard key={it.id} it={it} />)}
        </div>
      </div>

      <div className="integrationGroup">
        <div className="gh">Bi-directional · {bi.length}</div>
        <div className="integrationGrid">
          {bi.map(it => <IntegrationCard key={it.id} it={it} />)}
        </div>
      </div>

      <div className="integrationGroup">
        <div className="gh">Outbound · {outbound.length}</div>
        <div className="integrationGrid">
          {outbound.map(it => <IntegrationCard key={it.id} it={it} />)}
        </div>
      </div>

      {nangoOpen && <NangoConnect onClose={() => setNangoOpen(false)} onConnected={onConnected} />}
      {mapping && <AiMappingFlow provider={mapping} onClose={() => setMapping(null)} onComplete={onMapped} />}
    </div>
  );
};

/* ============================================================
   AUDIT LOG
   ============================================================ */

const AUDIT = [
  { id: 1, day: 'Today · 28 May', time: '09:14',
    actor: 'Markus Weber', actorRole: 'Account Director',
    verb: 'marked contract signed', target: 'Brussels Energy SA · €2.46M renewal',
    track: 'sales', kind: 'critical', icon: 'bolt',
    cascades: [
      { track: 'operations', text: 'Created card · "Vehicle ordered · 78 vehicles"' },
      { track: 'finance',    text: 'Created card · "Invoice to create · €2.46M"' },
      { track: 'sales',      text: 'Customer portal updated · order confirmed' },
    ] },
  { id: 2, day: 'Today · 28 May', time: '08:47',
    actor: 'System · Talend', actorRole: 'Automated ETL · 15-min cadence',
    verb: 'sync completed', target: '1,240 records across 6 sources',
    track: 'workshop', kind: 'info', icon: 'refresh', isSystem: true },
  { id: 3, day: 'Today · 28 May', time: '08:22',
    actor: 'Tom Janssens', actorRole: 'Fleet Operations',
    verb: 'confirmed delivery date', target: 'Köln Last Mile · VAN-4421 · slipped to Jun 04',
    track: 'operations', kind: 'normal', icon: 'truck' },
  { id: 4, day: 'Today · 28 May', time: '07:55',
    actor: 'System · PEPPOL', actorRole: 'Inbound webhook',
    verb: 'invoice received', target: 'Bosch Mobility · €1,240 · matched to WO-2026-118',
    track: 'workshop', kind: 'info', icon: 'receipt', isSystem: true },

  { id: 5, day: 'Yesterday · 27 May', time: '16:32',
    actor: 'Eva de Vries', actorRole: 'Account Manager · Benelux',
    verb: 'sent follow-up email', target: 'Rotterdam Logistics B.V. · €1.24M offer (gentle nudge)',
    track: 'sales', kind: 'normal', icon: 'mail' },
  { id: 6, day: 'Yesterday · 27 May', time: '14:18',
    actor: 'Hannah Müller', actorRole: 'Service Coordinator',
    verb: 'scheduled workshop visit', target: 'Amsterdam Cold Chain · TRK-1108 · 4 Jun',
    track: 'operations', kind: 'normal', icon: 'flash',
    cascades: [
      { track: 'workshop',   text: 'New work order WO-2026-119 · expected 4 Jun' },
      { track: 'operations', text: 'Replacement vehicle VAN-7811 reserved' },
    ] },
  { id: 7, day: 'Yesterday · 27 May', time: '11:04',
    actor: 'Ines Vandeput', actorRole: 'Accounts Payable',
    verb: 'approved PEPPOL invoice', target: 'MAN Trucks AG · €87,500 · payment scheduled 27 Jun',
    track: 'finance', kind: 'normal', icon: 'receipt' },
  { id: 8, day: 'Yesterday · 27 May', time: '10:21',
    actor: 'System · Salesforce', actorRole: 'Inbound CRM sync',
    verb: 'imported new lead', target: 'Antwerp Retail Group NV · 22 vehicles · 3-year FSL',
    track: 'sales', kind: 'info', icon: 'plus', isSystem: true },

  { id: 9, day: 'Earlier this week', time: 'May 26 · 15:50',
    actor: 'Sophie Janssen', actorRole: 'Account Manager · Benelux',
    verb: 'logged qualification meeting', target: 'Antwerp Retail Group NV',
    track: 'sales', kind: 'normal', icon: 'check' },
  { id: 10, day: 'Earlier this week', time: 'May 25 · 09:33',
    actor: 'Lars Pieters', actorRole: 'Workshop Manager',
    verb: 'released for pickup', target: 'Rotterdam Logistics · VAN-3344 · brake-system overhaul',
    track: 'workshop', kind: 'normal', icon: 'check' },
  { id: 11, day: 'Earlier this week', time: 'May 25 · 08:18',
    actor: 'System · MAN API', actorRole: 'Supplier API',
    verb: 'flagged order overdue', target: 'Köln Last Mile · VAN-4421 · 3 days late',
    track: 'operations', kind: 'warning', icon: 'bolt', isSystem: true },
];

const AuditView = () => {
  const [filter, setFilter] = React.useState('all');
  const [openId, setOpenId] = React.useState(null);

  const filtered = filter === 'all' ? AUDIT
    : filter === 'cascades' ? AUDIT.filter(a => a.cascades && a.cascades.length)
    : filter === 'system' ? AUDIT.filter(a => a.isSystem)
    : AUDIT.filter(a => a.track === filter);

  const days = [...new Set(filtered.map(a => a.day))];

  return (
    <div className="viewWrap">
      <div className="viewHero">
        <div>
          <h1>Audit log</h1>
          <div className="sub">Every action taken from this dashboard, with actor, timestamp, and downstream cascades. Reversible from this view. System events (Talend syncs, PEPPOL webhooks, supplier API callbacks) are interleaved so you can see the full state-of-the-world.</div>
        </div>
        <button className="cta ghost"><Icon name="download" size={12} strokeWidth={2} /> Export CSV</button>
      </div>

      <div className="filterBar">
        <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)', letterSpacing: '0.04em', textTransform: 'uppercase', marginRight: 4 }}>Filter</span>
        {[
          ['all', 'All', null],
          ['cascades', 'Cascading actions', null],
          ['sales', 'Sales', 'var(--track-sales)'],
          ['operations', 'Operations', 'var(--track-ops)'],
          ['workshop', 'Workshop', 'var(--track-workshop)'],
          ['finance', 'Finance', 'var(--track-finance)'],
          ['system', 'System events', null],
        ].map(([id, label, color]) => (
          <button key={id} className={`filterChip ${filter === id ? 'active' : ''}`}
                  onClick={() => setFilter(id)}>
            {color && <span className="swatch" style={{ background: color }} />}
            {label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>{filtered.length} entries</span>
      </div>

      {days.map(day => {
        const dayEntries = filtered.filter(a => a.day === day);
        return (
          <div className="auditDay" key={day}>
            <div className="auditDayHead">{day}</div>
            {dayEntries.map(a => (
              <div key={a.id} className={`auditEntry ${a.kind}`}
                   onClick={() => a.cascades && setOpenId(openId === a.id ? null : a.id)}
                   style={{ cursor: a.cascades ? 'pointer' : 'default' }}>
                <div className="auditTime">{a.time}</div>
                <div className="auditIcon"><Icon name={a.icon} size={11} strokeWidth={2} /></div>
                <div className="auditBody">
                  <div className="auditLine">
                    <span className="actor">{a.actor}</span>{' '}
                    <span className="verb">{a.verb}</span>{' '}
                    <span className="target">{a.target}</span>
                  </div>
                  <div className="auditMeta">
                    <TrackTag track={a.track}>{a.track}</TrackTag>
                    <span>·</span>
                    <span>{a.actorRole}</span>
                    {a.cascades && <>
                      <span>·</span>
                      <span style={{ color: 'var(--brand)', fontWeight: 500 }}>
                        triggered {a.cascades.length} downstream action{a.cascades.length === 1 ? '' : 's'}
                      </span>
                    </>}
                  </div>
                  {a.cascades && openId === a.id && (
                    <div className="auditCascades">
                      {a.cascades.map((c, i) => (
                        <div key={i} className="auditCascade">
                          <span className="arr">→</span>
                          <TrackTag track={c.track}>{c.track}</TrackTag>
                          <span>{c.text}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="auditActions">
                  {a.cascades && (
                    <button className="miniBtn" onClick={(e) => { e.stopPropagation(); setOpenId(openId === a.id ? null : a.id); }}>
                      {openId === a.id ? 'Hide' : 'Details'}
                    </button>
                  )}
                  {!a.isSystem && <button className="miniBtn" onClick={e => e.stopPropagation()}>Revert</button>}
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
};

Object.assign(window, { IntegrationsView, AuditView });
