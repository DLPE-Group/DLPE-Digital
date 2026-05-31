import React from 'react';
import { Icon } from './icons.jsx';

/* ============================================================
   Theme provider + switcher (4 light themes)
   ============================================================ */

export const THEMES = [
  { id: 'default', name: 'Brand teal',
    desc: 'The original — clean white with brand teal, equal accent per track.',
    swatches: ['#028090', '#2563eb', '#e15728', '#15803d', '#8b5cf6'] },
  { id: 'sober',   name: 'Sober Pro',
    desc: 'Deep navy + cooler grays + sharper corners. Banking-feel B2B.',
    swatches: ['#0F3B6E', '#1f4d8a', '#a64228', '#2d6a3f', '#5a3c8f'] },
  { id: 'warm',    name: 'Warm Minimal',
    desc: 'Cream paper background, indigo brand, softer corners, gentler status colors.',
    swatches: ['#5B5BD6', '#fdfaf4', '#d97757', '#4a8a6c', '#b87fcb'] },
  { id: 'mono',    name: 'Mono Operational',
    desc: 'Near-black + neutral tracks + monospace UI. Maximum density.',
    swatches: ['#1f1f23', '#5a5a60', '#2e7d3e', '#b46c00', '#c33232'] },
  { id: 'pitch',   name: 'Pitch-aligned',
    desc: 'Navy + bright yellow accents from the pitch target\'s brand tokens. Yellow card stripe + slab-feel headings.',
    swatches: ['#133778', '#fdc207', '#027a48', '#b42318', '#cdd7e9'] },
];

export const ThemeContext = React.createContext({ theme: 'default', setTheme: () => {} });

export const ThemeProvider = ({ children }) => {
  const [theme, setThemeState] = React.useState(() => {
    try { return localStorage.getItem('itheme') || 'default'; } catch (e) { return 'default'; }
  });

  React.useEffect(() => {
    const root = document.documentElement;
    if (theme === 'default') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', theme);
    }
    try { localStorage.setItem('itheme', theme); } catch (e) {}
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme: setThemeState }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => React.useContext(ThemeContext);

export const ThemeSwitcher = () => {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  const current = THEMES.find(th => th.id === theme) || THEMES[0];

  React.useEffect(() => {
    if (!open) return;
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  return (
    <div className="themeSwitch" ref={ref}>
      <button className="themeTrigger" onClick={() => setOpen(o => !o)} title="Theme">
        <span className="themeSwatchRow">
          {current.swatches.slice(0, 3).map((c, i) => (
            <span key={i} style={{ background: c }} />
          ))}
        </span>
        <span>{current.name}</span>
        <Icon name="chevron" size={11} strokeWidth={2.5} />
      </button>
      {open && (
        <div className="themeMenu">
          <div className="themeHead">Theme</div>
          {THEMES.map(th => (
            <button key={th.id} className={`themeOption ${theme === th.id ? 'selected' : ''}`}
                    onClick={() => { setTheme(th.id); setOpen(false); }}>
              <div>
                <div className="name">{th.name}</div>
                <div className="desc">{th.desc}</div>
              </div>
              <div className="preview">
                {th.swatches.map((c, i) => (
                  <span key={i} style={{ background: c }} />
                ))}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
