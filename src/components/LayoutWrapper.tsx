'use client';

import { useState } from 'react';
import Sidebar from './Sidebar';
import FloatingChat from './FloatingChat';

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

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
