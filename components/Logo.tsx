'use client'

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
      className="drop-shadow-[0_2px_10px_rgba(139,92,246,0.35)]"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="logo-grad-primary" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#a855f7" /> {/* Violet 500 */}
          <stop offset="50%" stopColor="#ec4899" /> {/* Pink 500 */}
          <stop offset="100%" stopColor="#3b82f6" /> {/* Blue 500 */}
        </linearGradient>
        <linearGradient id="logo-grad-secondary" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#06b6d4" /> {/* Cyan 500 */}
          <stop offset="100%" stopColor="#8b5cf6" /> {/* Violet 500 */}
        </linearGradient>
        <filter id="logo-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Outer Squircle with glowing gradient border */}
      <rect
        x="1.5"
        y="1.5"
        width="29"
        height="29"
        rx="9"
        stroke="url(#logo-grad-primary)"
        strokeWidth="2"
        fill="#0d0d12"
      />

      {/* Glassmorphic Inner Frame */}
      <rect
        x="6"
        y="6"
        width="20"
        height="20"
        rx="5.5"
        fill="url(#logo-grad-secondary)"
        fillOpacity="0.12"
        stroke="white"
        strokeWidth="1"
        strokeOpacity="0.08"
      />

      {/* Glowing Backdrop for Play Triangle */}
      <path
        d="M13 10 L21 16 L13 22 Z"
        fill="url(#logo-grad-primary)"
        filter="url(#logo-glow)"
        opacity="0.8"
      />

      {/* Sharp Foreground Play Triangle */}
      <path
        d="M13.25 10.5 L20.5 16 L13.25 21.5 Z"
        fill="white"
        fillOpacity="0.95"
      />
    </svg>
  )
}

export function AppLogoWordmark({ iconSize = 28 }: { iconSize?: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <AppLogo size={iconSize} />
      <span className="bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-white/70 font-extrabold text-xl tracking-tight">
        Watchlist
      </span>
    </div>
  )
}
