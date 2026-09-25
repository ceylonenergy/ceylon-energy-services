/** The line icons from the original index.html, drawn with the same SVG paths. */
const PATHS = {
  plug: (
    <>
      <path d="M9 2v4" />
      <path d="M15 2v4" />
      <path d="M6 6h12v5a6 6 0 01-12 0V6z" />
      <path d="M12 17v3" />
      <path d="M9 22h6" />
    </>
  ),
  battery: (
    <>
      <rect x="3" y="7" width="16" height="10" rx="1" />
      <rect x="19" y="10" width="2" height="4" fill="currentColor" stroke="none" />
      <line x1="7" y1="10" x2="7" y2="14" />
      <line x1="12" y1="10" x2="12" y2="14" />
    </>
  ),
  cycle: (
    <>
      <path d="M4 12a8 8 0 0113-6" />
      <path d="M20 12a8 8 0 01-13 6" />
      <path d="M17 3v4h-4" />
      <path d="M7 21v-4h4" />
    </>
  ),
  panel: (
    <>
      <rect x="3" y="5" width="18" height="12" rx="1" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="3" y1="13" x2="21" y2="13" />
      <line x1="9" y1="5" x2="9" y2="17" />
      <line x1="15" y1="5" x2="15" y2="17" />
    </>
  ),
  inverter: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M13 7l-4 6h3l-1 5 5-7h-3l1-4z" fill="currentColor" stroke="none" />
    </>
  ),
  cable: (
    <>
      <circle cx="5" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
      <path d="M7 12c2-3 4-3 5 0s3 3 5 0" />
    </>
  ),
  shieldBolt: (
    <>
      <path d="M12 3l7 3v6c0 5-3 8-7 9-4-1-7-4-7-9V6l7-3z" />
      <path d="M13 8l-3 5h2l-1 4 4-5h-2z" fill="currentColor" stroke="none" />
    </>
  ),
  roof: (
    <>
      <path d="M3 12L12 4l9 8" />
      <path d="M5 12v7h14v-7" />
    </>
  ),
  shieldCheck: (
    <>
      <path d="M12 3l7 3v6c0 5-3 8-7 9-4-1-7-4-7-9V6l7-3z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  gauge: (
    <>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 13l4-4" />
      <path d="M9 5h6" />
    </>
  ),
  wrench: <path d="M14.7 6.3a4 4 0 00-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 005.4-5.4l-2.8 2.8-2-2z" />,
  bulb: (
    <>
      <path d="M9 18h6" />
      <path d="M10 21h4" />
      <path d="M12 3a6 6 0 00-3 11c.6.5 1 1.2 1 2h4c0-.8.4-1.5 1-2a6 6 0 00-3-11z" />
    </>
  ),
};

export default function Icon({ name }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}

/** The small lightning bolt inside each brand chip. */
export function Bolt() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z" />
    </svg>
  );
}
