'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import FloatingChat from './FloatingChat';

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  // Login page gets a clean layout with no sidebar
  if (pathname === '/login') {
    return <>{children}</>;
  }

  return (
    <>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(v => !v)} />
      <main className={`${collapsed ? 'ml-[60px]' : 'ml-[220px]'} min-h-screen transition-all duration-300`}>
        {children}
        <FloatingChat />
      </main>
    </>
  );
}
