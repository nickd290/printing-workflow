'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RevenuePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/financials');
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="mt-4 text-gray-600">Redirecting to Financial Dashboard...</p>
      </div>
    </div>
  );
}
