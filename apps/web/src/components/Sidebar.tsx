'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUser } from '@/contexts/UserContext';
import { Logo } from '@/components/ui/Logo';
import {
  HomeIcon,
  DocumentIcon,
  FolderIcon,
  ShoppingCartIcon,
  ReceiptIcon,
  ChartBarIcon,
  SparklesIcon,
  CurrencyDollarIcon,
  ChevronDownIcon,
} from '@/components/ui/Icons';

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useUser();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isHovering, setIsHovering] = useState(false);

  // Load collapsed state from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    if (saved !== null) {
      setIsCollapsed(saved === 'true');
    }
  }, []);

  // Save collapsed state to localStorage
  const toggleSidebar = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem('sidebarCollapsed', String(newState));
  };

  // Navigation items - role-based (same as before)
  const navigation = user?.role === 'CUSTOMER'
    ? [
        { name: 'My Jobs', href: '/dashboard', Icon: DocumentIcon, badge: 0 },
        { name: 'Submit Quote', href: '/quotes', Icon: SparklesIcon, badge: 0 },
        { name: 'My Invoices', href: '/financials', Icon: CurrencyDollarIcon, badge: 0 },
      ]
    : user?.role === 'BRADFORD_ADMIN'
    ? [
        { name: 'Dashboard', href: '/dashboard', Icon: HomeIcon, badge: 0 },
      ]
    : user?.role === 'BROKER_ADMIN'
    ? [
        { name: 'Dashboard', href: '/dashboard', Icon: HomeIcon, badge: 0 },
        { name: 'Pricing Rules', href: '/pricing-rules', Icon: CurrencyDollarIcon, badge: 0 },
        { name: 'Financials', href: '/financials', Icon: ChartBarIcon, badge: 0 },
      ]
    : [
        { name: 'Dashboard', href: '/dashboard', Icon: HomeIcon, badge: 0 },
        { name: 'Jobs', href: '/jobs', Icon: DocumentIcon, badge: 5 }, // Example badge
        { name: 'Quotes', href: '/quotes', Icon: SparklesIcon, badge: 2 },
        { name: 'Files', href: '/files', Icon: FolderIcon, badge: 0 },
        { name: 'Purchase Orders', href: '/purchase-orders', Icon: ShoppingCartIcon, badge: 0 },
        { name: 'Invoices', href: '/invoices', Icon: ReceiptIcon, badge: 3 },
        { name: 'Financials', href: '/financials', Icon: ChartBarIcon, badge: 0 },
      ];

  const isActive = (href: string) => pathname === href;
  const isExpanded = isCollapsed ? isHovering : true;

  return (
    <aside
      className={`fixed left-0 top-[48px] bottom-0 bg-card border-r border-border transition-all duration-300 ease-in-out z-40 ${
        isExpanded ? 'w-[280px]' : 'w-[64px]'
      }`}
      onMouseEnter={() => isCollapsed && setIsHovering(true)}
      onMouseLeave={() => isCollapsed && setIsHovering(false)}
      style={{ boxShadow: 'var(--shadow-sm)' }}
    >
      {/* Collapse/Expand Toggle */}
      <button
        onClick={toggleSidebar}
        className="absolute -right-3 top-6 w-7 h-7 bg-card border border-border rounded-full flex items-center justify-center hover:bg-muted hover:border-border-strong transition-all duration-200 shadow-md hover:shadow-lg"
        title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        <ChevronDownIcon
          className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-300 ${
            isCollapsed ? 'rotate-90' : '-rotate-90'
          }`}
        />
      </button>

      {/* Logo Area */}
      <div className="h-16 flex items-center px-4 border-b border-border/50">
        <Link href="/dashboard" className="flex items-center gap-3 group transition-all duration-200">
          {isExpanded ? (
            <Logo variant="full" size="md" className="text-primary group-hover:scale-105 transition-transform" />
          ) : (
            <Logo variant="icon" size="md" className="text-primary group-hover:scale-110 transition-transform" />
          )}
        </Link>
      </div>

      {/* Navigation Items */}
      <nav className="p-3 space-y-2 sidebar-scrollbar overflow-y-auto">
        {navigation.map((item) => {
          const Icon = item.Icon;
          const active = isActive(item.href);

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`sidebar-nav-item group relative ${
                active ? 'active' : ''
              }`}
              title={!isExpanded ? item.name : undefined}
            >
              <Icon className={`w-5 h-5 flex-shrink-0 transition-colors duration-200 ${
                active ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
              }`} />

              {isExpanded && (
                <>
                  <span className="flex-1 text-sm font-medium whitespace-nowrap overflow-hidden text-ellipsis">
                    {item.name}
                  </span>

                  {/* Badge Count */}
                  {item.badge > 0 && (
                    <span className={`flex-shrink-0 px-2.5 py-1 text-xs font-semibold rounded-full transition-colors duration-200 ${
                      active
                        ? 'bg-primary/20 text-primary'
                        : 'bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </>
              )}

              {/* Badge Dot (Collapsed State) */}
              {!isExpanded && item.badge > 0 && (
                <span className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full ring-2 ring-card" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer (Optional - Version or Help Link) */}
      {isExpanded && (
        <div className="absolute bottom-4 left-0 right-0 px-4">
          <div className="text-xs text-muted-foreground text-center">
            v1.0.0
          </div>
        </div>
      )}
    </aside>
  );
}
