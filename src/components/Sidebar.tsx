'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useProjects } from '@/lib/hooks';

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
    label: 'My Week',
    href: '/week',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="14" height="13" rx="2" />
        <path d="M3 8h14" />
        <path d="M7 2v3M13 2v3" />
        <path d="M7 12l2 2 4-4" />
      </svg>
    ),
  },
  {
    label: 'Projects',
    href: '/projects',
    hasDropdown: true,
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
    label: 'Chat',
    href: '/assistant',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 10c0 3.87-3.13 7-7 7-1.5 0-2.9-.47-4.05-1.28L3 17l1.28-2.95A6.96 6.96 0 013 10c0-3.87 3.13-7 7-7s7 3.13 7 7z" />
      </svg>
    ),
  },
  {
    label: 'Import',
    href: '/import',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 3v10M6 9l4 4 4-4" />
        <path d="M3 15v2h14v-2" />
      </svg>
    ),
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [projectsOpen, setProjectsOpen] = useState(false);
  const { projects } = useProjects();
  const activeProjects = projects.filter(p => p.status === 'active' && (p.type === 'client' || p.type === 'shoot'))
    .map(p => ({ id: p.slug || p.id, name: p.name, color: p.color }));

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

      <nav className="mt-8 flex flex-col gap-1 px-3 overflow-y-auto">
        {navItems.map((item) => {
          const isActive =
            item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href);

          const isProjects = item.label === 'Projects';

          return (
            <div key={item.href}>
              <div className="flex items-center">
                <Link
                  href={item.href}
                  className={`
                    relative flex items-center gap-3 px-4 py-3 rounded-lg flex-1
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
                {isProjects && (
                  <button
                    onClick={(e) => { e.preventDefault(); setProjectsOpen(!projectsOpen); }}
                    className={`p-1.5 rounded hover:bg-fq-light-accent/50 transition-colors mr-1 ${isActive ? 'text-fq-dark' : 'text-fq-muted'}`}
                  >
                    <svg
                      width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor"
                      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                      className={`transition-transform duration-200 ${projectsOpen ? '' : '-rotate-90'}`}
                    >
                      <path d="M3 5l3 3 3-3" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Projects dropdown */}
              {isProjects && projectsOpen && (
                <div className="ml-8 mt-1 mb-1 space-y-0.5">
                  {activeProjects.map(p => {
                    const isProjectActive = pathname === `/projects/${p.id}`;
                    return (
                      <Link
                        key={p.id}
                        href={`/projects/${p.id}`}
                        className={`
                          flex items-center gap-2 px-3 py-1.5 rounded-md
                          font-body text-[12px] transition-all duration-150
                          ${isProjectActive
                            ? 'text-fq-dark font-medium bg-fq-light-accent/60'
                            : 'text-fq-muted hover:text-fq-dark hover:bg-fq-light-accent/30'
                          }
                        `}
                      >
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                        <span className="truncate">{p.name}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
