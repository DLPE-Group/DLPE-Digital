import React from 'react';
import { Icon } from './icons.jsx';

/* ============================================================
   i18n — translations + LanguageContext + useT hook
   Languages: EN (default), NL, FR, DE
   ============================================================ */

const T = {
  en: {
    'app.brand': 'Intelligence Layer',
    'app.subtitle': 'Fleet console',

    'nav.overview': 'Overview',
    'nav.reports': 'Reports',
    'nav.vehicles': 'Vehicles',
    'nav.timelines': 'Vehicle timelines',
    'nav.tracks': 'Tracks',
    'nav.customerFacing': 'Customer-facing',
    'nav.system': 'System',
    'nav.portal': 'Customer portal',
    'nav.messages': 'Messages',
    'nav.integrations': 'Integrations',
    'nav.audit': 'Audit log',
    'nav.settings': 'Settings',
    'track.sales': 'Sales',
    'track.operations': 'Operations',
    'track.workshop': 'Own workshop',
    'track.finance': 'Finance',
    'track.owner': 'Owner',
    'track.search': 'Search {track}…',
    'track.items': 'items',
    'track.item': 'item',
    'track.cards': 'Cards',
    'track.list': 'List',
    'track.board': 'Board',
    'track.red': 'red',
    'track.amber': 'amber',
    'track.showMore': 'Show {n} more',
    'track.showFirst': 'Show first {n}',
    'track.perPage': 'Per page',
    'track.openPipelines': 'Open pipelines',
    'track.noItems': 'No items at this stage right now.',
    'track.noMatch': 'No items match',
    'track.clearFilters': 'Clear filters',

    'sc.salesPipeline': 'Sales pipeline',
    'sc.pipelineValue': 'pipeline value',
    'sc.totalValue': 'total value',
    'sc.openItems': 'open items',
    'sc.serviceDue90d': 'service due in 90 days',
    'sc.openWorkOrders': 'open work orders',
    'sc.overdue': 'overdue · longest 31 d',
    'sc.viewItems': 'View {n} {items}',
    'dept.viewing': 'Viewing',
    'dept.showAll': 'Show all departments',
    'sc.hideDetails': 'Hide details',
    'sc.onTrack': 'on track',
    'sc.allOnTrack': 'All on track',
    'sc.nothingNeeds': 'Nothing in this track needs you',
    'sc.blockedAction': 'Blocked · action today',
    'sc.approachingSLA': 'Approaching SLA',

    'snap.headlineUrgent': 'You have {red} blocked {item} needing action today {andWatch} Everything else is on track.',
    'snap.andWatch': 'and {n} approaching SLA this week.',
    'snap.allClear': '{n} {items} progressing normally. Nothing is blocked.',
    'snap.allClearEmpty': 'No items yet. Nothing is blocked.',

    'greet.morning': 'Good morning, {name}',
    'greet.itemsNeed': '{n} {items} need attention · Thursday, 28 May 2026',

    'common.search': 'Search',
    'common.cancel': 'Cancel',
    'common.continue': 'Continue',
    'common.back': 'Back',
    'common.confirm': 'Confirm',
    'common.language': 'Language',

    'lang.en': 'English',
    'lang.nl': 'Nederlands',
    'lang.fr': 'Français',
    'lang.de': 'Deutsch',

    'views.audit': 'Audit log',
    'views.settings': 'Settings',
    'views.integrations': 'Integrations',

    'banner.sourcesSync': 'All sources synced · 2 min ago',
  },

  nl: {
    'app.brand': 'Intelligence Layer',
    'app.subtitle': 'Wagenpark-console',

    'nav.overview': 'Overzicht',
    'nav.reports': 'Rapporten',
    'nav.vehicles': 'Voertuigen',
    'nav.timelines': 'Voertuig-tijdlijnen',
    'nav.tracks': 'Trajecten',
    'nav.customerFacing': 'Klantgericht',
    'nav.system': 'Systeem',
    'nav.portal': 'Klantenportaal',
    'nav.messages': 'Berichten',
    'nav.integrations': 'Integraties',
    'nav.audit': 'Auditlogboek',
    'nav.settings': 'Instellingen',
    'track.sales': 'Verkoop',
    'track.operations': 'Operaties',
    'track.workshop': 'Eigen werkplaats',
    'track.finance': 'Financiën',
    'track.owner': 'Eigenaar',
    'track.search': 'Zoek in {track}…',
    'track.items': 'items',
    'track.item': 'item',
    'track.cards': 'Kaarten',
    'track.list': 'Lijst',
    'track.board': 'Bord',
    'track.red': 'rood',
    'track.amber': 'oranje',
    'track.showMore': 'Toon {n} meer',
    'track.showFirst': 'Toon eerste {n}',
    'track.perPage': 'Per pagina',
    'track.openPipelines': 'Open pijplijnen',
    'track.noItems': 'Op dit moment geen items in dit stadium.',
    'track.noMatch': 'Geen items gevonden voor',
    'track.clearFilters': 'Filters wissen',

    'sc.salesPipeline': 'Verkooppijplijn',
    'sc.pipelineValue': 'pijplijnwaarde',
    'sc.totalValue': 'totale waarde',
    'sc.openItems': 'open items',
    'sc.serviceDue90d': 'onderhoud binnen 90 dagen',
    'sc.openWorkOrders': 'openstaande werkbonnen',
    'sc.overdue': 'achterstallig · langste 31 d',
    'sc.viewItems': 'Bekijk {n} {items}',
    'dept.viewing': 'Weergave',
    'dept.showAll': 'Toon alle afdelingen',
    'sc.hideDetails': 'Verberg details',
    'sc.onTrack': 'op schema',
    'sc.allOnTrack': 'Alles op schema',
    'sc.nothingNeeds': 'Niets in dit traject vraagt om aandacht',
    'sc.blockedAction': 'Geblokkeerd · actie vandaag',
    'sc.approachingSLA': 'SLA nadert',

    'snap.headlineUrgent': 'Je hebt {red} geblokkeerd {item} dat vandaag actie vereist {andWatch} De rest verloopt volgens plan.',
    'snap.andWatch': 'en {n} naderen de SLA deze week.',
    'snap.allClear': '{n} {items} verlopen normaal. Niets is geblokkeerd.',
    'snap.allClearEmpty': 'Nog geen items. Niets is geblokkeerd.',

    'greet.morning': 'Goedemorgen, {name}',
    'greet.itemsNeed': '{n} {items} vereisen aandacht · donderdag 28 mei 2026',

    'common.search': 'Zoeken',
    'common.cancel': 'Annuleren',
    'common.continue': 'Doorgaan',
    'common.back': 'Terug',
    'common.confirm': 'Bevestigen',
    'common.language': 'Taal',

    'lang.en': 'English',
    'lang.nl': 'Nederlands',
    'lang.fr': 'Français',
    'lang.de': 'Deutsch',

    'banner.sourcesSync': 'Alle bronnen gesynchroniseerd · 2 min geleden',
  },

  fr: {
    'app.brand': 'Intelligence Layer',
    'app.subtitle': 'Console flotte',

    'nav.overview': 'Vue d’ensemble',
    'nav.reports': 'Rapports',
    'nav.vehicles': 'Véhicules',
    'nav.timelines': 'Chronologies véhicule',
    'nav.tracks': 'Pistes',
    'nav.customerFacing': 'Côté client',
    'nav.system': 'Système',
    'nav.portal': 'Portail client',
    'nav.messages': 'Messages',
    'nav.integrations': 'Intégrations',
    'nav.audit': 'Journal d’audit',
    'nav.settings': 'Paramètres',
    'track.sales': 'Ventes',
    'track.operations': 'Opérations',
    'track.workshop': 'Atelier interne',
    'track.finance': 'Finance',
    'track.owner': 'Responsable',
    'track.search': 'Rechercher dans {track}…',
    'track.items': 'éléments',
    'track.item': 'élément',
    'track.cards': 'Cartes',
    'track.list': 'Liste',
    'track.board': 'Tableau',
    'track.red': 'rouge',
    'track.amber': 'orange',
    'track.showMore': 'Afficher {n} de plus',
    'track.showFirst': 'Afficher les {n} premiers',
    'track.perPage': 'Par page',
    'track.openPipelines': 'Pipelines ouverts',
    'track.noItems': 'Aucun élément à cette étape pour le moment.',
    'track.noMatch': 'Aucun élément ne correspond à',
    'track.clearFilters': 'Effacer les filtres',

    'sc.salesPipeline': 'Pipeline commercial',
    'sc.pipelineValue': 'valeur du pipeline',
    'sc.totalValue': 'valeur totale',
    'sc.openItems': 'éléments ouverts',
    'sc.serviceDue90d': 'entretien dans 90 jours',
    'sc.openWorkOrders': 'ordres de travail ouverts',
    'sc.overdue': 'en retard · plus long 31 j',
    'sc.viewItems': 'Voir {n} {items}',
    'dept.viewing': 'Affichage',
    'dept.showAll': 'Afficher tous les départements',
    'sc.hideDetails': 'Masquer les détails',
    'sc.onTrack': 'en cours',
    'sc.allOnTrack': 'Tout est en cours',
    'sc.nothingNeeds': 'Rien dans cette piste ne nécessite votre attention',
    'sc.blockedAction': 'Bloqué · action aujourd’hui',
    'sc.approachingSLA': 'SLA imminent',

    'snap.headlineUrgent': 'Vous avez {red} {item} bloqué nécessitant une action aujourd’hui {andWatch} Tout le reste est en cours.',
    'snap.andWatch': 'et {n} approchant le SLA cette semaine.',
    'snap.allClear': '{n} {items} en cours normal. Tout est débloqué.',
    'snap.allClearEmpty': 'Aucun élément pour le moment. Rien de bloqué.',

    'greet.morning': 'Bonjour, {name}',
    'greet.itemsNeed': '{n} {items} nécessitent votre attention · jeudi 28 mai 2026',

    'common.search': 'Rechercher',
    'common.cancel': 'Annuler',
    'common.continue': 'Continuer',
    'common.back': 'Retour',
    'common.confirm': 'Confirmer',
    'common.language': 'Langue',

    'lang.en': 'English',
    'lang.nl': 'Nederlands',
    'lang.fr': 'Français',
    'lang.de': 'Deutsch',

    'banner.sourcesSync': 'Toutes les sources synchronisées · il y a 2 min',
  },

  de: {
    'app.brand': 'Intelligence Layer',
    'app.subtitle': 'Flotten-Konsole',

    'nav.overview': 'Übersicht',
    'nav.reports': 'Berichte',
    'nav.vehicles': 'Fahrzeuge',
    'nav.timelines': 'Fahrzeug-Verläufe',
    'nav.tracks': 'Bereiche',
    'nav.customerFacing': 'Kundenseitig',
    'nav.system': 'System',
    'nav.portal': 'Kundenportal',
    'nav.messages': 'Nachrichten',
    'nav.integrations': 'Integrationen',
    'nav.audit': 'Audit-Protokoll',
    'nav.settings': 'Einstellungen',
    'track.sales': 'Vertrieb',
    'track.operations': 'Betrieb',
    'track.workshop': 'Eigene Werkstatt',
    'track.finance': 'Finanzen',
    'track.owner': 'Verantwortlich',
    'track.search': 'In {track} suchen…',
    'track.items': 'Einträge',
    'track.item': 'Eintrag',
    'track.cards': 'Karten',
    'track.list': 'Liste',
    'track.board': 'Board',
    'track.red': 'rot',
    'track.amber': 'gelb',
    'track.showMore': '{n} weitere anzeigen',
    'track.showFirst': 'Erste {n} anzeigen',
    'track.perPage': 'Pro Seite',
    'track.openPipelines': 'Offene Pipelines',
    'track.noItems': 'Derzeit keine Einträge in dieser Phase.',
    'track.noMatch': 'Keine Einträge passen zu',
    'track.clearFilters': 'Filter zurücksetzen',

    'sc.salesPipeline': 'Vertriebs-Pipeline',
    'sc.pipelineValue': 'Pipeline-Wert',
    'sc.totalValue': 'Gesamtwert',
    'sc.openItems': 'offene Posten',
    'sc.serviceDue90d': 'Service in 90 Tagen fällig',
    'sc.openWorkOrders': 'offene Werkstattaufträge',
    'sc.overdue': 'überfällig · längste 31 T',
    'sc.viewItems': '{n} {items} anzeigen',
    'dept.viewing': 'Ansicht',
    'dept.showAll': 'Alle Abteilungen anzeigen',
    'sc.hideDetails': 'Details ausblenden',
    'sc.onTrack': 'im Plan',
    'sc.allOnTrack': 'Alles im Plan',
    'sc.nothingNeeds': 'Nichts in diesem Bereich erfordert Ihre Aufmerksamkeit',
    'sc.blockedAction': 'Blockiert · Aktion heute',
    'sc.approachingSLA': 'SLA nähert sich',

    'snap.headlineUrgent': 'Sie haben {red} blockierten {item} mit Handlungsbedarf heute {andWatch} Alles andere läuft planmäßig.',
    'snap.andWatch': 'und {n} mit SLA-Nähe diese Woche.',
    'snap.allClear': '{n} {items} entwickeln sich normal. Nichts ist blockiert.',
    'snap.allClearEmpty': 'Noch keine Einträge. Nichts ist blockiert.',

    'greet.morning': 'Guten Morgen, {name}',
    'greet.itemsNeed': '{n} {items} erfordern Aufmerksamkeit · Donnerstag, 28. Mai 2026',

    'common.search': 'Suchen',
    'common.cancel': 'Abbrechen',
    'common.continue': 'Weiter',
    'common.back': 'Zurück',
    'common.confirm': 'Bestätigen',
    'common.language': 'Sprache',

    'lang.en': 'English',
    'lang.nl': 'Nederlands',
    'lang.fr': 'Français',
    'lang.de': 'Deutsch',

    'banner.sourcesSync': 'Alle Quellen synchronisiert · vor 2 Min',
  },
};

export const LANG_LABELS = [
  { id: 'en', flag: '🇬🇧', name: 'English' },
  { id: 'nl', flag: '🇳🇱', name: 'Nederlands' },
  { id: 'fr', flag: '🇫🇷', name: 'Français' },
  { id: 'de', flag: '🇩🇪', name: 'Deutsch' },
];

export const LangContext = React.createContext({ lang: 'en', setLang: () => {} });

export const LangProvider = ({ children }) => {
  const [lang, setLang] = React.useState(() => {
    try { return localStorage.getItem('ilang') || 'en'; } catch (e) { return 'en'; }
  });
  React.useEffect(() => {
    try { localStorage.setItem('ilang', lang); } catch (e) {}
  }, [lang]);
  return (
    <LangContext.Provider value={{ lang, setLang }}>
      {children}
    </LangContext.Provider>
  );
};

export const useT = () => {
  const { lang, setLang } = React.useContext(LangContext);
  const t = (key, vars) => {
    let s = (T[lang] && T[lang][key]) || T.en[key] || key;
    if (vars) {
      Object.keys(vars).forEach(k => {
        s = s.replace(new RegExp('\\{' + k + '\\}', 'g'), vars[k]);
      });
    }
    return s;
  };
  return { t, lang, setLang };
};

/* Compact language switcher — flag + code, dropdown */
export const LanguageSwitcher = () => {
  const { lang, setLang } = useT();
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  const current = LANG_LABELS.find(l => l.id === lang) || LANG_LABELS[0];

  React.useEffect(() => {
    if (!open) return;
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  return (
    <div className="langSwitch" ref={ref}>
      <button className="langTrigger" onClick={() => setOpen(o => !o)} title="Language">
        <span className="langFlag">{current.flag}</span>
        <span className="langCode">{current.id.toUpperCase()}</span>
        <Icon name="chevron" size={11} strokeWidth={2.5} />
      </button>
      {open && (
        <div className="langMenu">
          {LANG_LABELS.map(l => (
            <button key={l.id} className={`langItem ${lang === l.id ? 'selected' : ''}`}
                    onClick={() => { setLang(l.id); setOpen(false); }}>
              <span className="langFlag">{l.flag}</span>
              <span className="langName">{l.name}</span>
              {lang === l.id && <Icon name="check" size={12} strokeWidth={2.5} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
