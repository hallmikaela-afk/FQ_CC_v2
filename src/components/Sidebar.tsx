'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  {
    label: 'Dashboard',
    href: '/',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="7" height="7" rx="1.5" />
        <rect x="11" y="2" width="7" height="7" rx="1.5" />
        <rect x="2" y="11" width="7" height="7" rx="1.5" />
        <rect x="11" y="11" width="7" height="7" rx="1.5" />
      </svg>
    ),
  },
  {
    label: 'Clients',
    href: '/clients',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 4C10 5.66 8.66 7 7 7C5.34 7 4 5.66 4 4" />
        <path d="M3.5 17v-1.5c0-2.5 2-4 4-4h5c2 0 4 1.5 4 4V17" />
        <circle cx="10" cy="7" r="3" />
      </svg>
    ),
  },
  {
    label: 'Projects',
    href: '/projects',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="14" height="12" rx="2" />
        <path d="M7 4V3a1 1 0 011-1h4a1 1 0 011 1v1" />
      </svg>
    ),
  },
  {
    label: 'Tasks',
    href: '/tasks',
    badge: 217,
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="14" height="14" rx="2" />
        <path d="M7 10l2 2 4-4" />
      </svg>
    ),
  },
  {
    label: 'Inbox',
    href: '/inbox',
    badge: 2,
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="14" height="12" rx="2" />
        <path d="M3 7l7 4 7-4" />
      </svg>
    ),
  },
  {
    label: 'Assistant',
    href: '/assistant',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 10c0 3.87-3.13 7-7 7-1.5 0-2.9-.47-4.05-1.28L3 17l1.28-2.95A6.96 6.96 0 013 10c0-3.87 3.13-7 7-7s7 3.13 7 7z" />
      </svg>
    ),
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-screen w-[220px] bg-fq-bg border-r border-fq-border flex flex-col z-50">
      <div className="px-6 pt-8 pb-2 flex items-start justify-between">
        <div>
          <h1 className="font-heading text-[22px] font-semibold text-fq-dark tracking-wide">
            Fox &amp; Quinn
          </h1>
          <p className="font-body text-[11px] text-fq-accent italic mt-0.5">
            Calm is the luxury
          </p>
        </div>
        <button className="mt-1 text-fq-muted hover:text-fq-dark transition-colors">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M3 5h14M3 10h14M3 15h14" />
          </svg>
        </button>
      </div>

      <nav className="mt-8 flex flex-col gap-1 px-3">
        {navItems.map((item) => {
          const isActive =
            item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                relative flex items-center gap-3 px-4 py-3 rounded-lg
                font-body text-[14px] transition-all duration-200
                ${isActive
                  ? 'bg-fq-light-accent text-fq-dark font-medium'
                  : 'text-fq-muted hover:text-fq-dark hover:bg-fq-light-accent/50'
                }
              `}
            >
              <span className={isActive ? 'text-fq-dark' : 'text-fq-muted'}>
                {item.icon}
              </span>
              <span className="flex-1">{item.label}</span>
              {item.badge != null && item.badge > 0 && (
                <span className="bg-fq-accent text-white text-[11px] font-medium px-2 py-0.5 rounded-full min-w-[24px] text-center">
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
