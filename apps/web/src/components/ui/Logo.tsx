import React from 'react';

interface LogoProps {
  className?: string;
  variant?: 'full' | 'icon' | 'text';
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizeMap = {
  sm: { height: 24, width: 24, fontSize: 'text-sm' },
  md: { height: 32, width: 32, fontSize: 'text-base' },
  lg: { height: 48, width: 48, fontSize: 'text-2xl' },
  xl: { height: 64, width: 64, fontSize: 'text-3xl' },
};

export const Logo: React.FC<LogoProps> = ({
  className = '',
  variant = 'full',
  size = 'md'
}) => {
  const dimensions = sizeMap[size];

  const LogoIcon = () => (
    <svg
      width={dimensions.width}
      height={dimensions.height}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Modern minimalist logo representing layered printing with workflow path */}

      {/* Bottom layer - lightest */}
      <path
        d="M8 20 L24 20 L24 22 L8 22 Z"
        fill="currentColor"
        opacity="0.3"
      />

      {/* Middle layer */}
      <path
        d="M6 15 L26 15 L26 17 L6 17 Z"
        fill="currentColor"
        opacity="0.5"
      />

      {/* Top layer - most prominent */}
      <path
        d="M4 10 L28 10 L28 12 L4 12 Z"
        fill="currentColor"
        opacity="0.8"
      />

      {/* Workflow arrow - curved path through layers */}
      <path
        d="M16 6 L16 11 M16 11 L16 16 M16 16 L16 21 M16 21 L16 26"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="0 4"
        opacity="1"
      />

      {/* Arrow head */}
      <path
        d="M16 26 L13 23 M16 26 L19 23"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  const LogoText = () => (
    <span className={`font-semibold tracking-tight ${dimensions.fontSize}`}>
      <span className="bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
        Print
      </span>
      <span className="text-foreground/90">Flow</span>
    </span>
  );

  if (variant === 'icon') {
    return <LogoIcon />;
  }

  if (variant === 'text') {
    return <LogoText />;
  }

  // Full logo with icon and text
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <LogoIcon />
      <LogoText />
    </div>
  );
};

export default Logo;
