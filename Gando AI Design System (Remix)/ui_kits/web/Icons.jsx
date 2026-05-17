// Icon library — thin Lucide-style SVGs so the kit doesn't depend on a CDN at render-time.
// Stroke 2px, rounded joins, 24x24. Match Lucide visual vocabulary.
const { createElement: h } = React;

const svgBase = (size = 16) => ({
  width: size, height: size, viewBox: "0 0 24 24",
  fill: "none", stroke: "currentColor", strokeWidth: 2,
  strokeLinecap: "round", strokeLinejoin: "round",
});

const Icon = ({ name, size = 16, style, className }) => {
  // Intentionally loud fallback: a circle with a slash. If you see this in the UI,
  // you typo'd an icon name — don't paper over it with a sparkle.
  const paths = ICONS[name] || ICONS.__missing;
  return h("svg", { ...svgBase(size), style, className, dangerouslySetInnerHTML: { __html: paths } });
};

const ICONS = {
  __missing: `<circle cx="12" cy="12" r="9"/><path d="M5 5l14 14"/>`,
  dashboard: `<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>`,
  folder:    `<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>`,
  globe:     `<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18"/><path d="M12 3a14 14 0 0 0 0 18"/>`,
  settings:  `<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>`,
  users:     `<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9"/><path d="M16 3.1a4 4 0 0 1 0 7.8"/>`,
  book:      `<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5V22h16"/>`,
  activity:  `<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>`,
  logout:    `<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>`,
  chevronR:  `<path d="M9 6l6 6-6 6"/>`,
  chevronL:  `<path d="M15 6l-6 6 6 6"/>`,
  chevronD:  `<path d="M6 9l6 6 6-6"/>`,
  rotate:    `<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>`,
  x:         `<path d="M18 6L6 18"/><path d="M6 6l12 12"/>`,
  search:    `<circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/>`,
  bell:      `<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>`,
  lock:      `<rect x="3" y="11" width="18" height="10" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>`,
  send:      `<path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/>`,
  download:  `<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>`,
  trash:     `<path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>`,
  eye:       `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/>`,
  code:      `<path d="M16 18l6-6-6-6"/><path d="M8 6l-6 6 6 6"/>`,
  copy:      `<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>`,
  mic:       `<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M19 10a7 7 0 0 1-14 0"/><path d="M12 17v4"/>`,
  user:      `<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>`,
  bot:       `<rect x="3" y="8" width="18" height="12" rx="2"/><path d="M12 2v6"/><circle cx="8.5" cy="14" r="1"/><circle cx="15.5" cy="14" r="1"/>`,
  arrowR:    `<path d="M5 12h14"/><path d="M12 5l7 7-7 7"/>`,
  check:     `<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>`,
  alert:     `<circle cx="12" cy="12" r="9"/><path d="M12 8v4"/><path d="M12 16h.01"/>`,
  xcircle:   `<circle cx="12" cy="12" r="9"/><path d="M15 9l-6 6"/><path d="M9 9l6 6"/>`,
  thumbUp:   `<path d="M7 11V21H4a1 1 0 0 1-1-1V12a1 1 0 0 1 1-1zM7 11l4-8a3 3 0 0 1 3 3v4h5a2 2 0 0 1 2 2l-2 7a2 2 0 0 1-2 1h-8"/>`,
  thumbDown: `<path d="M17 13V3h3a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1zM17 13l-4 8a3 3 0 0 1-3-3v-4H5a2 2 0 0 1-2-2l2-7a2 2 0 0 1 2-1h8"/>`,
  loader:    `<path d="M21 12a9 9 0 1 1-6.2-8.5"/>`,
  layout:    `<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/>`,
  grad:      `<path d="M22 10L12 4 2 10l10 6 10-6z"/><path d="M6 12v5l6 3 6-3v-5"/>`,
  plus:      `<path d="M12 5v14"/><path d="M5 12h14"/>`,
};

window.Icon = Icon;
