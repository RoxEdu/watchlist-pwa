interface LogoProps {
  size?: number
}

export function AppLogo({ size = 32 }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id="watchlist-logo-grad"
          x1="1" y1="5" x2="31" y2="27"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#5b21b6" />
        </linearGradient>
      </defs>

      {/* Film strip body */}
      <rect x="1" y="5" width="30" height="22" rx="3" fill="url(#watchlist-logo-grad)" />

      {/* Left perforations */}
      <rect x="1"   y="7.5"  width="3.5" height="2.5" rx="0.6" fill="#050505" />
      <rect x="1"   y="12"   width="3.5" height="2.5" rx="0.6" fill="#050505" />
      <rect x="1"   y="16.5" width="3.5" height="2.5" rx="0.6" fill="#050505" />
      <rect x="1"   y="21"   width="3.5" height="2.5" rx="0.6" fill="#050505" />

      {/* Right perforations */}
      <rect x="27.5" y="7.5"  width="3.5" height="2.5" rx="0.6" fill="#050505" />
      <rect x="27.5" y="12"   width="3.5" height="2.5" rx="0.6" fill="#050505" />
      <rect x="27.5" y="16.5" width="3.5" height="2.5" rx="0.6" fill="#050505" />
      <rect x="27.5" y="21"   width="3.5" height="2.5" rx="0.6" fill="#050505" />

      {/* Screen area */}
      <rect x="6.5" y="8.5" width="19" height="15" rx="1.5" fill="#0d0520" />

      {/* Top strip divider lines */}
      <line x1="4.5" y1="5"  x2="4.5" y2="27" stroke="#050505" strokeWidth="0.5" strokeOpacity="0.6" />
      <line x1="27.5" y1="5" x2="27.5" y2="27" stroke="#050505" strokeWidth="0.5" strokeOpacity="0.6" />

      {/* Play triangle */}
      <path d="M13 12 L13 20 L21 16 Z" fill="#ddd6fe" fillOpacity="0.95" />
    </svg>
  )
}

export function AppLogoWordmark({ iconSize = 28 }: { iconSize?: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <AppLogo size={iconSize} />
      <span className="text-white font-bold text-xl tracking-tight">Watchlist</span>
    </div>
  )
}
