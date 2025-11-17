'use client';

import React from 'react';

export type ViewMode = 'grid' | 'list';

export interface ViewSwitcherProps {
  currentView: ViewMode;
  onViewChange: (view: ViewMode) => void;
  className?: string;
}

export function ViewSwitcher({ currentView, onViewChange, className = '' }: ViewSwitcherProps) {
  return (
    <div className={`inline-flex items-center gap-1 p-1 bg-muted rounded-lg ${className}`}>
      {/* Grid View Button */}
      <button
        onClick={() => onViewChange('grid')}
        className={`
          px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200
          flex items-center gap-2
          ${currentView === 'grid'
            ? 'bg-background shadow-sm text-foreground'
            : 'text-muted-foreground hover:text-foreground'
          }
        `}
        title="Grid View"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
        <span className="hidden sm:inline">Grid</span>
      </button>

      {/* List View Button */}
      <button
        onClick={() => onViewChange('list')}
        className={`
          px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200
          flex items-center gap-2
          ${currentView === 'list'
            ? 'bg-background shadow-sm text-foreground'
            : 'text-muted-foreground hover:text-foreground'
          }
        `}
        title="List View"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
        <span className="hidden sm:inline">List</span>
      </button>
    </div>
  );
}
