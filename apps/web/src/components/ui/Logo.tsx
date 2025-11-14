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
      {/* Clean modern logo - Stacked documents with forward flow arrow */}

      {/* Circular background */}
      <circle
        cx="16"
        cy="16"
        r="14"
        fill="currentColor"
        opacity="0.1"
      />

      {/* Document stack - 3 sheets */}
      <rect
        x="8"
        y="10"
        width="10"
        height="12"
        rx="1"
        fill="currentColor"
        opacity="0.9"
      />
      <rect
        x="9"
        y="9"
        width="10"
        height="12"
        rx="1"
        fill="currentColor"
        opacity="0.95"
      />
      <rect
        x="10"
        y="8"
        width="10"
        height="12"
        rx="1"
        fill="currentColor"
      />

      {/* Forward flow arrow */}
      <path
        d="M20 14 L24 16 L20 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  const LogoText = () => (
    <span className={`font-semibold tracking-tight ${dimensions.fontSize}`}>
      <span className="text-primary">
        Print
      </span>
      <span className="text-foreground">Flow</span>
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
