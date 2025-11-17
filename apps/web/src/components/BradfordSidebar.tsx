'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useUser } from '@/contexts/UserContext';

export function BradfordSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useUser();

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const navigation = [
    {
      name: 'Bradford Dashboard',
      href: '/bradford',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
  ];

  return (
    <div className="flex h-screen bg-background">
      {/* Dark Graphite Sidebar - Linear/Vercel Style */}
      <div className="sidebar-dark w-64 flex flex-col">
        {/* Logo/Header */}
        <div className="px-6 py-5 border-b border-sidebar-dark-border">
          <h1 className="text-lg font-semibold text-sidebar-dark-text tracking-tight">
            Bradford
          </h1>
          <p className="text-xs text-sidebar-dark-muted mt-0.5">Admin Dashboard</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`sidebar-dark-nav-item ${isActive ? 'active' : ''}`}
              >
                <span className="flex-shrink-0">
                  {item.icon}
                </span>
                <span className="truncate">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Info & Logout */}
        <div className="px-3 py-4 border-t border-sidebar-dark-border">
          <div className="px-3 py-2.5 rounded-md bg-sidebar-dark-border/50">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-sidebar-dark-text truncate">
                  {user?.name}
                </p>
                <p className="text-xs text-sidebar-dark-muted truncate">{user?.companyName}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="mt-2.5 w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-sidebar-dark-text bg-white/5 border border-white/10 rounded-md hover:bg-white/10 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
