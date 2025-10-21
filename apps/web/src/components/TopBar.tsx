'use client';

import { useRouter } from 'next/navigation';
import { useUser } from '@/contexts/UserContext';

export function TopBar() {
  const router = useRouter();
  const { user, logout } = useUser();

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  if (!user) return null;

  return (
    <header className="fixed top-0 left-0 right-0 h-12 bg-card border-b border-border z-50 flex items-center justify-end px-6 gap-4">
      {/* User Info */}
      <div className="flex items-center gap-3">
        {/* User Details */}
        <div className="hidden md:block text-right">
          <div className="text-sm font-semibold text-foreground">{user.name}</div>
          <div className="text-xs text-muted-foreground -mt-0.5">{user.companyName}</div>
        </div>

        {/* Role Badge */}
        <span className="hidden sm:inline-flex px-3 py-1 rounded-md text-xs font-semibold bg-primary text-primary-foreground">
          {user.role.replace(/_/g, ' ')}
        </span>

        {/* Sign Out Button */}
        <button
          onClick={handleLogout}
          className="inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-opacity"
          style={{
            backgroundColor: 'hsl(var(--danger))',
            color: 'hsl(var(--danger-foreground))',
          }}
          onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
          onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
        >
          <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          <span className="hidden sm:inline">Sign Out</span>
          <span className="sm:hidden">Out</span>
        </button>
      </div>
    </header>
  );
}
