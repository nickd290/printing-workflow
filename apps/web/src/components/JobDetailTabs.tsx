'use client';

import { useState } from 'react';

type TabType = 'details' | 'files' | 'financials';

interface Tab {
  id: TabType;
  label: string;
  icon: string;
}

interface JobDetailTabsProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

const tabs: Tab[] = [
  { id: 'details', label: 'Job Details', icon: '📋' },
  { id: 'files', label: 'Files & Proofs', icon: '📁' },
  { id: 'financials', label: 'Financials', icon: '💰' },
];

export function JobDetailTabs({ activeTab, onTabChange }: JobDetailTabsProps) {
  return (
    <div className="bg-white shadow rounded-lg mb-6">
      <div className="border-b border-gray-200">
        <nav className="flex -mb-px">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`
                flex-1 py-4 px-6 text-center border-b-2 font-medium text-sm transition-colors
                ${activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}

export type { TabType };
