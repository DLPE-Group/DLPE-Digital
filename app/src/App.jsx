import React from 'react';
import { Icon } from './icons.jsx';
import { useT, LanguageSwitcher } from './i18n.jsx';
import { Avatar } from './primitives.jsx';
import { ThemeSwitcher } from './themes.jsx';
import { SideMenu } from './side_menu.jsx';
import { ScorecardRow } from './header_tiles.jsx';
import { Track } from './tracks.jsx';
import { VehicleTimeline } from './timeline.jsx';
import { ActionFlow, resolveFlow } from './action_flows.jsx';
import { CustomerPortal } from './portal.jsx';
import { VehiclesView, SettingsView } from './views_part2.jsx';
import { IntegrationsView, AuditView } from './views_part1.jsx';
import { GroupStructureView } from './admin_structure.jsx';
import { UsersView } from './admin_users.jsx';
import { RolesView, RbacConfigurator } from './admin_rbac.jsx';
import { ReportsView } from './reports.jsx';
import {
  SALES_STAGES, OPS_STAGES, WORKSHOP_STAGES, FINANCE_STAGES,
  VEHICLE_TIMELINE,
} from './data.js';
import { ADMIN_USERS, ROLES } from './admin_data.js';
import { api } from './api/client.js';
import { useAuth } from './api/auth.jsx';

// Map a card to the server action that drives it — mirrors resolveFlow().
const flowActionName = (item) => {
  if (item.id === 's5' && item.stageId !== 'signed') return 'signContract';
  if (item.id === 'f2') return 'sendDunning';
  if (item.id === 'w4') return 'approvePeppol';
  if (item.id === 'o3') return 'planWorkshopVisit';
  if (item.id === 'o5' || item.stageId === 'pickup') return 'notifyPickup';
  if (item.stageId === 'to_make') return 'generateInvoice';
  return 'sendFollowUp';
};

const trackKey = (t) => String(t || '').toLowerCase();

/* Main App — v1 with side menu, accordion tracks, action flows */

const Snapshot = ({ urgent, watch, allOk }) => {
  const { t } = useT();
  return (
    <div className="snapshot">
      <div className="text">
        {urgent > 0 ? (
          <>
            <strong>{t('snap.thursdayPrefix')}</strong>{' '}
            <span dangerouslySetInnerHTML={{
              __html: t('snap.headlineUrgent', {
                red: `<span class="red">${urgent} ${urgent === 1 ? t('track.item') : t('track.items')}</span>`,
                item: '',
                andWatch: watch > 0 ? `<span class="amber">${t('snap.andWatch', { n: watch })}</span>` : '',
              })
            }} />
          </>
        ) : (
          <>
            <strong>{t('snap.thursdayPrefix')}</strong>{' '}
            <span className="green">{t('snap.allClear')}</span>
          </>
        )}
      </div>
      <div className="snapshotPills">
        <span className="snapshotPill r"><span className="d" />{urgent} {t('track.red')}</span>
        <span className="snapshotPill a"><span className="d" />{watch} {t('track.amber')}</span>
        <span className="snapshotPill g"><span className="d" />{allOk} {t('sc.onTrack')}</span>
      </div>
    </div>
  );
};

const VehicleSearchPanel = ({ onOpenTimeline }) => {
  const vehicles = [
    { plate: 'TRK-7702', customer: 'Düsseldorf Bau',          status: 'In workshop · brake-system overhaul' },
    { plate: 'VAN-3344', customer: 'Rotterdam Logistics',     status: 'Ready for pickup · today' },
    { plate: 'TRK-1108', customer: 'Amsterdam Cold Chain',    status: 'Service due in 12 days' },
    { plate: 'VAN-4421', customer: 'Köln Last Mile',          status: 'Expected delivery · 3 days late' },
    { plate: 'TRK-5520', customer: 'Antwerp Retail',          status: 'Workshop · in repair' },
    { plate: 'TRK-9012', customer: 'Hamburg Distribution',    status: 'Replacement out · day 1 of 5' },
    { plate: 'VAN-8801', customer: 'Köln Last Mile',          status: 'In fleet · 47d since service' },
    { plate: 'VAN-2210', customer: 'Antwerp Retail',          status: 'Inspection proof received' },
  ];
  return (
    <div className="searchPanel">
      <h2>Vehicle timelines</h2>
      <div className="sub">Search any vehicle to see its full lifecycle across Sales → Operations → Workshop → Finance. The killer "one vehicle, one timeline" view.</div>
      <div className="searchWrap" style={{ maxWidth: 'none', marginBottom: 16 }}>
        <Icon name="search" size={15} />
        <input placeholder="Search by plate, VIN tail, customer name…" />
      </div>
      <div className="vehicleList">
        {vehicles.map(v => (
          <div key={v.plate} className="vehicleCard" onClick={onOpenTimeline}>
            <span className="plate">{v.plate}</span>
            <div className="info">
              <div className="t">{v.customer}</div>
              <div className="s">{v.status}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const StubPanel = ({ icon, title, body }) => (
  <div className="searchPanel">
    <h2>{title}</h2>
    <div className="sub">{body}</div>
    <div style={{ marginTop: 16, padding: 36, textAlign: 'center', background: 'var(--bg-muted)',
                   borderRadius: 8, color: 'var(--text-tertiary)', fontSize: 13 }}>
      <Icon name={icon} size={28} />
      <div style={{ marginTop: 10 }}>This area is a placeholder in the pitch demo.</div>
      <div>The data is already flowing through the DataSource layer.</div>
    </div>
  </div>
);

// In-app notifications bell — derived from live DB state via /notifications.
// "Read" state is per-browser (localStorage); there is no external delivery.
const NotificationsBell = () => {
  const [items, setItems] = React.useState([]);
  const [open, setOpen] = React.useState(false);
  const [dismissed, setDismissed] = React.useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('il_dismissed_notifs') || '[]')); }
    catch { return new Set(); }
  });
  React.useEffect(() => {
    api.get('/notifications').then(rows => { if (Array.isArray(rows)) setItems(rows); }).catch(() => {});
  }, []);
  const visible = items.filter(n => !dismissed.has(n.id));
  const dismiss = (id) => setDismissed(prev => {
    const next = new Set(prev); next.add(id);
    localStorage.setItem('il_dismissed_notifs', JSON.stringify([...next]));
    return next;
  });
  return (
    <div className="notifWrap">
      <button className="iconBtn notifBtn" title="Notifications" onClick={() => setOpen(o => !o)}>
        <Icon name="bell" size={17} />
        {visible.length > 0 && <span className="notifDot" />}
      </button>
      {open && (
        <>
          <div className="notifBackdrop" onClick={() => setOpen(false)} />
          <div className="notifPopover">
            <div className="notifHead"><span>Notifications</span><span className="notifCount">{visible.length}</span></div>
            {visible.length === 0 && <div className="notifEmpty">All clear — nothing needs attention.</div>}
            {visible.map(n => (
              <div key={n.id} className={`notifItem ${n.kind}`}>
                <span className="notifIcon"><Icon name={n.icon || 'bell'} size={14} /></span>
                <div className="notifText">
                  <div className="notifTitle">{n.title}</div>
                  <div className="notifSub">{n.body}{n.when ? ` · ${n.when}` : ''}</div>
                </div>
                <button className="notifX" title="Dismiss" onClick={() => dismiss(n.id)}><Icon name="close" size={12} /></button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

const App = () => {
  const { t } = useT();
  const { me, logout } = useAuth();
  const [active, setActive] = React.useState('overview');
  const [timeline, setTimeline] = React.useState(null);
  const [vehTimeline, setVehTimeline] = React.useState(null);
  // Load the real vehicle lifecycle timeline from the API (fallback to seed).
  React.useEffect(() => {
    api.get('/vehicles/timeline')
      .then((t) => { if (t && Array.isArray(t.events)) setVehTimeline(t); })
      .catch(() => { /* keep VEHICLE_TIMELINE fallback */ });
  }, []);
  const openTimeline = () => setTimeline(vehTimeline || VEHICLE_TIMELINE);
  const [previewUser, setPreviewUser] = React.useState(null);
  const [rbacRole, setRbacRole] = React.useState(null);
  const [toast, setToast] = React.useState(null);
  const [flashIds, setFlashIds] = React.useState([]);
  const [activeFlow, setActiveFlow] = React.useState(null);

  // Accordion state — all tracks closed by default. Each scorecard
  // has a "View" button that opens its track section below.
  const [openTracks, setOpenTracks] = React.useState({
    sales: false, operations: false, workshop: false, finance: false,
  });

  const [sales, setSales] = React.useState([]);
  const [ops, setOps] = React.useState([]);
  const [workshop, setWorkshop] = React.useState([]);
  const [finance, setFinance] = React.useState([]);

  const trackSetters = { sales: setSales, operations: setOps, workshop: setWorkshop, finance: setFinance };

  // Load all four pipelines from the API on mount.
  React.useEffect(() => {
    let alive = true;
    Promise.all([
      api.get('/cards?track=sales'),
      api.get('/cards?track=operations'),
      api.get('/cards?track=workshop'),
      api.get('/cards?track=finance'),
    ]).then(([s, o, w, f]) => {
      if (!alive) return;
      setSales(s); setOps(o); setWorkshop(w); setFinance(f);
    }).catch(() => {});
    return () => { alive = false; };
  }, []);

  // Apply / insert a card returned by the server into the right track.
  const applyCard = (card) => {
    const setter = trackSetters[trackKey(card.track)];
    if (setter) setter(prev => prev.map(x => x.id === card.id ? { ...x, ...card } : x));
  };
  const addCard = (card) => {
    const setter = trackSetters[trackKey(card.track)];
    if (setter) setter(prev => prev.find(x => x.id === card.id)
      ? prev.map(x => x.id === card.id ? { ...x, ...card } : x)
      : [card, ...prev]);
  };

  // Generic flow opener — resolves the modal flow, then runs the server action
  // on completion and applies the authoritative result (incl. any cascade).
  const openFlow = (item) => {
    const flow = resolveFlow(item);
    setActiveFlow({
      ...flow,
      onComplete: async (finalState) => {
        const action = flowActionName(item);
        try {
          const { card, createdCards = [], cascades = [] } =
            await api.post(`/cards/${item.id}/actions/${action}`, { state: finalState });
          if (card) applyCard(card);
          createdCards.forEach(addCard);
          const ids = [item.id, ...createdCards.map(c => c.id)];
          setFlashIds(ids);
          setTimeout(() => setFlashIds([]), 1800);
          if (createdCards.length) {
            const opened = {};
            createdCards.forEach(c => { opened[trackKey(c.track)] = true; });
            setOpenTracks(o => ({ ...o, ...opened }));
          }
          if (cascades.length) {
            setToast({
              title: `${card?.customer || item.customer} — ${action === 'signContract' ? 'contract signed' : 'updated'}`,
              lines: cascades.map(c => `→ ${c.track}: ${c.text}`),
            });
            setTimeout(() => setToast(null), 6500);
          }
        } catch (e) {
          setToast({ title: 'Action failed', lines: [e.message] });
          setTimeout(() => setToast(null), 4000);
        }
      }
    });
  };

  const toggleTrack = (id) => setOpenTracks(o => {
    const next = { ...o, [id]: !o[id] };
    if (next[id]) {
      setTimeout(() => {
        const el = document.getElementById(`track-${id}`);
        if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' });
      }, 60);
    }
    return next;
  });

  // Move an item to a new stage (board drag-drop). Optimistic, then persisted.
  const moveStage = (trackId, stages, setter) => (itemId, newStageId) => {
    const stage = stages.find(s => s.id === newStageId);
    if (!stage) return;
    let snapshot = null;
    setter(prev => {
      snapshot = prev; // capture for revert if the server rejects the move
      return prev.map(it =>
        it.id === itemId
          ? { ...it, stageId: newStageId, stageName: stage.label, daysLabel: 'moved now', days: 0 }
          : it);
    });
    setFlashIds([itemId]);
    setTimeout(() => setFlashIds([]), 1500);
    api.put(`/cards/${itemId}/stage`, { stageId: newStageId })
      .then(card => setter(prev => prev.map(it => it.id === itemId ? { ...it, ...card } : it)))
      .catch(err => {
        if (snapshot) setter(snapshot); // revert optimistic move
        setToast({ title: 'Move blocked', lines: [err?.message || 'Could not move this card'] });
        setTimeout(() => setToast(null), 4500);
      });
  };

  // counts for side menu
  const counts = {
    sales:      { value: sales.length,    kind: sales.some(s => s.status === 'red') ? 'red' : sales.some(s => s.status === 'amber') ? 'amber' : '' },
    operations: { value: ops.length,      kind: ops.some(s => s.status === 'red') ? 'red' : ops.some(s => s.status === 'amber') ? 'amber' : '' },
    workshop:   { value: workshop.length, kind: '' },
    finance:    { value: finance.length,  kind: finance.some(s => s.status === 'red') ? 'red' : finance.some(s => s.status === 'amber') ? 'amber' : '' },
    urgent: [...sales, ...ops, ...workshop, ...finance].filter(i => i.status === 'red').length,
  };

  const allItems = [...sales, ...ops, ...workshop, ...finance];
  const urgent = allItems.filter(i => i.status === 'red').length;
  const watch  = allItems.filter(i => i.status === 'amber').length;
  const okay   = allItems.filter(i => i.status === 'green').length;

  // When a track menu item is clicked, focus its scorecard for a better
  // overview — collapse any open pipelines and leave them closed.
  const [focusTrack, setFocusTrack] = React.useState(null);
  React.useEffect(() => {
    const tracks = ['sales','operations','workshop','finance'];
    if (tracks.includes(active)) {
      setOpenTracks({ sales: false, operations: false, workshop: false, finance: false });
      setFocusTrack(active);
      const el = document.getElementById(`scorecard-${active}`);
      if (el) setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }), 50);
      const tmo = setTimeout(() => setFocusTrack(null), 2000);
      return () => clearTimeout(tmo);
    }
  }, [active]);

  // Leaving the Roles section closes any open configurator.
  React.useEffect(() => { if (active !== 'roles') setRbacRole(null); }, [active]);

  // ---- Render ----
  const renderMain = () => {
    if (active === 'portal') return <CustomerPortal />;
    if (active === 'timeline' || active === 'vehicles') {
      return <VehiclesView onOpenTimeline={openTimeline} />;
    }
    if (active === 'integrations') return <IntegrationsView />;
    if (active === 'structure') return <GroupStructureView />;
    if (active === 'users') return <UsersView onPreviewAs={(u) => setPreviewUser(u)} />;
    if (active === 'roles') return rbacRole
      ? <RbacConfigurator initialRole={rbacRole} onBack={() => setRbacRole(null)}
                          onPreviewRole={(rid) => {
                            const u = ADMIN_USERS.find(x => x.role.toLowerCase().includes((ROLES.find(r => r.id === rid)?.name || '').toLowerCase().split(' ')[0])) || ADMIN_USERS[3];
                            setPreviewUser(u);
                          }} />
      : <RolesView onConfigure={(rid) => setRbacRole(rid)} />;
    if (active === 'reports') return <ReportsView />;
    if (active === 'audit') return <AuditView />;
    if (active === 'settings') return <SettingsView />;
    if (active === 'messages') return <StubPanel icon="mail" title="Messages"
      body="Outbound and inbound messages with fleet operators — emails, portal messages, automated SMS confirmations. Sourced from the same DataSource as the dashboard." />;

    // Overview / dashboard
    const isDept = ['sales','operations','workshop','finance'].includes(active);
    return (
      <>
        <div className="contextBar">
          <div>
            <h1>{t('greet.morning', { name: (me?.name || 'Markus').split(' ')[0] })}</h1>
            <div className="pageSub">{t('greet.itemsNeed', { n: counts.urgent, items: counts.urgent === 1 ? t('track.item') : t('track.items') })}</div>
          </div>
          <div className="right">
            <button className="iconBtn" title="Refresh"><Icon name="refresh" size={15} /></button>
            <button className="iconBtn" title="Filter"><Icon name="filter" size={15} /></button>
            <button className="demoTrigger" onClick={() => openFlow(sales.find(s => s.id === 's5'))}
                    disabled={sales.find(s => s.id === 's5')?.stageId === 'signed'}
                    title="Run the Sales → Ops → Finance cascade demo">
              {sales.find(s => s.id === 's5')?.stageId !== 'signed' && <span className="pulseDot" />}
              <Icon name="bolt" size={12} strokeWidth={2} />
              {sales.find(s => s.id === 's5')?.stageId === 'signed' ? t('top.cascadeComplete') : t('top.demoSign')}
            </button>
          </div>
        </div>

        {!isDept && <Snapshot urgent={urgent} watch={watch} allOk={okay} />}

        <ScorecardRow sales={sales} ops={ops} workshop={workshop} finance={finance}
                      openTracks={openTracks} focused={focusTrack}
                      only={isDept ? active : null}
                      onClearFilter={() => setActive('overview')}
                      onToggle={toggleTrack} onAct={openFlow} />

        {(openTracks.sales || openTracks.operations || openTracks.workshop || openTracks.finance) && (
          <div className="openTracksLabel">{t('track.openPipelines')}</div>
        )}

        {openTracks.sales && (
          <Track trackId="sales" title={t('track.sales')} owner="Eva de Vries"
                 stages={SALES_STAGES} items={sales}
                 isOpen={true} onToggle={() => toggleTrack('sales')}
                 onOpenTimeline={openTimeline}
                 onAct={openFlow} onMoveStage={moveStage('sales', SALES_STAGES, setSales)}
                 flashIds={flashIds} />
        )}

        {openTracks.operations && (
          <Track trackId="operations" title={t('track.operations')} owner="Tom Janssens"
                 stages={OPS_STAGES} items={ops}
                 isOpen={true} onToggle={() => toggleTrack('operations')}
                 onOpenTimeline={openTimeline}
                 onAct={openFlow} onMoveStage={moveStage('operations', OPS_STAGES, setOps)}
                 flashIds={flashIds} />
        )}

        {openTracks.workshop && (
          <Track trackId="workshop" title={t('track.workshop')} owner="Lars Pieters"
                 stages={WORKSHOP_STAGES} items={workshop}
                 isOpen={true} onToggle={() => toggleTrack('workshop')}
                 onOpenTimeline={openTimeline}
                 onAct={openFlow} onMoveStage={moveStage('workshop', WORKSHOP_STAGES, setWorkshop)}
                 flashIds={flashIds} />
        )}

        {openTracks.finance && (
          <Track trackId="finance" title={t('track.finance')} owner="Ines Vandeput"
                 stages={FINANCE_STAGES} items={finance}
                 isOpen={true} onToggle={() => toggleTrack('finance')}
                 onOpenTimeline={openTimeline}
                 onAct={openFlow} onMoveStage={moveStage('finance', FINANCE_STAGES, setFinance)}
                 flashIds={flashIds} />
        )}

        {!isDept && <div style={{ marginTop: 28, padding: '14px 18px', background: 'var(--bg-muted)',
                      border: '1px dashed var(--border-strong)', borderRadius: 8,
                      fontSize: 12, color: 'var(--text-tertiary)', display: 'flex',
                      gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <Icon name="bolt" size={13} />
          <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>How this is wired:</span>
          Data is unified through a single <strong style={{ color: 'var(--text)' }}>DataSource</strong> abstraction —
          <span className="src talend" style={{ fontFamily: 'var(--mono)', padding: '1px 5px', border: '1px solid var(--track-workshop)', borderRadius: 3 }}>Talend</span> ETL,
          <span className="src peppol" style={{ fontFamily: 'var(--mono)', padding: '1px 5px', border: '1px solid var(--track-finance)', borderRadius: 3 }}>PEPPOL</span> e-invoicing,
          <span className="src crm" style={{ fontFamily: 'var(--mono)', padding: '1px 5px', border: '1px solid var(--track-sales)', borderRadius: 3 }}>CRM</span> leads,
          and <span style={{ fontFamily: 'var(--mono)' }}>CSV / API</span> for the long tail. Stage definitions, lock conditions and cross-track triggers live in JSON config — never hard-coded.
        </div>}
      </>
    );
  };

  return (
    <div className="app v1Shell">
      <SideMenu active={active} setActive={setActive} counts={counts}
                onTrackSelect={() => setOpenTracks({ sales: false, operations: false, workshop: false, finance: false })} />

      <div className="v1Main">
        {previewUser && (
          <div className="previewBanner">
            <span className="pbDot" />
            <span>Previewing the dashboard as <strong>{previewUser.name}</strong> · {previewUser.role} — restricted fields are hidden or masked exactly as this user would see them.</span>
            <button className="exit" onClick={() => setPreviewUser(null)}>
              <Icon name="close" size={12} /> Exit preview
            </button>
          </div>
        )}
        <header className="appHeader">
          <div className="searchWrap">
            <Icon name="search" size={15} />
            <input placeholder="Search vehicles, customers, invoices…" />
            <span className="searchKbd">⌘K</span>
          </div>
          <div className="headerRight">
            <ThemeSwitcher />
            <LanguageSwitcher />
            <NotificationsBell />
            <button className="iconBtn" title="Help"><Icon name="document" size={16} /></button>
            <button className="iconBtn" title="Sign out" onClick={logout}><Icon name="close" size={16} /></button>
            <Avatar name={me?.name || 'Markus Weber'} size="" />
          </div>
        </header>

        <main className="main">
          {renderMain()}
        </main>
      </div>

      {timeline && <VehicleTimeline data={timeline} onClose={() => setTimeline(null)} />}

      {activeFlow && (
        <ActionFlow flow={activeFlow}
                    onComplete={activeFlow.onComplete}
                    onClose={() => setActiveFlow(null)} />
      )}

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

export default App;
