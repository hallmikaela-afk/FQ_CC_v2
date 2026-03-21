import type { Metadata } from 'next';
import './globals.css';
import Sidebar from '@/components/Sidebar';
import FloatingChat from '@/components/FloatingChat';

export const metadata: Metadata = {
  title: 'Fox & Quinn Command Center',
  description: 'Internal project management for Fox & Quinn',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-fq-bg min-h-screen">
        <Sidebar />
        <main className="ml-[220px] min-h-screen">
          {children}
          <FloatingChat />
        </main>
      </body>
    </html>
  );
}
