/* Inline SVG icons — outlined, paired with labels per spec */
const Icon = ({ name, size = 16, className = '', strokeWidth = 1.5 }) => {
  const paths = {
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></>,
    bell: <><path d="M15 17h5l-1.4-2.3c-.4-.6-.6-1.4-.6-2.1V9a5 5 0 1 0-10 0v3.6c0 .7-.2 1.5-.6 2.1L6 17h5"/><path d="M9 17a3 3 0 0 0 6 0"/></>,
    chevron: <path d="m6 9 6 6 6-6"/>,
    chevronRight: <path d="m9 6 6 6-6 6"/>,
    check: <path d="m20 6-11 11-5-5"/>,
    lock: <><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></>,
    arrow: <><path d="M5 12h14"/><path d="m13 5 7 7-7 7"/></>,
    plus: <><path d="M12 5v14"/><path d="M5 12h14"/></>,
    car: <><path d="M5 17H3a1 1 0 0 1-1-1v-3a4 4 0 0 1 1.2-2.8L5 8h14l1.8 2.2A4 4 0 0 1 22 13v3a1 1 0 0 1-1 1h-2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></>,
    truck: <><path d="M1 16V6h12v10"/><path d="M13 9h4l4 4v3h-8"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></>,
    invoice: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8"/><path d="M8 17h5"/></>,
    receipt: <><path d="M4 2h16v20l-3-2-3 2-3-2-3 2-3-2-1 1V2z"/><path d="M8 7h8"/><path d="M8 11h8"/><path d="M8 15h5"/></>,
    user: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
    filter: <path d="M3 5h18M6 12h12M10 19h4"/>,
    timeline: <><circle cx="5" cy="6" r="2"/><circle cx="5" cy="18" r="2"/><path d="M5 8v8"/><path d="M11 6h10"/><path d="M11 18h10"/></>,
    refresh: <><path d="M21 12a9 9 0 0 1-15 6.7L3 17"/><path d="M3 12a9 9 0 0 1 15-6.7L21 7"/><path d="M21 3v4h-4"/><path d="M3 21v-4h4"/></>,
    download: <><path d="M12 4v12"/><path d="m7 11 5 5 5-5"/><path d="M4 20h16"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></>,
    close: <><path d="M18 6 6 18"/><path d="m6 6 12 12"/></>,
    flash: <path d="M13 2 4 14h7l-1 8 9-12h-7z"/>,
    document: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    bolt: <path d="m13 2-9 13h7l-1 7 9-13h-7z"/>,
    eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></>,
    chart: <><path d="M4 4v16h16"/><path d="M8 16v-4"/><path d="M13 16V9"/><path d="M18 16v-7"/></>,
    sparkles: <><path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z"/><path d="M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8z"/></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
         className={className} aria-hidden="true">
      {paths[name]}
    </svg>
  );
};

window.Icon = Icon;
