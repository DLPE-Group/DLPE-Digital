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
    'nav.synced': 'All sources synced',
    'nav.minAgo': '{n} minutes ago',

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
    'snap.allClear': 'Nothing is blocked. 23 items progressing normally across all four tracks.',
    'snap.thursdayPrefix': 'Thursday morning.',

    'greet.morning': 'Good morning, {name}',
    'greet.itemsNeed': '{n} {items} need attention · Thursday, 28 May 2026',

    'top.demoSign': 'Demo: sign Brussels Energy',
    'top.cascadeComplete': 'Cascade complete',

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
    'nav.synced': 'Alle bronnen gesynchroniseerd',
    'nav.minAgo': '{n} minuten geleden',

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
    'snap.allClear': 'Niets is geblokkeerd. 23 items verlopen normaal in alle vier de trajecten.',
    'snap.thursdayPrefix': 'Donderdagochtend.',

    'greet.morning': 'Goedemorgen, {name}',
    'greet.itemsNeed': '{n} {items} vereisen aandacht · donderdag 28 mei 2026',

    'top.demoSign': 'Demo: teken Brussels Energy',
    'top.cascadeComplete': 'Cascade voltooid',

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

    'nav.overview': 'Vue d\u2019ensemble',
    'nav.reports': 'Rapports',
    'nav.vehicles': 'Véhicules',
    'nav.timelines': 'Chronologies véhicule',
    'nav.tracks': 'Pistes',
    'nav.customerFacing': 'Côté client',
    'nav.system': 'Système',
    'nav.portal': 'Portail client',
    'nav.messages': 'Messages',
    'nav.integrations': 'Intégrations',
    'nav.audit': 'Journal d\u2019audit',
    'nav.settings': 'Paramètres',
    'nav.synced': 'Toutes les sources synchronisées',
    'nav.minAgo': 'il y a {n} minutes',

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
    'sc.blockedAction': 'Bloqué · action aujourd\u2019hui',
    'sc.approachingSLA': 'SLA imminent',

    'snap.headlineUrgent': 'Vous avez {red} {item} bloqué nécessitant une action aujourd\u2019hui {andWatch} Tout le reste est en cours.',
    'snap.andWatch': 'et {n} approchant le SLA cette semaine.',
    'snap.allClear': 'Rien n\u2019est bloqué. 23 éléments progressent normalement sur les quatre pistes.',
    'snap.thursdayPrefix': 'Jeudi matin.',

    'greet.morning': 'Bonjour, {name}',
    'greet.itemsNeed': '{n} {items} nécessitent votre attention · jeudi 28 mai 2026',

    'top.demoSign': 'Démo : signer Brussels Energy',
    'top.cascadeComplete': 'Cascade terminée',

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
    'nav.synced': 'Alle Quellen synchronisiert',
    'nav.minAgo': 'vor {n} Minuten',

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
    'snap.allClear': 'Nichts ist blockiert. 23 Einträge entwickeln sich normal über alle vier Bereiche.',
    'snap.thursdayPrefix': 'Donnerstagmorgen.',

    'greet.morning': 'Guten Morgen, {name}',
    'greet.itemsNeed': '{n} {items} erfordern Aufmerksamkeit · Donnerstag, 28. Mai 2026',

    'top.demoSign': 'Demo: Brussels Energy unterzeichnen',
    'top.cascadeComplete': 'Kaskade abgeschlossen',

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

const LANG_LABELS = [
  { id: 'en', flag: '🇬🇧', name: 'English' },
  { id: 'nl', flag: '🇳🇱', name: 'Nederlands' },
  { id: 'fr', flag: '🇫🇷', name: 'Français' },
  { id: 'de', flag: '🇩🇪', name: 'Deutsch' },
];

const LangContext = React.createContext({ lang: 'en', setLang: () => {} });

const LangProvider = ({ children }) => {
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

const useT = () => {
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
const LanguageSwitcher = () => {
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

Object.assign(window, { T, LangContext, LangProvider, useT, LanguageSwitcher, LANG_LABELS });
