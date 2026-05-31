import React from 'react';

/* ============================================================
   Nango Connect UI — embedded integration-authorization widget.
   ============================================================ */

export const NANGO_PROVIDERS = [
  // --- CRM ---
  { id: 'salesforce', name: 'Salesforce', cat: 'CRM', color: '#00A1E0', mono: 'sf', auth: 'oauth',
    blurb: 'Sync leads, accounts, and opportunities both ways.',
    scopes: ['Read & write leads, contacts and accounts', 'Read & update opportunity stages', 'Read user and org metadata'] },
  { id: 'hubspot', name: 'HubSpot', cat: 'CRM', color: '#FF7A59', mono: 'h', auth: 'oauth',
    blurb: 'Pull deals and contacts into the Sales track.',
    scopes: ['Read contacts, companies and deals', 'Write deal stages and notes', 'Read marketing email engagement'] },
  { id: 'pipedrive', name: 'Pipedrive', cat: 'CRM', color: '#017737', mono: 'p', auth: 'oauth',
    blurb: 'Import pipeline and activity data.',
    scopes: ['Read deals, persons and organizations', 'Write deal stages', 'Read activities and notes'] },
  { id: 'dynamics', name: 'Microsoft Dynamics 365', cat: 'CRM', color: '#002050', mono: 'D', auth: 'oauth',
    blurb: 'Two-way sync with Dynamics Sales.',
    scopes: ['Read & write leads and opportunities', 'Read account hierarchy', 'Access organization service'] },
  { id: 'zoho', name: 'Zoho CRM', cat: 'CRM', color: '#E42527', mono: 'z', auth: 'oauth',
    blurb: 'Connect leads, deals and contacts.',
    scopes: ['Read & write modules', 'Read users and roles', 'Bulk read records'] },

  // --- Accounting & finance ---
  { id: 'exact', name: 'Exact Online', cat: 'Accounting & Finance', color: '#ED1C24', mono: 'E', auth: 'oauth',
    blurb: 'Post ledger entries and read payment status.',
    scopes: ['Read & write general ledger entries', 'Read payment confirmations', 'Read supplier & customer records'] },
  { id: 'quickbooks', name: 'QuickBooks Online', cat: 'Accounting & Finance', color: '#2CA01C', mono: 'qb', auth: 'oauth',
    blurb: 'Sync invoices, bills and payments.',
    scopes: ['Read & write invoices and bills', 'Read chart of accounts', 'Read payment status'] },
  { id: 'xero', name: 'Xero', cat: 'Accounting & Finance', color: '#13B5EA', mono: 'X', auth: 'oauth',
    blurb: 'Connect accounting and bank reconciliation.',
    scopes: ['Read & write invoices and bills', 'Read bank transactions', 'Read contacts'] },
  { id: 'sage', name: 'Sage Accounting', cat: 'Accounting & Finance', color: '#00D639', mono: 's', auth: 'oauth',
    blurb: 'Read ledgers and post journals.',
    scopes: ['Read & write journals', 'Read ledger accounts', 'Read contacts'] },
  { id: 'stripe', name: 'Stripe', cat: 'Accounting & Finance', color: '#635BFF', mono: 'S', auth: 'apikey',
    blurb: 'Read charges, payouts and customers.',
    keyLabel: 'Secret key', keyPlaceholder: 'sk_live_••••••••••••••••',
    keyHelp: 'Find this in your Stripe dashboard under Developers → API keys. Stored encrypted by Nango — never exposed to the browser.' },

  // --- ERP / supply chain ---
  { id: 'sap', name: 'SAP S/4HANA', cat: 'ERP & Supply chain', color: '#008FD3', mono: 'SAP', auth: 'apikey',
    blurb: 'Connect to the OData service layer.',
    keyLabel: 'API key', keyPlaceholder: 'Paste your SAP gateway key',
    keyHelp: 'Generated in the SAP Gateway service. Nango stores it encrypted and rotates the session token automatically.' },
  { id: 'netsuite', name: 'Oracle NetSuite', cat: 'ERP & Supply chain', color: '#1B5E20', mono: 'N', auth: 'oauth',
    blurb: 'Two-way sync with NetSuite records.',
    scopes: ['Read & write transactions', 'Read items and inventory', 'Read vendor records'] },

  // --- Productivity & comms ---
  { id: 'gsheets', name: 'Google Sheets', cat: 'Productivity & Comms', color: '#0F9D58', mono: 'GS', auth: 'oauth',
    blurb: 'Read and append rows for bulk loads.',
    scopes: ['Read & write spreadsheet values', 'Read sheet metadata', 'List Drive spreadsheets'] },
  { id: 'slack', name: 'Slack', cat: 'Productivity & Comms', color: '#4A154B', mono: '#', auth: 'oauth',
    blurb: 'Post cascade alerts to a channel.',
    scopes: ['Post messages to channels', 'Read channel list', 'Read workspace metadata'] },
  { id: 'teams', name: 'Microsoft Teams', cat: 'Productivity & Comms', color: '#5059C9', mono: 'T', auth: 'oauth',
    blurb: 'Send notifications into Teams channels.',
    scopes: ['Send channel messages', 'Read teams and channels', 'Read user profile'] },
  { id: 'outlook', name: 'Outlook / Microsoft 365', cat: 'Productivity & Comms', color: '#0078D4', mono: 'O', auth: 'oauth',
    blurb: 'Thread follow-up emails into mailboxes.',
    scopes: ['Send mail as the user', 'Read & write mail folders', 'Read calendar events'] },
];

export const CATEGORY_ORDER = ['CRM', 'Accounting & Finance', 'ERP & Supply chain', 'Productivity & Comms'];

const NangoLogo = ({ p, size = 'sm' }) => (
  <div className={`nangoLogo ${size}`} style={{ background: p.color }}>
    {p.mono}
  </div>
);

const NangoCheck = ({ size = 11 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m20 6-11 11-5-5" /></svg>
);

/* ---- The widget ---- */
export const NangoConnect = ({ onClose, onConnected }) => {
  const [screen, setScreen] = React.useState('list'); // list | consent | connecting | success
  const [query, setQuery] = React.useState('');
  const [selected, setSelected] = React.useState(null);
  const [apiKey, setApiKey] = React.useState('');

  React.useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const q = query.trim().toLowerCase();
  const matches = NANGO_PROVIDERS.filter(p =>
    !q || p.name.toLowerCase().includes(q) || p.cat.toLowerCase().includes(q));

  const openProvider = (p) => { setSelected(p); setApiKey(''); setScreen('consent'); };
  const back = () => { setScreen('list'); setSelected(null); };

  const startConnect = () => {
    setScreen('connecting');
    // Simulate the OAuth popup round-trip / key validation latency.
    setTimeout(() => setScreen('success'), selected.auth === 'oauth' ? 2200 : 1400);
  };

  const finish = () => {
    onConnected && onConnected(selected);
    onClose();
  };

  const canConnect = selected && (selected.auth === 'oauth' || apiKey.trim().length > 6);

  return (
    <div className="nangoOverlay" onClick={onClose}>
      <div className="nangoConnect" onClick={e => e.stopPropagation()}>

        {/* Top bar */}
        <div className="nangoBar">
          <button
            className={`nangoIconBtn ${screen === 'list' || screen === 'connecting' || screen === 'success' ? 'ghost' : ''}`}
            onClick={back} title="Back" aria-label="Back">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
          </button>
          <div className="nangoTitle">
            {screen === 'list' ? 'Connect an integration'
              : screen === 'success' ? 'Connected'
              : selected ? selected.name : 'Connect'}
          </div>
          <button className="nangoIconBtn" onClick={onClose} title="Close" aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
          </button>
        </div>

        {/* LIST */}
        {screen === 'list' && (
          <>
            <div className="nangoIntro">
              <h3>Connect to your tools</h3>
              <p>Select a system to feed the unified DataSource. DLPE-Group will be able to read and sync the data below.</p>
            </div>
            <div className="nangoSearchWrap">
              <div className="nangoSearch">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
                <input autoFocus value={query} onChange={e => setQuery(e.target.value)}
                       placeholder="Search 400+ integrations" />
              </div>
            </div>
            <div className="nangoList">
              {matches.length === 0 && (
                <div className="nangoEmpty">No integrations match "{query}".</div>
              )}
              {CATEGORY_ORDER.map(cat => {
                const inCat = matches.filter(p => p.cat === cat);
                if (!inCat.length) return null;
                return (
                  <React.Fragment key={cat}>
                    <div className="nangoCat">{cat}</div>
                    {inCat.map(p => (
                      <button key={p.id} className="nangoRow" onClick={() => openProvider(p)}>
                        <NangoLogo p={p} />
                        <div className="nangoRowMain">
                          <div className="nm">{p.name}</div>
                          <div className="sub">{p.auth === 'oauth' ? 'OAuth' : 'API key'} · {p.blurb}</div>
                        </div>
                        <span className="chev">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                               strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6" /></svg>
                        </span>
                      </button>
                    ))}
                  </React.Fragment>
                );
              })}
            </div>
            <div className="nangoSecured">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
              Secured by <span className="ng">Nango</span>
            </div>
          </>
        )}

        {/* CONSENT */}
        {screen === 'consent' && selected && (
          <>
            <div className="nangoConsent">
              <div className="nangoConsentHero">
                <div className="nangoLinkRow">
                  <NangoLogo p={selected} size="lg" />
                  <div className="dots"><i /><i /><i /></div>
                  <div className="ng">N</div>
                </div>
                <h3>Connect {selected.name}</h3>
                <p className="lead">
                  <b>DLPE-Group</b> is requesting access to your <b>{selected.name}</b> account
                  {selected.auth === 'oauth' ? '. You’ll be redirected to sign in.' : ' using a secret key.'}
                </p>
              </div>

              {selected.auth === 'oauth' ? (
                <div className="nangoScopes">
                  {selected.scopes.map((s, i) => (
                    <div className="nangoScope" key={i}>
                      <span className="ck"><NangoCheck /></span>
                      <span>{s}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="nangoField">
                  <label>{selected.keyLabel}</label>
                  <input type="password" value={apiKey} autoFocus
                         onChange={e => setApiKey(e.target.value)}
                         placeholder={selected.keyPlaceholder} />
                  <div className="help">{selected.keyHelp}</div>
                </div>
              )}
            </div>
            <div className="nangoFoot">
              <button className="nangoBtn" disabled={!canConnect} onClick={startConnect}>
                {selected.auth === 'oauth' ? `Continue with ${selected.name}` : 'Connect'}
              </button>
            </div>
            <div className="nangoSecured">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
              Secured by <span className="ng">Nango</span>
            </div>
          </>
        )}

        {/* CONNECTING */}
        {screen === 'connecting' && selected && (
          <div className="nangoConnecting">
            <div className="nangoSpinner" />
            <h3>Connecting to {selected.name}…</h3>
            <p>{selected.auth === 'oauth'
              ? 'A secure popup has opened — complete sign-in and authorize access there.'
              : 'Validating your key and establishing the connection.'}</p>
          </div>
        )}

        {/* SUCCESS */}
        {screen === 'success' && selected && (
          <>
            <div className="nangoSuccess">
              <div className="nangoSuccessMark"><NangoCheck size={28} /></div>
              <h3>{selected.name} connected</h3>
              <p>The connection is live. <b>{selected.name}</b> now feeds the DataSource and will appear in your integrations list.</p>
            </div>
            <div className="nangoFoot">
              <button className="nangoBtn green" onClick={finish}>Done</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
