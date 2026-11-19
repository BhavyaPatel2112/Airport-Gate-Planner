// Top-down aircraft silhouettes, nose pointing to +x. Drawn in SVG; tail colour per airline.

export function PlaneShape({ wide, tail, night, strobe }) {
  const s = wide ? 1.45 : 1
  return (
    <g transform={'scale(' + s + ')'}>
      {/* wings */}
      <path d="M5 -2.6 L-5 -19.5 L-9.5 -19.5 L-5.5 -2.6 Z M5 2.6 L-5 19.5 L-9.5 19.5 L-5.5 2.6 Z" fill="#d4dae2" />
      <path d="M-5 -19.5 L-9.5 -19.5 L-9 -18 L-5.2 -18 Z M-5 19.5 L-9.5 19.5 L-9 18 L-5.2 18 Z" fill={tail} />
      {/* engines */}
      <rect x="-1.5" y={wide ? -11 : -9.5} width="7" height="2.8" rx="1.2" fill="#5b6470" />
      <rect x="-1.5" y={wide ? 8.2 : 6.7} width="7" height="2.8" rx="1.2" fill="#5b6470" />
      {/* tailplane */}
      <path d="M-15.5 -2 L-21 -8.5 L-23.2 -8.5 L-20.5 -2 Z M-15.5 2 L-21 8.5 L-23.2 8.5 L-20.5 2 Z" fill={tail} />
      {/* fuselage */}
      <path d="M22.5 0 C22.5 -2.4 20 -3 16 -3 L-19 -2.6 C-22 -2.4 -24 -1.2 -24.5 0 C-24 1.2 -22 2.4 -19 2.6 L16 3 C20 3 22.5 2.4 22.5 0 Z"
        fill="#f5f7fa" />
      <path d="M-14 -0.9 L-24.3 -0.4 L-24.3 0.4 L-14 0.9 Z" fill={tail} />
      <path d="M21 -1.2 C21.8 -0.6 21.8 0.6 21 1.2 L19.4 1 L19.4 -1 Z" fill="#273447" />
      {night && (
        <>
          <circle cx="-7.2" cy="-19.4" r="1.4" fill="#ff3b3b" />
          <circle cx="-7.2" cy="19.4" r="1.4" fill="#3bff7a" />
          {strobe && <circle cx="-24" cy="0" r="1.8" fill="#ffffff" />}
        </>
      )}
    </g>
  )
}

export function PlaneShadow({ wide }) {
  const s = wide ? 1.45 : 1
  return (
    <g transform={'scale(' + s + ')'}>
      <path d="M5 -2.6 L-5 -19.5 L-9.5 -19.5 L-5.5 -2.6 Z M5 2.6 L-5 19.5 L-9.5 19.5 L-5.5 2.6 Z M-15.5 -2 L-21 -8.5 L-23.2 -8.5 L-20.5 -2 Z M-15.5 2 L-21 8.5 L-23.2 8.5 L-20.5 2 Z M22.5 0 C22.5 -2.4 20 -3 16 -3 L-19 -2.6 C-22 -2.4 -24 -1.2 -24.5 0 C-24 1.2 -22 2.4 -19 2.6 L16 3 C20 3 22.5 2.4 22.5 0 Z" />
    </g>
  )
}
