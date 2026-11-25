// Small line icons in airport wayfinding style.
const base = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2,
  strokeLinecap: 'round', strokeLinejoin: 'round' }

export const Icon = {
  plane: (p) => (
    <svg {...base} {...p} fill="currentColor" stroke="none"><path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z" /></svg>
  ),
  play: (p) => <svg {...base} {...p} fill="currentColor" stroke="none"><path d="M7 4l13 8-13 8z" /></svg>,
  pause: (p) => <svg {...base} {...p} fill="currentColor" stroke="none"><path d="M6 4h4v16H6zM14 4h4v16h-4z" /></svg>,
  sound: (p) => <svg {...base} {...p}><path d="M11 5L6 9H3v6h3l5 4z" /><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" /></svg>,
  mute: (p) => <svg {...base} {...p}><path d="M11 5L6 9H3v6h3l5 4z" /><path d="M22 9l-6 6M16 9l6 6" /></svg>,
  lab: (p) => <svg {...base} {...p}><path d="M9 3h6M10 3v6L4 19a2 2 0 0 0 2 3h12a2 2 0 0 0 2-3l-6-10V3" /></svg>,
  race: (p) => <svg {...base} {...p}><path d="M4 21V4M4 4h12l-2 4 2 4H4" /></svg>,
  search: (p) => <svg {...base} {...p}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>,
  data: (p) => <svg {...base} {...p}><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" /></svg>,
  story: (p) => <svg {...base} {...p}><path d="M4 4h16v12H8l-4 4z" /></svg>,
  motion: (p) => <svg {...base} {...p}><path d="M3 12h4l3-8 4 16 3-8h4" /></svg>,
  check: (p) => <svg {...base} {...p}><path d="M5 12l5 5L20 7" /></svg>,
  alert: (p) => <svg {...base} {...p}><path d="M12 3l10 18H2zM12 10v5M12 18h.01" /></svg>
}
