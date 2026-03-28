'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import Sidebar from './Sidebar';
import FloatingChat from './FloatingChat';

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        // Refresh server components so middleware sees the updated session cookie
        router.refresh();
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

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
