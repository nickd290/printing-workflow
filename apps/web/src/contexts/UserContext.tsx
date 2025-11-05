'use client';

import { createContext, useContext, useState, ReactNode, useEffect } from 'react';

export type UserRole = 'CUSTOMER' | 'BROKER_ADMIN' | 'BRADFORD_ADMIN';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  companyId: string;
  companyName: string;
}

interface UserContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  isCustomer: boolean;
  isBrokerAdmin: boolean;
  isBradfordAdmin: boolean;
  loading: boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Check for existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      const token = localStorage.getItem('auth_token');
      if (token) {
        try {
          const response = await fetch(`${API_URL}/api/auth/me`, {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
            credentials: 'include',
          });

          if (response.ok) {
            const data = await response.json();
            setUser(data.user);
          } else {
            // Token invalid, clear it
            localStorage.removeItem('auth_token');
          }
        } catch (error) {
          console.error('Failed to check session:', error);
          localStorage.removeItem('auth_token');
        }
      }
      setLoading(false);
    };

    checkSession();
  }, []);

  const login = async (email: string, password: string): Promise<User> => {
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Login failed');
    }

    const data = await response.json();
    setUser(data.user);

    // Store token in localStorage as backup (cookie is primary)
    localStorage.setItem('auth_token', data.token);

    // Return the user data so caller can immediately check role
    return data.user;
  };

  const logout = async () => {
    try {
      await fetch(`${API_URL}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      console.error('Logout error:', error);
    }

    setUser(null);
    localStorage.removeItem('auth_token');
  };

  const isCustomer = user?.role === 'CUSTOMER';
  const isBrokerAdmin = user?.role === 'BROKER_ADMIN';
  const isBradfordAdmin = user?.role === 'BRADFORD_ADMIN';

  return (
    <UserContext.Provider
      value={{
        user,
        login,
        logout,
        isCustomer,
        isBrokerAdmin,
        isBradfordAdmin,
        loading,
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
