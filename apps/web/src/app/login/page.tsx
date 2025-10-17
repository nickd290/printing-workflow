'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/contexts/UserContext';

const DEMO_ACCOUNTS = [
  {
    email: 'admin@impactdirect.com',
    name: 'Impact Direct Admin',
    role: 'BROKER_ADMIN',
    company: 'Impact Direct',
    description: 'See all jobs, manage everything',
  },
  {
    email: 'manager@impactdirect.com',
    name: 'Impact Direct Manager',
    role: 'MANAGER',
    company: 'Impact Direct',
    description: 'Same as admin',
  },
  {
    email: 'steve.gustafson@bgeltd.com',
    name: 'Steve Gustafson',
    role: 'BRADFORD_ADMIN',
    company: 'Bradford',
    description: 'See only jobs with Bradford POs',
  },
  {
    email: 'orders@jjsa.com',
    name: 'JJSA Orders',
    role: 'CUSTOMER',
    company: 'JJSA',
    description: 'See only JJSA jobs',
  },
  {
    email: 'orders@ballantine.com',
    name: 'Ballantine Orders',
    role: 'CUSTOMER',
    company: 'Ballantine',
    description: 'See only Ballantine jobs',
  },
];

export default function LoginPage() {
  const router = useRouter();
  const { login } = useUser();
  const [selectedEmail, setSelectedEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmail) return;

    setLoading(true);
    login(selectedEmail);

    setTimeout(() => {
      router.push('/dashboard');
    }, 300);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="max-w-2xl w-full bg-white p-8 rounded-lg shadow-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Printing Workflow</h1>
          <p className="text-gray-600">Select a demo account to sign in</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-3">
            {DEMO_ACCOUNTS.map((account) => (
              <label
                key={account.email}
                className={`block p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  selectedEmail === account.email
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="account"
                    value={account.email}
                    checked={selectedEmail === account.email}
                    onChange={(e) => setSelectedEmail(e.target.value)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-gray-900">{account.name}</span>
                      <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                        {account.role.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600">{account.company}</div>
                    <div className="text-xs text-gray-500 mt-1">{account.description}</div>
                  </div>
                </div>
              </label>
            ))}
          </div>

          <button
            type="submit"
            disabled={loading || !selectedEmail}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-xs text-yellow-800">
            <strong>Note:</strong> This is a demo. Each account shows different data based on user role and company.
          </p>
        </div>
      </div>
    </div>
  );
}
