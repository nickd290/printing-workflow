/**
 * StatsBar Component
 * Horizontal metrics bar - replaces card grid layouts (Linear/Vercel style)
 */

import React from 'react';
import { ArrowUpIcon, ArrowDownIcon } from 'lucide-react';

export interface Stat {
  label: string;
  value: string | number;
  delta?: {
    value: string | number;
    type: 'positive' | 'negative' | 'neutral';
  };
  icon?: React.ReactNode;
  valueClassName?: string;
}

interface StatsBarProps {
  stats: Stat[];
  className?: string;
  showDividers?: boolean;
}

export function StatsBar({ stats, className = '', showDividers = true }: StatsBarProps) {
  return (
    <div className={`stats-bar ${className}`}>
      {stats.map((stat, index) => (
        <React.Fragment key={index}>
          <div className="stat-item">
            <div className="flex items-center gap-2">
              {stat.icon && (
                <div className="text-muted-foreground flex-shrink-0">
                  {stat.icon}
                </div>
              )}
              <div className="stat-label">{stat.label}</div>
            </div>
            <div className={`stat-value ${stat.valueClassName || ''}`}>
              {stat.value}
            </div>
            {stat.delta && (
              <div className={`stat-delta ${stat.delta.type}`}>
                {stat.delta.type === 'positive' && (
                  <ArrowUpIcon className="h-3 w-3" />
                )}
                {stat.delta.type === 'negative' && (
                  <ArrowDownIcon className="h-3 w-3" />
                )}
                <span>{stat.delta.value}</span>
              </div>
            )}
          </div>
          {showDividers && index < stats.length - 1 && (
            <div className="stat-divider" />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

export default StatsBar;
