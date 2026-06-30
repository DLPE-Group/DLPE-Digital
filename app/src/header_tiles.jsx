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
      <Avatar name="Account" size="" />
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

// Fallback color when a track has no color in the data model.
const DEFAULT_TRACK_COLOR = 'var(--brand)';

export const TrackScorecard = ({ trackId, color, label, items, hero, isOpen, focused, onToggle, onAct }) => {
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
        <span className="swatch" style={{ background: color || DEFAULT_TRACK_COLOR }} />
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

// Generic hero metric for a track: if any item carries a numeric value, show
// the summed value; otherwise show the item count. KPI configuration per track
// (e.g. "service due", "overdue") is a later, config-driven phase — this keeps
// the scorecard meaningful for ANY track without baking in domain assumptions.
const heroFor = (items, t) => {
  const valued = items.filter(i => typeof i.value === 'number' && i.value);
  if (valued.length) {
    return { value: fmtMoney(valued.reduce((s, i) => s + (i.value || 0), 0)), label: t('sc.totalValue') };
  }
  return { value: items.length, label: t('sc.openItems') };
};

// `tracks` is the tenant's ordered, already access-filtered track set
// ([{ key, label, color }]); `cardsByTrack` maps each track key to its cards.
export const ScorecardRow = ({ tracks = [], cardsByTrack = {}, openTracks = {}, focused, only, onClearFilter, onToggle, onAct }) => {
  const { t } = useT();
  const cardsFor = (k) => cardsByTrack[k] || [];

  const cards = tracks.map(tr => ({
    id: tr.key,
    el: (
      <TrackScorecard key={tr.key} trackId={tr.key} color={tr.color} label={tr.label}
        items={cardsFor(tr.key)} hero={heroFor(cardsFor(tr.key), t)}
        isOpen={!!openTracks[tr.key]} focused={focused === tr.key} onToggle={onToggle} onAct={onAct} />
    ),
  }));

  const onlyTrack = only ? tracks.find(tr => tr.key === only) : null;
  const shown = only ? cards.filter(c => c.id === only) : cards;

  return (
    <>
      {only && onlyTrack && (
        <div className="deptFilterBar">
          <span className="dfbSwatch" style={{ background: onlyTrack.color || DEFAULT_TRACK_COLOR }} />
          <span className="dfbLabel">{t('dept.viewing')} <b>{onlyTrack.label}</b></span>
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
