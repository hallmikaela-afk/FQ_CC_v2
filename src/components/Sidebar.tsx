'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { label: 'Home', href: '/' },
  { label: 'Tasks', href: '/tasks', badge: 30 },
  { label: 'Assistant', href: '/assistant' },
  { label: 'Inbox', href: '/inbox', badge: 4 },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-screen w-[220px] bg-fq-bg border-r border-fq-border flex flex-col z-50">
      <div className="px-6 pt-8 pb-2">
        <h1 className="font-heading text-[22px] font-semibold text-fq-dark tracking-wide">
          Fox & Quinn
        </h1>
        <p className="font-body text-[11px] text-fq-muted italic mt-0.5">
          Calm is the luxury
        </p>
      </div>

      <nav className="mt-8 flex flex-col gap-1 px-3">
        {navItems.map((item) => {
          const isActive =
            item.href === '/'
              ? pathname === '/' || pathname.startsWith('/projects')
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                relative flex items-center justify-between px-4 py-2.5 rounded-lg
                font-body text-[14px] transition-all duration-200
                ${isActive
                  ? 'text-fq-accent font-medium'
                  : 'text-fq-muted hover:text-fq-dark'
                }
              `}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-fq-accent rounded-r-full transition-all duration-300" />
              )}
              <span>{item.label}</span>
              {item.badge && item.badge > 0 && (
                <span className="bg-fq-accent text-white text-[11px] font-medium px-2 py-0.5 rounded-full min-w-[20px] text-center">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
