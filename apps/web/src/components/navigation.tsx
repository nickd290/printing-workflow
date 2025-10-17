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
        { name: 'My Jobs', href: '/dashboard' },
        { name: 'Submit Quote', href: '/quotes' },
        { name: 'My Invoices', href: '/financials' },
      ]
    : [
        { name: 'Dashboard', href: '/dashboard' },
        { name: 'Jobs', href: '/jobs' },
        { name: 'Quotes', href: '/quotes' },
        { name: 'Files', href: '/files' },
        { name: 'Purchase Orders', href: '/purchase-orders' },
        { name: 'Invoices', href: '/invoices' },
        { name: 'Financials', href: '/financials' },
      ];

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <Link href="/dashboard" className="text-xl font-bold text-gray-900">
                Printing Workflow
              </Link>
            </div>
            <div className="hidden sm:ml-8 sm:flex sm:space-x-8">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                    pathname === item.href
                      ? 'border-blue-500 text-gray-900'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  }`}
                >
                  {item.name}
                </Link>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-4">
            {user && (
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-sm font-medium text-gray-900">{user.name}</div>
                  <div className="text-xs text-gray-500">{user.companyName}</div>
                </div>
                <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {user.role.replace(/_/g, ' ')}
                </span>
              </div>
            )}
            <button
              onClick={handleLogout}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
