import React from 'react';

type StatusPillVariant =
  | 'default'
  | 'pending'
  | 'in-progress'
  | 'completed'
  | 'approved'
  | 'rejected'
  | 'late'
  | 'urgent'
  | 'onHold'
  | 'cancelled'
  | 'shipped'
  | 'delivered'
  | 'invoiced'
  | 'paid'
  | 'overdue';

type StatusPillSize = 'sm' | 'md' | 'lg';

export interface StatusPillProps extends React.HTMLAttributes<HTMLSpanElement> {
  /**
   * The status variant determining the color scheme
   */
  variant?: StatusPillVariant;
  /**
   * The size of the pill
   */
  size?: StatusPillSize;
  /**
   * Optional icon to display before the label
   */
  icon?: React.ReactNode;
  /**
   * The label text to display
   */
  children: React.ReactNode;
}

const variantClasses: Record<StatusPillVariant, string> = {
  default: 'bg-muted text-muted-foreground border-border',
  pending: 'bg-warning-light text-warning border-warning/20',
  'in-progress': 'bg-info-light text-info border-info/20',
  completed: 'bg-success-light text-success border-success/20',
  approved: 'bg-success-light text-success border-success/20',
  rejected: 'bg-danger-light text-danger border-danger/20',
  late: 'bg-danger-light text-danger border-danger/20',
  urgent: 'bg-danger-light text-danger border-danger/20',
  onHold: 'bg-muted text-muted-foreground border-border',
  cancelled: 'bg-muted text-muted-foreground border-border line-through',
  shipped: 'bg-primary/10 text-primary border-primary/20',
  delivered: 'bg-success-light text-success border-success/20',
  invoiced: 'bg-info-light text-info border-info/20',
  paid: 'bg-success-light text-success border-success/20',
  overdue: 'bg-danger-light text-danger border-danger/20',
};

const sizeClasses: Record<StatusPillSize, string> = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-3 py-1.5 text-xs',
  lg: 'px-4 py-2 text-sm',
};

/**
 * StatusPill component for displaying status indicators with color-coded pill design
 *
 * @example
 * ```tsx
 * <StatusPill variant="completed">Completed</StatusPill>
 * <StatusPill variant="pending" icon={<Clock />}>Pending</StatusPill>
 * <StatusPill variant="late" size="sm">Late</StatusPill>
 * ```
 */
export const StatusPill = React.forwardRef<HTMLSpanElement, StatusPillProps>(
  ({ className = '', variant = 'default', size = 'md', icon, children, ...props }, ref) => {
    const variantClass = variantClasses[variant];
    const sizeClass = sizeClasses[size];

    return (
      <span
        ref={ref}
        className={`status-pill border ${variantClass} ${sizeClass} ${className}`}
        {...props}
      >
        {icon && <span className="flex-shrink-0">{icon}</span>}
        {children}
      </span>
    );
  }
);

StatusPill.displayName = 'StatusPill';

export default StatusPill;
