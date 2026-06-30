import React from 'react';
import { Icon } from './icons.jsx';
import { useT } from './i18n.jsx';

/* Side menu — primary navigation for the dashboard */

export const SideMenu = ({ active, setActive, counts = {}, onTrackSelect, tracks = [], isAdmin, isPlatformAdmin }) => {
  const { t } = useT();

  const item = (id, icon, label, badge, badgeKind) => (
    <button key={id}
            className={`navItem ${active === id ? 'active' : ''}`}
            onClick={() => setActive(id)}>
      <span className="navIco">{icon ? <Icon name={icon} size={15} /> : null}</span>
      <span className="navLabel">{label}</span>
      {badge != null && <span className={`navBadge ${badgeKind || ''}`}>{badge}</span>}
    </button>
  );

  return (
    <nav className="sideMenu" aria-label="Main">
      <div className="logo">
        <div className="logoMark">DL</div>
        <div className="logoText">
          <span className="lt-1">{t('app.brand')}</span>
          <span className="lt-2">{t('app.subtitle')}</span>
        </div>
      </div>

      <div className="sideNav">
        <div className="navSection">
          {item('overview', 'eye', t('nav.overview'), counts.urgent || null, counts.urgent ? 'red' : '')}
          {item('reports', 'chart', t('nav.reports'))}
          {item('vehicles', 'truck', t('nav.vehicles'))}
          {item('timeline', 'timeline', t('nav.timelines'))}
        </div>

        {tracks.length > 0 && (
          <div className="navSection">
            <div className="navHead">
              <span>{t('nav.tracks')}</span>
            </div>
            {tracks.map(tr => {
              const count = counts[tr.key];
              return (
                <button key={tr.key}
                        className={`navItem ${active === tr.key ? 'active' : ''}`}
                        onClick={() => { onTrackSelect && onTrackSelect(tr.key); setActive(tr.key); }}>
                  <span className="navIco"><span className="navSwatch" style={{ background: tr.color || 'var(--brand)' }} /></span>
                  <span className="navLabel">{tr.label}</span>
                  {count != null && (
                    <span className={`navBadge ${count.kind || ''}`}>{count.value}</span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        <div className="navSection">
          <div className="navHead">{t('nav.customerFacing')}</div>
          {item('portal', 'user', t('nav.portal'))}
          {item('messages', 'mail', t('nav.messages'), null)}
        </div>

        {/* Administration + Integrations + Audit are group-admin only
            (mirrors the server's requireAdmin guard). */}
        {isAdmin && (
          <div className="navSection">
            <div className="navHead">Administration</div>
            {item('structure', 'settings', 'Group structure')}
            {item('users', 'user', 'Users')}
            {item('roles', 'lock', 'Roles & permissions')}
            {item('datamodel', 'document', 'Data model')}
          </div>
        )}

        <div className="navSection">
          <div className="navHead">{t('nav.system')}</div>
          {isAdmin && item('integrations', 'bolt', t('nav.integrations'))}
          {isAdmin && item('audit', 'document', t('nav.audit'))}
          {item('settings', 'settings', t('nav.settings'))}
        </div>

        {isPlatformAdmin && (
          <div className="navSection">
            <div className="navHead">Platform</div>
            {item('platform', 'bolt', 'Control plane')}
          </div>
        )}
      </div>

    </nav>
  );
};
