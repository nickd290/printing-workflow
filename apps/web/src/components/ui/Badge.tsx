import React from 'react';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'dark-success' | 'dark-warning' | 'dark-danger' | 'dark-info';
  className?: string;
  icon?: React.ReactNode;
}

export function Badge({
  children,
  variant = 'neutral',
  className = '',
  icon,
}: BadgeProps) {
  const variantClasses = {
    primary: 'bg-primary/10 text-primary border border-primary/20',
    success: 'badge-success',
    warning: 'badge-warning',
    danger: 'badge-danger',
    info: 'badge-info',
    neutral: 'badge-neutral',
    'dark-success': 'dark-badge-success',
    'dark-warning': 'dark-badge-warning',
    'dark-danger': 'dark-badge-danger',
    'dark-info': 'dark-badge-info',
  };

  return (
    <span className={`badge ${variantClasses[variant]} ${className}`}>
      {icon && <span className="mr-1">{icon}</span>}
      {children}
    </span>
  );
}

// Status Badge for job statuses
export interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  // Map job statuses to badge variants
  const statusMap: Record<string, { variant: BadgeProps['variant']; label: string; icon?: string }> = {
    PENDING: { variant: 'neutral', label: 'Pending', icon: '⏳' },
    IN_PRODUCTION: { variant: 'info', label: 'In Production', icon: '🔧' },
    READY_FOR_PROOF: { variant: 'warning', label: 'Ready for Proof', icon: '👁️' },
    PROOF_APPROVED: { variant: 'success', label: 'Proof Approved', icon: '✓' },
    COMPLETED: { variant: 'success', label: 'Completed', icon: '✓' },
    CANCELLED: { variant: 'danger', label: 'Cancelled', icon: '✕' },
    ON_HOLD: { variant: 'warning', label: 'On Hold', icon: '⏸' },
  };

  const config = statusMap[status] || { variant: 'neutral', label: status.replace(/_/g, ' ') };

  return (
    <Badge variant={config.variant} className={className}>
      {config.label}
    </Badge>
  );
}

// Dot Badge for subtle status indicators
export interface DotBadgeProps {
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  children?: React.ReactNode;
  className?: string;
}

export function DotBadge({ variant = 'neutral', children, className = '' }: DotBadgeProps) {
  const dotColors = {
    success: 'bg-success',
    warning: 'bg-warning',
    danger: 'bg-danger',
    info: 'bg-info',
    neutral: 'bg-muted-foreground',
  };

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span className={`w-2 h-2 rounded-full ${dotColors[variant]}`} />
      {children && <span className="text-sm text-foreground">{children}</span>}
    </span>
  );
}
