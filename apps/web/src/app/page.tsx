'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/contexts/UserContext';

export default function HomePage() {
  const router = useRouter();
  const { user, isCustomer, loading } = useUser();

  useEffect(() => {
    // Wait for auth to load, then redirect based on role
    if (!loading) {
      if (user) {
        // Redirect authenticated users based on role
        if (isCustomer) {
          router.push('/customer-portal');
        } else {
          router.push('/dashboard');
        }
      } else {
        // Redirect unauthenticated users to login
        router.push('/login');
      }
    }
  }, [user, isCustomer, loading, router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm">
        <h1 className="text-4xl font-bold mb-4">Printing Workflow System</h1>
        <p className="text-lg text-muted-foreground">
          Loading...
        </p>
      </div>
    </div>
  );
}
