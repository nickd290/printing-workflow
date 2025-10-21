import React from 'react';

export interface CardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'hover' | 'elevated';
  onClick?: () => void;
}

export function Card({
  children,
  className = '',
  variant = 'default',
  onClick
}: CardProps) {
  const variantClasses = {
    default: 'card',
    hover: 'card-hover cursor-pointer',
    elevated: 'card-elevated',
  };

  return (
    <div
      className={`${variantClasses[variant]} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

export interface CardHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export function CardHeader({ children, className = '' }: CardHeaderProps) {
  return (
    <div className={`p-6 ${className}`}>
      {children}
    </div>
  );
}

export interface CardTitleProps {
  children: React.ReactNode;
  className?: string;
}

export function CardTitle({ children, className = '' }: CardTitleProps) {
  return (
    <h3 className={`text-lg font-semibold text-foreground ${className}`}>
      {children}
    </h3>
  );
}

export interface CardDescriptionProps {
  children: React.ReactNode;
  className?: string;
}

export function CardDescription({ children, className = '' }: CardDescriptionProps) {
  return (
    <p className={`text-sm text-muted-foreground mt-1 ${className}`}>
      {children}
    </p>
  );
}

export interface CardContentProps {
  children: React.ReactNode;
  className?: string;
}

export function CardContent({ children, className = '' }: CardContentProps) {
  return (
    <div className={`p-6 pt-0 ${className}`}>
      {children}
    </div>
  );
}

export interface CardFooterProps {
  children: React.ReactNode;
  className?: string;
}

export function CardFooter({ children, className = '' }: CardFooterProps) {
  return (
    <div className={`p-6 pt-0 flex items-center gap-2 ${className}`}>
      {children}
    </div>
  );
}

// Metric Card for dashboards
export interface MetricCardProps {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  description?: string;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  className?: string;
}

export function MetricCard({
  title,
  value,
  icon,
  trend,
  description,
  variant = 'default',
  className = '',
}: MetricCardProps) {
  const variantStyles = {
    default: 'border-border',
    success: 'border-success/20 bg-success-light/10',
    warning: 'border-warning/20 bg-warning-light/10',
    danger: 'border-danger/20 bg-danger-light/10',
    info: 'border-info/20 bg-info-light/10',
  };

  return (
    <Card className={`${variantStyles[variant]} ${className}`}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardDescription className="uppercase tracking-wide font-medium">
              {title}
            </CardDescription>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-foreground">{value}</span>
              {trend && (
                <span className={`text-sm font-medium ${trend.isPositive ? 'text-success' : 'text-danger'}`}>
                  {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
                </span>
              )}
            </div>
            {description && (
              <p className="mt-1 text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          {icon && (
            <div className="flex-shrink-0">{icon}</div>
          )}
        </div>
      </CardHeader>
    </Card>
  );
}
