import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from 'react-hot-toast';
import { UserProvider } from '@/contexts/UserContext';
import { AppLayout } from '@/components/AppLayout';
import { QueryProvider } from '@/components/providers/QueryProvider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Printing Workflow',
  description: 'Commercial printing workflow management system',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <QueryProvider>
          <UserProvider>
            <AppLayout>{children}</AppLayout>
            <Toaster position="top-right" />
          </UserProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
