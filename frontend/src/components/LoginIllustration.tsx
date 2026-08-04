/** Neon board illustration — transparent (no plate/background fill) */
export function LoginIllustration({ dark = false }: { dark?: boolean }) {
  const stroke = dark ? '#7DD3FC' : '#0284c7';
  const strokeSoft = dark ? 'rgba(125, 211, 252, 0.45)' : 'rgba(2, 132, 199, 0.4)';
  const glow = dark ? '#38BDF8' : '#0ea5e9';
  const fillPanel = dark ? 'rgba(15, 23, 42, 0.55)' : 'rgba(255, 255, 255, 0.72)';
  const fillCard = dark ? 'rgba(14, 165, 233, 0.15)' : 'rgba(14, 165, 233, 0.12)';
  const fillHot = dark ? '#0ea5e9' : '#0284c7';
  const avatarFill = dark ? '#0f172a' : '#ffffff';
  const uid = dark ? 'd' : 'l';

  return (
    <svg
      viewBox="0 0 720 560"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-full"
      aria-hidden
    >
      <defs>
        <filter id={`glow-${uid}`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id={`soft-${uid}`} x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="10" stdDeviation="16" floodColor={glow} floodOpacity={dark ? 0.35 : 0.2} />
        </filter>
      </defs>

      {/* Decorative rings only — no full-bleed background */}
      <g opacity={dark ? 0.5 : 0.35} className="login-float-slow">
        <circle cx="120" cy="100" r="52" stroke={stroke} strokeWidth="1.2" strokeDasharray="5 9" />
        <circle cx="600" cy="70" r="26" stroke={glow} strokeWidth="1.5" />
        <path
          d="M60 430 C170 370, 280 490, 400 410 S560 340, 680 390"
          stroke={stroke}
          strokeWidth="1.5"
          strokeDasharray="4 8"
          className="login-dash"
          opacity="0.6"
        />
      </g>

      {/* Main board */}
      <g className="login-float-a" filter={`url(#soft-${uid})`}>
        <g transform="translate(70 90) rotate(-5 210 145)">
          <rect
            width="420"
            height="290"
            rx="20"
            fill={fillPanel}
            stroke={stroke}
            strokeWidth="2"
            filter={`url(#glow-${uid})`}
          />
          <rect x="28" y="28" width="100" height="10" rx="5" fill={stroke} opacity="0.25" />
          <g transform="translate(28 58)">
            <rect width="112" height="190" rx="12" fill={fillCard} stroke={strokeSoft} strokeWidth="1.5" />
            <rect x="122" width="112" height="190" rx="12" fill={fillCard} stroke={strokeSoft} strokeWidth="1.5" />
            <rect x="244" width="112" height="190" rx="12" fill={fillCard} stroke={strokeSoft} strokeWidth="1.5" />

            <rect x="12" y="14" width="88" height="42" rx="8" fill="none" stroke={stroke} strokeWidth="1.5" />
            <rect x="12" y="68" width="88" height="36" rx="8" fill={fillHot} opacity="0.85" />
            <rect x="12" y="116" width="88" height="40" rx="8" fill="none" stroke={strokeSoft} strokeWidth="1.5" />

            <rect x="134" y="14" width="88" height="50" rx="8" fill="none" stroke={stroke} strokeWidth="1.5" />
            <rect x="134" y="76" width="88" height="38" rx="8" fill={fillHot} opacity="0.7" />

            <rect x="256" y="14" width="88" height="38" rx="8" fill="none" stroke={stroke} strokeWidth="1.5" />
            <rect x="256" y="64" width="88" height="54" rx="8" fill={fillHot} />
          </g>
        </g>
      </g>

      {/* Floating chip */}
      <g className="login-float-c" filter={`url(#glow-${uid})`}>
        <g transform="translate(510 120)">
          <rect width="148" height="56" rx="14" fill={fillHot} />
          <circle cx="28" cy="28" r="9" fill="#fff" opacity="0.9" />
          <rect x="48" y="18" width="76" height="7" rx="3.5" fill="#fff" opacity="0.95" />
          <rect x="48" y="32" width="50" height="6" rx="3" fill="#fff" opacity="0.45" />
        </g>
      </g>

      {/* Foreground card */}
      <g className="login-float-b" filter={`url(#soft-${uid})`}>
        <g transform="translate(380 300) rotate(7 125 95)">
          <rect
            width="250"
            height="190"
            rx="18"
            fill={fillPanel}
            stroke={stroke}
            strokeWidth="2"
            filter={`url(#glow-${uid})`}
          />
          <rect x="22" y="24" width="72" height="8" rx="4" fill={stroke} opacity="0.3" />
          <rect x="22" y="50" width="96" height="36" rx="8" fill={fillCard} stroke={strokeSoft} strokeWidth="1.5" />
          <rect x="130" y="50" width="96" height="36" rx="8" fill={fillHot} opacity="0.9" />
          <rect x="22" y="100" width="204" height="54" rx="10" fill={fillCard} stroke={strokeSoft} strokeWidth="1.5" />
          <rect x="36" y="120" width="176" height="10" rx="5" fill={stroke} opacity="0.15" />
          <rect x="36" y="120" width="104" height="10" rx="5" fill={fillHot} className="login-progress" />
        </g>
      </g>

      {/* Avatars */}
      <g className="login-float-slow">
        <g transform="translate(118 400)">
          <circle cx="0" cy="0" r="24" fill={avatarFill} stroke={stroke} strokeWidth="2" />
          <circle cx="0" cy="-3" r="8" fill={stroke} />
          <path d="M-12 12c2-9 22-9 24 0" fill={stroke} />
          <circle cx="38" cy="4" r="22" fill={fillHot} stroke={stroke} strokeWidth="2" />
          <circle cx="38" cy="1" r="7" fill={avatarFill} />
          <path d="M28 18c2-7 18-7 20 0" fill={avatarFill} />
          <circle cx="74" cy="-2" r="20" fill={avatarFill} stroke={glow} strokeWidth="2" />
          <circle cx="74" cy="-5" r="6" fill={stroke} />
          <path d="M64 12c2-6 18-6 20 0" fill={stroke} />
        </g>
      </g>

      {/* Badge */}
      <g transform="translate(560 470)">
        <g className="login-spin-slow">
          <circle cx="0" cy="0" r="38" fill="none" stroke={strokeSoft} strokeWidth="1.5" strokeDasharray="3 5" />
          <circle cx="0" cy="0" r="26" fill={fillHot} stroke={stroke} strokeWidth="1.5" filter={`url(#glow-${uid})`} />
          <path
            d="M-8 1l5 5 12-14"
            stroke="#fff"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </g>
      </g>
    </svg>
  );
}
