'use client';

import { createContext, useContext, useState, ReactNode, useEffect } from 'react';

export type UserRole = 'CUSTOMER' | 'BROKER_ADMIN' | 'BRADFORD_ADMIN' | 'MANAGER';

export interface User {
  email: string;
  name: string;
  role: UserRole;
  companyId: string;
  companyName: string;
}

interface UserContextType {
  user: User | null;
  login: (email: string) => void;
  logout: () => void;
  isCustomer: boolean;
  isBrokerAdmin: boolean;
  isBradfordAdmin: boolean;
  isManager: boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

// Mock user database matching seed.ts
const MOCK_USERS: Record<string, User> = {
  'admin@impactdirect.com': {
    email: 'admin@impactdirect.com',
    name: 'Impact Direct Admin',
    role: 'BROKER_ADMIN',
    companyId: 'impact-direct',
    companyName: 'Impact Direct',
  },
  'manager@impactdirect.com': {
    email: 'manager@impactdirect.com',
    name: 'Impact Direct Manager',
    role: 'MANAGER',
    companyId: 'impact-direct',
    companyName: 'Impact Direct',
  },
  'steve.gustafson@bgeltd.com': {
    email: 'steve.gustafson@bgeltd.com',
    name: 'Steve Gustafson',
    role: 'BRADFORD_ADMIN',
    companyId: 'bradford',
    companyName: 'Bradford',
  },
  'orders@jjsa.com': {
    email: 'orders@jjsa.com',
    name: 'JJSA Orders',
    role: 'CUSTOMER',
    companyId: 'jjsa',
    companyName: 'JJSA',
  },
  'orders@ballantine.com': {
    email: 'orders@ballantine.com',
    name: 'Ballantine Orders',
    role: 'CUSTOMER',
    companyId: 'ballantine',
    companyName: 'Ballantine',
  },
};

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  // Load user from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('currentUser');
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to parse stored user');
      }
    }
  }, []);

  const login = (email: string) => {
    const foundUser = MOCK_USERS[email.toLowerCase()];
    if (foundUser) {
      setUser(foundUser);
      localStorage.setItem('currentUser', JSON.stringify(foundUser));
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('currentUser');
  };

  const isCustomer = user?.role === 'CUSTOMER';
  const isBrokerAdmin = user?.role === 'BROKER_ADMIN';
  const isBradfordAdmin = user?.role === 'BRADFORD_ADMIN';
  const isManager = user?.role === 'MANAGER';

  return (
    <UserContext.Provider
      value={{
        user,
        login,
        logout,
        isCustomer,
        isBrokerAdmin,
        isBradfordAdmin,
        isManager,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
