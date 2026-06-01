import { Icon } from './icons.jsx';

/* Avatars, source badges, small primitives */
export const initialsOf = (name) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map(s => s[0]).join('').toUpperCase();

export const Avatar = ({ name, size = 'sm', muted = false }) => (
  <span className={`avatar ${size} ${muted ? 'muted' : ''}`} title={name}>
    {initialsOf(name)}
  </span>
);

/* Marks a feature whose external integration is simulated (no real
   Nango/email/Slack/source-system is wired). Purely a demo indicator. */
export const SimBadge = ({ label = 'Simulated', title = 'Demo only — no external service is connected', size = 11 }) => (
  <span className="simBadge" title={title}>
    <Icon name="sparkles" size={size} /> {label}
  </span>
);

export const SourceBadges = ({ sources }) => (
  <span className="sourceIcons">
    {sources.map(s => (
      <span key={s} className={`src ${s.toLowerCase()}`} title={`Data source: ${s}`}>{s}</span>
    ))}
  </span>
);

export const fmtMoney = (n) => {
  if (!n && n !== 0) return '';
  if (n >= 1_000_000) return '€' + (n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 2) + 'M';
  if (n >= 1_000)     return '€' + Math.round(n / 1_000) + 'k';
  return '€' + n.toLocaleString('en-EU');
};

export const TrackTag = ({ track, children }) => (
  <span className="trackTag" data-track={track}>{children}</span>
);
