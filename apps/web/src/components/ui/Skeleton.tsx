import React from 'react';

export interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'title' | 'avatar' | 'card' | 'button' | 'metric' | 'custom';
  dark?: boolean;
}

export function Skeleton({
  className = '',
  variant = 'custom',
  dark = false,
}: SkeletonProps) {
  const baseClass = dark ? 'dark-skeleton' : 'skeleton';

  const variantClasses = {
    text: dark ? 'dark-skeleton-text' : 'skeleton-text',
    title: dark ? 'dark-skeleton-title' : 'skeleton-title',
    avatar: 'skeleton-avatar',
    card: dark ? 'dark-skeleton-card' : 'skeleton-card',
    button: 'skeleton-button',
    metric: 'skeleton h-32 w-full rounded-xl',
    custom: baseClass,
  };

  return <div className={`${variantClasses[variant]} ${className}`} />;
}

// Skeleton for table rows
export interface SkeletonTableProps {
  rows?: number;
  columns?: number;
  className?: string;
}

export function SkeletonTable({ rows = 5, columns = 4, className = '' }: SkeletonTableProps) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex gap-4">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton key={colIndex} variant="text" className="flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

// Skeleton for card grid
export interface SkeletonGridProps {
  count?: number;
  columns?: number;
  className?: string;
  dark?: boolean;
}

export function SkeletonGrid({ count = 6, columns = 3, className = '', dark = false }: SkeletonGridProps) {
  const gridClass = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
  }[columns] || 'grid-cols-3';

  return (
    <div className={`grid ${gridClass} gap-6 ${className}`}>
      {Array.from({ length: count }).map((_, index) => (
        <Skeleton key={index} variant="card" dark={dark} />
      ))}
    </div>
  );
}

// Skeleton for list items
export interface SkeletonListProps {
  count?: number;
  className?: string;
  dark?: boolean;
}

export function SkeletonList({ count = 5, className = '', dark = false }: SkeletonListProps) {
  return (
    <div className={`space-y-4 ${className}`}>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="flex items-start gap-4">
          <Skeleton variant="avatar" dark={dark} />
          <div className="flex-1 space-y-2">
            <Skeleton variant="title" dark={dark} />
            <Skeleton variant="text" dark={dark} />
          </div>
        </div>
      ))}
    </div>
  );
}
