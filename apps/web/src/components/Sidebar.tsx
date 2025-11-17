'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
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
  BuildingOfficeIcon,
} from '@/components/ui/Icons';

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logout } = useUser();
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

  // Navigation items - role-based
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
    : [
        // Clean menu for BROKER_ADMIN and other admin roles
        { name: 'Dashboard', href: '/dashboard', Icon: HomeIcon, badge: 0 },
        { name: 'Quotes', href: '/quotes', Icon: SparklesIcon, badge: 0 },
        { name: 'Files', href: '/files', Icon: FolderIcon, badge: 0 },
        { name: 'Financials', href: '/financials', Icon: ChartBarIcon, badge: 0 },
        { name: 'Vendors', href: '/vendors', Icon: BuildingOfficeIcon, badge: 0 },
      ];

  const isActive = (href: string) => pathname === href;
  const isExpanded = isCollapsed ? isHovering : true;

  // Show loading state while user data is being fetched
  if (loading) {
    return (
      <aside
        className={`fixed left-0 top-0 bottom-0 bg-card border-r border-border transition-all duration-300 ease-in-out z-40 ${
          isExpanded ? 'w-[280px]' : 'w-[64px]'
        }`}
        style={{ boxShadow: 'var(--shadow-sm)' }}
      >
        <div className="h-16 flex items-center px-4 border-b border-border/50">
          <Logo variant="icon" size="md" className="text-primary" />
        </div>
        <div className="p-4 flex items-center justify-center">
          <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      </aside>
    );
  }

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <aside
      className={`fixed left-0 top-0 bottom-0 bg-card border-r border-border transition-all duration-300 ease-in-out z-40 ${
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
      <nav className="p-3 space-y-2 sidebar-scrollbar overflow-y-auto pb-[180px]">
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

      {/* User Info & Logout */}
      <div className="absolute bottom-0 left-0 right-0 border-t border-border bg-card">
        {user && isExpanded && (
          <div className="p-4 space-y-3">
            {/* User Info */}
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                <span className="text-sm font-semibold text-primary">
                  {user.name?.charAt(0).toUpperCase() || 'U'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-foreground truncate">
                  {user.name}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {user.companyName}
                </div>
                <span className="inline-flex mt-1.5 px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary">
                  {user.role.replace(/_/g, ' ')}
                </span>
              </div>
            </div>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-danger-foreground bg-danger hover:opacity-90 transition-opacity"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign Out
            </button>
          </div>
        )}

        {/* Collapsed state - just logout icon */}
        {user && !isExpanded && (
          <div className="p-3">
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center p-2 rounded-md text-danger-foreground bg-danger hover:opacity-90 transition-opacity"
              title="Sign Out"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
