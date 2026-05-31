import React from 'react';
import { Icon } from './icons.jsx';
import { useT } from './i18n.jsx';
import { Avatar, fmtMoney } from './primitives.jsx';

/* Header + Stat tile row */

export const AppHeader = ({ view, setView }) => (
  <header className="appHeader">
    <div className="logoBlock">
      <div className="logoMark">DL</div>
      <div className="logoText">
        <span className="lt-1">Intelligence Layer</span>
        <span className="lt-2">Fleet operations console</span>
      </div>
    </div>

    <div className="searchWrap">
      <Icon name="search" size={15} />
      <input placeholder="Search vehicles, customers, invoices…" />
      <span className="searchKbd">⌘K</span>
    </div>

    <div className="headerRight">
      <div className="viewSwitch" role="tablist">
        <button className={view === 'dashboard' ? 'active' : ''}
                onClick={() => setView('dashboard')}>Internal dashboard</button>
        <button className={view === 'portal' ? 'active' : ''}
                onClick={() => setView('portal')}>Customer portal</button>
      </div>
      <button className="iconBtn notifBtn" title="Notifications">
        <Icon name="bell" size={17} />
        <span className="notifDot"></span>
      </button>
      <button className="iconBtn" title="Settings">
        <Icon name="settings" size={16} />
      </button>
      <Avatar name="Markus Weber" size="" />
    </div>
  </header>
);

export const StatTile = ({ label, value, sub, accent, trend, active, onClick, bars }) => (
  <button className={`statTile ${accent || ''} ${active ? 'active' : ''}`}
          onClick={onClick}>
    <div className="tileLabel">
      <span>{label}</span>
    </div>
    <div className="tileValue">{value}</div>
    <div className="tileSub">
      <span className="muted">{sub}</span>
      <span className="miniBar" aria-hidden>
        {bars && bars.map((h, i) => (
          <i key={i} style={{ height: `${h}px`,
            background: i === bars.length - 1 ? 'var(--brand)' : 'var(--border-strong)' }} />
        ))}
      </span>
    </div>
  </button>
);

export const StatRow = ({ active, setActive }) => (
  <div className="statRow">
    <StatTile
      label="Service due · 90 days"
      value="14"
      sub="3 amber · 11 on track"
      bars={[4,6,5,8,10,12,14]}
      active={active === 'service'}
      onClick={() => setActive(active === 'service' ? null : 'service')}
    />
    <StatTile
      label="Renewals at risk"
      value="€1.15M"
      sub="1 deal · expires 18 days"
      accent="amber"
      bars={[2,1,2,3,2,4,5]}
      active={active === 'renewals'}
      onClick={() => setActive(active === 'renewals' ? null : 'renewals')}
    />
    <StatTile
      label="Awaiting signature"
      value="€6.76M"
      sub="3 deals · 78 + 42 + 120 veh."
      bars={[1,2,3,2,4,3,5]}
      active={active === 'awaiting'}
      onClick={() => setActive(active === 'awaiting' ? null : 'awaiting')}
    />
    <StatTile
      label="Overdue invoices"
      value="€94k"
      sub="1 invoice · 31 days late"
      accent="red"
      bars={[1,1,0,2,1,2,3]}
      active={active === 'overdue'}
      onClick={() => setActive(active === 'overdue' ? null : 'overdue')}
    />
  </div>
);

/* ============================================================
   ScorecardRow
   ============================================================ */

const TRACK_COLOR = {
  sales: 'var(--track-sales)',
  operations: 'var(--track-ops)',
  workshop: 'var(--track-workshop)',
  finance: 'var(--track-finance)',
};

export const TrackScorecard = ({ trackId, label, items, hero, isOpen, focused, onToggle, onAct }) => {
  const { t } = useT();
  const reds   = items.filter(i => i.status === 'red');
  const ambers = items.filter(i => i.status === 'amber');
  const greens = items.filter(i => i.status === 'green');
  const total  = items.length || 1;

  const urgent = reds[0]
    || [...ambers].sort((a, b) => (b.days || 0) - (a.days || 0))[0]
    || null;

  return (
    <div id={`scorecard-${trackId}`} className={`scorecard ${isOpen ? 'open' : ''} ${focused ? 'focused' : ''}`}>
      <div className="scHead" onClick={() => onToggle(trackId)}>
        <span className="swatch" style={{ background: TRACK_COLOR[trackId] }} />
        <span className="scName">{label}</span>
        <span className="scMeta">{items.length} {items.length === 1 ? t('track.item') : t('track.items')}</span>
      </div>

      <div className="scHero">
        <span className="num">{hero.value}</span>
        <span className="numSub">{hero.label}</span>
      </div>

      <div className="scHealth">
        <div className="bar">
          {greens.length > 0 && <i style={{ width: `${(greens.length/total)*100}%`, background: 'var(--status-green)' }} />}
          {ambers.length > 0 && <i style={{ width: `${(ambers.length/total)*100}%`, background: 'var(--status-amber)' }} />}
          {reds.length > 0   && <i style={{ width: `${(reds.length/total)*100}%`,   background: 'var(--status-red)' }} />}
        </div>
        <div className="legend">
          <span className="l"><span className="d" style={{ background: 'var(--status-green)' }} />{greens.length} {t('sc.onTrack')}</span>
          <span className="l"><span className="d" style={{ background: 'var(--status-amber)' }} />{ambers.length} {t('track.amber')}</span>
          <span className="l"><span className="d" style={{ background: 'var(--status-red)' }} />{reds.length} {t('track.red')}</span>
        </div>
      </div>

      {urgent ? (
        <div className="scUrgent" data-status={urgent.status} onClick={() => onAct(urgent)}>
          <div className="uLabel">
            <Icon name={urgent.status === 'red' ? 'bolt' : 'clock'} size={10} strokeWidth={2} />
            {urgent.status === 'red' ? t('sc.blockedAction') : t('sc.approachingSLA')}
          </div>
          <div className="uName">{urgent.customer}</div>
          <div className="uStage">
            {urgent.stageName} · {urgent.daysLabel || `${urgent.days}d`}
            {urgent.vehicle ? ` · ${urgent.vehicle}` : ''}
          </div>
          <button className={`cta ${urgent.status === 'red' ? 'attention' : ''} uCta`}
                  onClick={(e) => { e.stopPropagation(); onAct(urgent); }}>
            {urgent.cta} →
          </button>
        </div>
      ) : (
        <div className="scAllClear">
          <Icon name="check" size={18} strokeWidth={2.5} />
          <div className="ok">{t('sc.allOnTrack')}</div>
          <div className="sub">{t('sc.nothingNeeds')}</div>
        </div>
      )}

      <div className="scFoot">
        <button className="scViewBtn" onClick={() => onToggle(trackId)}>
          {isOpen ? (
            <><Icon name="chevron" size={11} strokeWidth={2.5} /> {t('sc.hideDetails')}</>
          ) : (
            <><Icon name="eye" size={12} strokeWidth={2} /> {t('sc.viewItems', { n: items.length, items: items.length === 1 ? t('track.item') : t('track.items') })}</>
          )}
        </button>
      </div>
    </div>
  );
};

export const ScorecardRow = ({ sales, ops, workshop, finance, openTracks, focused, only, onClearFilter, onToggle, onAct }) => {
  const { t } = useT();
  const salesPipeline = sales.reduce((s, i) => s + (i.value || 0), 0);
  const opsServiceDue = ops.filter(i => i.type === 'SERVICE').length + 11;
  const wsOpen = workshop.filter(i => i.stageId !== 'invoiced').length;
  const finOverdue = finance.filter(i => i.stageId === 'overdue').reduce((s, i) => s + (i.value || 0), 0);

  const cards = [
    { id: 'sales', el: (
      <TrackScorecard key="sales" trackId="sales" label={t('sc.salesPipeline')}
        items={sales}
        hero={{ value: fmtMoney(salesPipeline), label: t('sc.pipelineValue') }}
        isOpen={openTracks.sales} focused={focused === 'sales'} onToggle={onToggle} onAct={onAct} />) },
    { id: 'operations', el: (
      <TrackScorecard key="operations" trackId="operations" label={t('track.operations')}
        items={ops}
        hero={{ value: opsServiceDue, label: t('sc.serviceDue90d') }}
        isOpen={openTracks.operations} focused={focused === 'operations'} onToggle={onToggle} onAct={onAct} />) },
    { id: 'workshop', el: (
      <TrackScorecard key="workshop" trackId="workshop" label={t('track.workshop')}
        items={workshop}
        hero={{ value: wsOpen, label: t('sc.openWorkOrders') }}
        isOpen={openTracks.workshop} focused={focused === 'workshop'} onToggle={onToggle} onAct={onAct} />) },
    { id: 'finance', el: (
      <TrackScorecard key="finance" trackId="finance" label={t('track.finance')}
        items={finance}
        hero={{ value: fmtMoney(finOverdue || 94000), label: t('sc.overdue') }}
        isOpen={openTracks.finance} focused={focused === 'finance'} onToggle={onToggle} onAct={onAct} />) },
  ];

  const deptLabel = { sales: t('track.sales'), operations: t('track.operations'), workshop: t('track.workshop'), finance: t('track.finance') };
  const shown = only ? cards.filter(c => c.id === only) : cards;

  return (
    <>
      {only && (
        <div className="deptFilterBar">
          <span className="dfbSwatch" style={{ background: TRACK_COLOR[only] }} />
          <span className="dfbLabel">{t('dept.viewing')} <b>{deptLabel[only]}</b></span>
          <span className="dfbCount">{shown[0] ? '' : ''}</span>
          <button className="dfbClear" onClick={onClearFilter}>
            <Icon name="eye" size={12} strokeWidth={2} /> {t('dept.showAll')}
          </button>
        </div>
      )}
      <div className={`scorecardRow ${only ? 'filtered' : ''}`}>
        {shown.map(c => c.el)}
      </div>
    </>
  );
};
