'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUser } from '@/contexts/UserContext';

export function Navigation() {
  const pathname = usePathname();
  const { user, isCustomer } = useUser();

  const navItems = isCustomer
    ? [
        { href: '/dashboard', label: 'Dashboard' },
        { href: '/jobs', label: 'Jobs' },
        { href: '/invoices', label: 'Invoices' },
      ]
    : [
        { href: '/dashboard', label: 'Dashboard' },
        { href: '/jobs', label: 'Jobs' },
        { href: '/invoices', label: 'Invoices' },
        { href: '/purchase-orders', label: 'Purchase Orders' },
        { href: '/quotes', label: 'Quotes' },
      ];

  return (
    <nav className="bg-slate-900 border-b border-slate-800">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 justify-between">
          <div className="flex">
            <div className="flex flex-shrink-0 items-center">
              <Link href="/dashboard" className="text-xl font-bold text-white">
                Impact Direct
              </Link>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              {navItems.map((item) => {
                const isActive = pathname?.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`inline-flex items-center border-b-2 px-1 pt-1 text-sm font-medium ${
                      isActive
                        ? 'border-blue-500 text-white'
                        : 'border-transparent text-slate-400 hover:border-slate-700 hover:text-slate-300'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
          <div className="flex items-center">
            <div className="text-sm text-slate-400">
              {user?.name || user?.email}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
