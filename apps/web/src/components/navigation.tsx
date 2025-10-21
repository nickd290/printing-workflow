'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useUser } from '@/contexts/UserContext';
import {
  HomeIcon,
  DocumentIcon,
  FolderIcon,
  ShoppingCartIcon,
  ReceiptIcon,
  ChartBarIcon,
  SparklesIcon,
  CurrencyDollarIcon,
  PrinterIcon,
} from '@/components/ui/Icons';

export function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useUser();

  // Navigation items - customized for customer vs internal team
  const isInternalTeam = user && ['BROKER_ADMIN', 'BRADFORD_ADMIN', 'MANAGER'].includes(user.role);

  const navigation = user?.role === 'CUSTOMER'
    ? [
        { name: 'My Jobs', href: '/dashboard', Icon: DocumentIcon },
        { name: 'Submit Quote', href: '/quotes', Icon: SparklesIcon },
        { name: 'My Invoices', href: '/financials', Icon: CurrencyDollarIcon },
      ]
    : user?.role === 'BRADFORD_ADMIN'
    ? [
        { name: 'Dashboard', href: '/dashboard', Icon: HomeIcon },
      ]
    : user?.role === 'BROKER_ADMIN' || user?.role === 'MANAGER'
    ? [
        { name: 'Dashboard', href: '/dashboard', Icon: HomeIcon },
        { name: 'Financials', href: '/financials', Icon: ChartBarIcon },
      ]
    : [
        { name: 'Dashboard', href: '/dashboard', Icon: HomeIcon },
        { name: 'Jobs', href: '/jobs', Icon: DocumentIcon },
        { name: 'Quotes', href: '/quotes', Icon: SparklesIcon },
        { name: 'Files', href: '/files', Icon: FolderIcon },
        { name: 'Purchase Orders', href: '/purchase-orders', Icon: ShoppingCartIcon },
        { name: 'Invoices', href: '/invoices', Icon: ReceiptIcon },
        { name: 'Financials', href: '/financials', Icon: ChartBarIcon },
      ];

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <nav className="sticky top-0 z-50 bg-card border-b border-border shadow-sm">
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            {/* Logo */}
            <div className="flex-shrink-0 flex items-center">
              <Link href="/dashboard" className="flex items-center gap-3 group">
                <div className="bg-primary p-2 rounded-lg group-hover:bg-primary-hover transition-colors">
                  <PrinterIcon className="w-6 h-6 text-primary-foreground" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-foreground">
                    Printing Workflow
                  </h1>
                  <p className="text-xs text-muted-foreground -mt-0.5">Production System</p>
                </div>
              </Link>
            </div>

            {/* Navigation Links */}
            <div className="hidden lg:ml-10 lg:flex lg:space-x-1">
              {navigation.map((item) => {
                const Icon = item.Icon;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                      pathname === item.href
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Icon className="w-4 h-4" />
                      <span>{item.name}</span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* User Info & Actions */}
          <div className="flex items-center gap-4">
            {user && (
              <div className="hidden md:flex items-center gap-3 px-4 py-2 rounded-lg bg-muted border border-border">
                <div className="text-right">
                  <div className="text-sm font-semibold text-foreground">{user.name}</div>
                  <div className="text-xs text-muted-foreground">{user.companyName}</div>
                </div>
                <span className="inline-flex px-3 py-1 rounded-md text-xs font-semibold bg-primary text-primary-foreground">
                  {user.role.replace(/_/g, ' ')}
                </span>
              </div>
            )}
            <button
              onClick={handleLogout}
              className="inline-flex items-center px-4 py-2 rounded-md text-sm font-medium text-danger-foreground bg-danger hover:opacity-90 transition-opacity"
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
