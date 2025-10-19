'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useUser } from '@/contexts/UserContext';

export function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useUser();

  // Navigation items - customized for customer vs internal team
  const isInternalTeam = user && ['BROKER_ADMIN', 'BRADFORD_ADMIN', 'MANAGER'].includes(user.role);

  const navigation = user?.role === 'CUSTOMER'
    ? [
        { name: 'My Jobs', href: '/dashboard', icon: '📋' },
        { name: 'Submit Quote', href: '/quotes', icon: '✨' },
        { name: 'My Invoices', href: '/financials', icon: '💰' },
      ]
    : user?.role === 'BRADFORD_ADMIN'
    ? [
        { name: 'Dashboard', href: '/dashboard', icon: '🏠' },
      ]
    : user?.role === 'BROKER_ADMIN' || user?.role === 'MANAGER'
    ? [
        { name: 'Dashboard', href: '/dashboard', icon: '🏠' },
        { name: 'Financials', href: '/financials', icon: '📊' },
      ]
    : [
        { name: 'Dashboard', href: '/dashboard', icon: '🏠' },
        { name: 'Jobs', href: '/jobs', icon: '📋' },
        { name: 'Quotes', href: '/quotes', icon: '✨' },
        { name: 'Files', href: '/files', icon: '📁' },
        { name: 'Purchase Orders', href: '/purchase-orders', icon: '🛒' },
        { name: 'Invoices', href: '/invoices', icon: '💵' },
        { name: 'Financials', href: '/financials', icon: '📊' },
      ];

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <nav className="sticky top-0 z-50 bg-slate-900 border-b border-slate-700 shadow-lg">
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            {/* Logo */}
            <div className="flex-shrink-0 flex items-center">
              <Link href="/dashboard" className="flex items-center gap-3">
                <div className="bg-blue-600 p-2 rounded-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-lg font-bold text-white">
                    Printing Workflow
                  </h1>
                  <p className="text-xs text-slate-400 -mt-0.5">Production System</p>
                </div>
              </Link>
            </div>

            {/* Navigation Links */}
            <div className="hidden lg:ml-10 lg:flex lg:space-x-1">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    pathname === item.href
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span>{item.icon}</span>
                    <span>{item.name}</span>
                  </span>
                </Link>
              ))}
            </div>
          </div>

          {/* User Info & Actions */}
          <div className="flex items-center gap-4">
            {user && (
              <div className="hidden md:flex items-center gap-3 px-4 py-2 rounded-lg bg-slate-800 border border-slate-700">
                <div className="text-right">
                  <div className="text-sm font-semibold text-white">{user.name}</div>
                  <div className="text-xs text-slate-400">{user.companyName}</div>
                </div>
                <span className="inline-flex px-3 py-1 rounded-md text-xs font-semibold text-white bg-blue-600">
                  {user.role.replace(/_/g, ' ')}
                </span>
              </div>
            )}
            <button
              onClick={handleLogout}
              className="inline-flex items-center px-4 py-2 rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-colors"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
