import React from 'react';

interface LogoProps {
  size?: number;
  showText?: boolean;
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({ size = 32, showText = false, className = '' }) => {
  return (
    <div
      className={`logo-container ${className}`}
      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.65rem' }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ flexShrink: 0 }}
      >
        <defs>
          <linearGradient id="docIntelGrad" x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
            <stop stopColor="#6366F1" />
            <stop offset="0.5" stopColor="#8B5CF6" />
            <stop offset="1" stopColor="#EC4899" />
          </linearGradient>
        </defs>

        {/* Squircle container background */}
        <rect x="2" y="2" width="44" height="44" rx="12" fill="url(#docIntelGrad)" />
        <rect
          x="2"
          y="2"
          width="44"
          height="44"
          rx="12"
          stroke="rgba(255,255,255,0.25)"
          strokeWidth="1.5"
        />

        {/* Back document shadow layer */}
        <path d="M16 10H30L35 15V32H16V10Z" fill="rgba(0,0,0,0.25)" />

        {/* Main Document Page with folded corner */}
        <path
          d="M13 13C13 11.8954 13.8954 11 15 11H26.5L33 17.5V34C33 35.1046 32.1046 36 31 36H15C13.8954 36 13 35.1046 13 34V13Z"
          fill="#0B0F19"
          stroke="rgba(255,255,255,0.5)"
          strokeWidth="1.4"
        />

        {/* Fold corner */}
        <path
          d="M26.5 11V16C26.5 16.8284 27.1716 17.5 28 17.5H33"
          fill="none"
          stroke="rgba(255,255,255,0.5)"
          strokeWidth="1.4"
        />

        {/* Document scan / content lines */}
        <line x1="17" y1="21" x2="24" y2="21" stroke="#38BDF8" strokeWidth="1.6" strokeLinecap="round" />
        <line
          x1="17"
          y1="25.5"
          x2="29"
          y2="25.5"
          stroke="#FFFFFF"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeOpacity="0.85"
        />
        <line
          x1="17"
          y1="30"
          x2="23"
          y2="30"
          stroke="#FFFFFF"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeOpacity="0.55"
        />

        {/* AI Intelligence Sparkle badge in bottom-right corner */}
        <circle cx="32" cy="32" r="5.5" fill="#4F46E5" stroke="#818CF8" strokeWidth="1" />
        <path
          d="M32 28L32.8 30.8L35.6 31.6L32.8 32.4L32 35.2L31.2 32.4L28.4 31.6L31.2 30.8L32 28Z"
          fill="#FFFFFF"
        />
      </svg>

      {showText && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <span style={{ fontSize: '1.05rem', fontWeight: 700, letterSpacing: '-0.02em', color: '#FFFFFF' }}>
              Document Intelligence
            </span>
            <span className="brand-tag">v1.0 MVP</span>
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
            Secure Ingestion • Evidence Linking • Safe SQL
          </span>
        </div>
      )}
    </div>
  );
};
