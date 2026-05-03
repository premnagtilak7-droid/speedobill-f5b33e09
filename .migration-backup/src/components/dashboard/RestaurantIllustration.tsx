// Subtle decorative SVG used in the dashboard greeting card.
// Pure SVG, no external deps, inherits color via currentColor.

const RestaurantIllustration = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 220 140"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    className={className}
  >
    <defs>
      <linearGradient id="ri-plate" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.35" />
        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.05" />
      </linearGradient>
      <linearGradient id="ri-steam" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.5" />
        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
      </linearGradient>
    </defs>

    {/* Steam wisps */}
    <path d="M120 30 C 116 20, 124 14, 120 4" stroke="url(#ri-steam)" strokeWidth="2.5" strokeLinecap="round" />
    <path d="M138 32 C 134 22, 142 16, 138 6" stroke="url(#ri-steam)" strokeWidth="2.5" strokeLinecap="round" />
    <path d="M156 30 C 152 20, 160 14, 156 4" stroke="url(#ri-steam)" strokeWidth="2.5" strokeLinecap="round" />

    {/* Plate */}
    <ellipse cx="138" cy="92" rx="70" ry="14" fill="hsl(var(--foreground) / 0.06)" />
    <ellipse cx="138" cy="86" rx="70" ry="14" fill="url(#ri-plate)" stroke="hsl(var(--primary) / 0.55)" strokeWidth="1.5" />
    <ellipse cx="138" cy="84" rx="56" ry="10" fill="hsl(var(--background) / 0.4)" stroke="hsl(var(--primary) / 0.3)" strokeWidth="1" />

    {/* Fork */}
    <g stroke="hsl(var(--primary) / 0.85)" strokeWidth="2" strokeLinecap="round">
      <line x1="32" y1="42" x2="32" y2="120" />
      <line x1="26" y1="42" x2="26" y2="62" />
      <line x1="38" y1="42" x2="38" y2="62" />
      <line x1="20" y1="42" x2="20" y2="58" />
      <line x1="44" y1="42" x2="44" y2="58" />
    </g>

    {/* Knife */}
    <path d="M198 42 L 206 42 L 200 100 L 194 100 Z" fill="hsl(var(--primary) / 0.25)" stroke="hsl(var(--primary) / 0.7)" strokeWidth="1.5" />
    <line x1="200" y1="100" x2="200" y2="125" stroke="hsl(var(--primary) / 0.85)" strokeWidth="2.5" strokeLinecap="round" />

    {/* Chef hat (small) */}
    <g transform="translate(70 36)">
      <ellipse cx="20" cy="22" rx="22" ry="6" fill="hsl(var(--foreground) / 0.08)" />
      <path
        d="M4 22 C 0 8, 12 2, 20 6 C 28 2, 40 8, 36 22 Z"
        fill="hsl(var(--card))"
        stroke="hsl(var(--primary) / 0.55)"
        strokeWidth="1.5"
      />
      <rect x="4" y="22" width="32" height="6" rx="1.5" fill="hsl(var(--primary) / 0.18)" stroke="hsl(var(--primary) / 0.55)" strokeWidth="1" />
    </g>
  </svg>
);

export default RestaurantIllustration;
