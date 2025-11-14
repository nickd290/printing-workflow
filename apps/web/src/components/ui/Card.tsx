import React from 'react';

export interface CardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'hover' | 'elevated' | 'dark' | 'dark-hover';
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
    dark: 'dark-card',
    'dark-hover': 'dark-card-hover cursor-pointer',
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

// Modern Metric Card for dashboards
export interface MetricCardProps {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  description?: string;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'primary';
  className?: string;
}

export function MetricCard({
  title,
  value,
  icon,
  description,
  variant = 'default',
  className = '',
}: MetricCardProps) {
  const variantStyles = {
    default: '',
    success: 'gradient-success',
    warning: 'gradient-warning',
    danger: 'gradient-danger',
    info: 'gradient-info',
    primary: 'gradient-primary',
  };

  const iconColorClasses = {
    default: 'text-muted-foreground/60',
    success: 'text-success/80',
    warning: 'text-warning/80',
    danger: 'text-danger/80',
    info: 'text-info/80',
    primary: 'text-primary/80',
  };

  return (
    <div className={`metric-card ${variantStyles[variant]} ${className}`}>
      <div className="flex items-start justify-between mb-4">
        <span className="kpi-label">{title}</span>
        {icon && (
          <div className={`flex-shrink-0 ${iconColorClasses[variant]}`}>
            {icon}
          </div>
        )}
      </div>
      <div className="kpi-number">{value}</div>
      {description && (
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      )}
    </div>
  );
}
