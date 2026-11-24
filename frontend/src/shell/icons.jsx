// Line icons for the shell (24px grid, drawn with currentColor).
const P = {
  plane: 'M2.5 13.5l7-1.5 4.5-8h2l-2 8 5 .5 1.5-2h1.5l-1 3.5 1 3.5H20l-1.5-2-5 .5 2 8h-2l-4.5-8-7-1.5z',
  play: 'M7 4.5v15l12-7.5z',
  help: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM9.6 9.4a2.5 2.5 0 1 1 3.4 2.4c-.6.3-1 .8-1 1.5v.6M12 17.2v.1',
  pause: 'M7 4.5h3.5v15H7zM13.5 4.5H17v15h-3.5z',
  overview: 'M3 7.5l9-4.5 9 4.5-9 4.5zM3 12l9 4.5 9-4.5M3 16.5l9 4.5 9-4.5',
  tower: 'M10 21V11h4v10M8 11h8l1-4H7zM9 7V4h6v3M12 4V2',
  t2: 'M12 3v18M4.5 7l7.5 5 7.5-5M4.5 17l7.5-5 7.5 5',
  t1: 'M3 15h18v4H3zM6 15V9h12v6',
  runway: 'M9 3L5 21M15 3l4 18M12 5v2M12 10v2M12 15v2',
  remote: 'M4 20V9l8-5 8 5v11M9 20v-6h6v6',
  follow: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  layers: 'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5',
  heat: 'M12 3c3 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-5 3-7 1 2 1 3 3 4 0-3-1-5 0-8z',
  labels: 'M4 6h16M4 12h10M4 18h7',
  vehicle: 'M3 16V9h11l3 4h4v3M6.5 16a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM16.5 16a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z',
  closed: 'M6 6l12 12M18 6L6 18',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  close: 'M6 6l12 12M18 6L6 18',
  chevronDown: 'M6 9l6 6 6-6',
  chevronUp: 'M6 15l6-6 6 6',
  chevronRight: 'M9 6l6 6-6 6',
  story: 'M4 5h11a5 5 0 0 1 5 5v9H9a5 5 0 0 1-5-5zM9 10h6M9 14h4',
  lab: 'M9 3h6M10 3v6L4.5 18.5A2 2 0 0 0 6.2 21h11.6a2 2 0 0 0 1.7-2.5L14 9V3',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  algo: 'M4 6h6v6H4zM14 12h6v6h-6zM10 9h4v6',
  flights: 'M3 7h18M3 12h18M3 17h12',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-4.5-4.5',
  storm: 'M7 15a4 4 0 0 1-.5-8A6 6 0 0 1 18 8a3.5 3.5 0 0 1 0 7M12 13l-2 4h3l-2 4',
  fog: 'M4 9h16M2 13h20M5 17h14M7 5h10',
  rush: 'M2.5 13.5l7-1.5 4.5-8h2l-2 8 5 .5 1.5-2h1.5l-1 3.5 1 3.5H20l-1.5-2-5 .5 2 8h-2l-4.5-8-7-1.5z',
  twy: 'M4 20L10 4M14 4l6 16M12 7v2M12 12v2M12 17v2',
  delay: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 3',
  cancel: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM8 8l8 8',
  swap: 'M4 8h13l-3-3M20 16H7l3 3',
  real: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5',
  trash: 'M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13',
  check: 'M5 12l5 5L19 7',
  alert: 'M12 3l10 18H2zM12 10v4M12 17.5v.5',
  info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v6M12 7.5v.5',
  bolt: 'M13 2L4 14h7l-1 8 9-12h-7z',
  compare: 'M8 4v16M16 4v16M4 8h8M12 16h8',
  reset: 'M4 12a8 8 0 1 0 2.3-5.7L4 8.6M4 4v4.6h4.6',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z',
  speed: 'M12 13l4-4M4 18a9 9 0 1 1 16 0',
  quality: 'M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z',
  globe: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c2.5 2.5 3.8 5.5 3.8 9S14.5 18.5 12 21c-2.5-2.5-3.8-5.5-3.8-9S9.5 5.5 12 3z',
  seat: 'M7 3h7a2 2 0 0 1 2 2v8H7zM5 13h14v3H5zM7 16v5M17 16v5',
  arrowRight: 'M5 12h14M13 6l6 6-6 6',
  arrowLeft: 'M19 12H5M11 6l-6 6 6 6',
  skip: 'M5 5l9 7-9 7zM17 5v14',
  pin: 'M12 21s7-6 7-12a7 7 0 0 0-14 0c0 6 7 12 7 12zM12 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  sound: 'M11 5L6 9H3v6h3l5 4zM15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13',
  mute: 'M11 5L6 9H3v6h3l5 4zM22 9l-6 6M16 9l6 6',
  roam: 'M12 2.5l2.6 5.5H9.4zM12 21.5l-2.6-5.5h5.2zM2.5 12L8 9.4v5.2zM21.5 12L16 14.6V9.4zM12 10.2a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6z',
  drag: 'M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01'
}

export default function Ico({ n, size = 16, fill = false, ...rest }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'} stroke={fill ? 'none' : 'currentColor'}
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      <path d={P[n] || P.info} />
    </svg>
  )
}
