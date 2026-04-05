'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useProjects, useSidebarCounts } from '@/lib/hooks';
import SidebarDriveFlyout from './drive/SidebarDriveFlyout';

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
    badgeKey: 'tasksOverdue' as const,
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
    badgeKey: 'inboxFollowup' as const,
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

interface DriveProjectFolder {
  id: string;
  name: string;
  slug: string | null;
  internalFolderUrl: string;
  clientFolderUrl: string;
  subfolderIds: Record<string, string>;
}

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const [projectsOpen, setProjectsOpen] = useState(true);
  const [driveConnected, setDriveConnected] = useState<boolean | null>(null);
  const [driveProjects, setDriveProjects] = useState<DriveProjectFolder[]>([]);
  const [driveSectionOpen, setDriveSectionOpen] = useState(true);
  const [flyoutProject, setFlyoutProject] = useState<DriveProjectFolder | null>(null);
  const [flyoutTop, setFlyoutTop] = useState(0);
  const sidebarRef = useRef<HTMLElement>(null);
  const { projects } = useProjects();
  const sidebarCounts = useSidebarCounts();
  const activeProjects = projects.filter(p => p.status === 'active' && (p.type === 'client' || p.type === 'shoot'))
    .map(p => ({ id: p.slug || p.id, name: p.name, color: p.color, rawId: p.id }));

  useEffect(() => {
    fetch('/api/auth/google/status')
      .then(r => r.json())
      .then(d => setDriveConnected(d.connected ?? false))
      .catch(() => setDriveConnected(false));
  }, []);

  // When Drive is connected and projects are loaded, fetch which projects have provisioned folders
  useEffect(() => {
    if (!driveConnected || activeProjects.length === 0) return;

    const fetchDriveFolders = async () => {
      const results: DriveProjectFolder[] = [];
      await Promise.all(
        activeProjects.map(async (p) => {
          try {
            const res = await fetch(`/api/drive/provision?projectId=${p.rawId}`);
            const data = await res.json();
            if (data.provisioned) {
              results.push({
                id: p.rawId,
                name: p.name,
                slug: p.id,
                internalFolderUrl: data.internalFolderUrl,
                clientFolderUrl: data.clientFolderUrl,
                subfolderIds: data.subfolderIds ?? {},
              });
            }
          } catch {}
        })
      );
      setDriveProjects(results);
    };

    fetchDriveFolders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driveConnected, projects.length]);

  const handleProjectClick = (project: DriveProjectFolder, e: React.MouseEvent) => {
    if (flyoutProject?.id === project.id) {
      setFlyoutProject(null);
      return;
    }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setFlyoutTop(rect.top);
    setFlyoutProject(project);
  };

  const sidebarWidth = collapsed ? 60 : 220;

  return (
    <>
      <aside
        ref={sidebarRef}
        className={`fixed left-0 top-0 h-screen ${collapsed ? 'w-[60px]' : 'w-[220px]'} bg-fq-bg border-r border-fq-border flex flex-col z-50 transition-all duration-300 overflow-hidden`}
      >
        <div className={`px-3 pt-8 pb-2 flex items-start ${collapsed ? 'justify-center' : 'justify-between px-6'}`}>
          {!collapsed && (
            <div>
              <h1 className="font-heading text-[22px] font-semibold text-fq-dark tracking-wide">
                Fox &amp; Quinn
              </h1>
              <p className="font-body text-[11px] text-fq-accent italic mt-0.5">
                Calm is the luxury
              </p>
            </div>
          )}
          <button
            onClick={onToggle}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={`mt-1 text-fq-muted hover:text-fq-dark transition-colors ${collapsed ? 'mx-auto' : ''}`}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M3 5h14M3 10h14M3 15h14" />
            </svg>
          </button>
        </div>

        <nav className="mt-8 flex flex-col gap-1 px-3 overflow-y-auto flex-1">
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
                    title={collapsed ? item.label : undefined}
                    className={`
                      relative flex items-center gap-3 py-3 rounded-lg flex-1
                      font-body text-[14px] transition-all duration-200
                      ${collapsed ? 'justify-center px-2' : 'px-4'}
                      ${isActive
                        ? 'bg-fq-light-accent text-fq-dark font-medium'
                        : 'text-fq-muted hover:text-fq-dark hover:bg-fq-light-accent/50'
                      }
                    `}
                  >
                    <span className={isActive ? 'text-fq-dark' : 'text-fq-muted'}>
                      {item.icon}
                    </span>
                    {!collapsed && (() => {
                      const badge = item.badgeKey ? sidebarCounts[item.badgeKey] : 0;
                      return (
                        <>
                          <span className="flex-1">{item.label}</span>
                          {badge > 0 && (
                            <span className="bg-fq-accent text-white text-[11px] font-medium px-2 py-0.5 rounded-full min-w-[24px] text-center">
                              {badge}
                            </span>
                          )}
                        </>
                      );
                    })()}
                    {collapsed && (() => {
                      const badge = item.badgeKey ? sidebarCounts[item.badgeKey] : 0;
                      return badge > 0 ? (
                        <span className="absolute top-1 right-1 w-2 h-2 bg-fq-accent rounded-full" />
                      ) : null;
                    })()}
                  </Link>
                  {isProjects && !collapsed && (
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
                {isProjects && projectsOpen && !collapsed && (
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

          {/* Drive section */}
          {!collapsed && driveConnected !== null && (
            <div className="mt-4 pt-4 border-t border-fq-border/60">
              {driveConnected ? (
                <>
                  <button
                    onClick={() => setDriveSectionOpen(o => !o)}
                    className="flex items-center gap-2 w-full px-1 mb-1 text-fq-muted hover:text-fq-dark transition-colors"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className="shrink-0" style={{ color: '#4285F4' }}>
                      <path d="M12 1.5L1.5 19.5h21L12 1.5z" fill="#4285F4" opacity="0.15" stroke="#4285F4" strokeWidth="1.2" strokeLinejoin="round" />
                      <path d="M1.5 19.5h8.25" stroke="#EA4335" strokeWidth="1.8" strokeLinecap="round" />
                      <path d="M14.25 19.5H22.5" stroke="#34A853" strokeWidth="1.8" strokeLinecap="round" />
                      <path d="M9.75 19.5l5.25-9" stroke="#FBBC05" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                    <span className="font-body text-[11.5px] font-medium flex-1 text-left">Drive</span>
                    <svg
                      width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor"
                      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                      className={`transition-transform duration-200 ${driveSectionOpen ? '' : '-rotate-90'}`}
                    >
                      <path d="M3 5l3 3 3-3" />
                    </svg>
                  </button>

                  {driveSectionOpen && (
                    <div className="ml-5 space-y-0.5">
                      {driveProjects.length === 0 && (
                        <p className="font-body text-[11px] text-fq-muted/50 px-2 py-1 leading-relaxed">
                          No folders set up yet.{' '}
                          <Link href="/projects" className="text-fq-accent hover:underline">
                            Open a project
                          </Link>
                          {' '}→ Drive tab to set up.
                        </p>
                      )}
                      {driveProjects.map(proj => (
                        <button
                          key={proj.id}
                          onClick={(e) => handleProjectClick(proj, e)}
                          className={`flex items-center gap-2 w-full px-2 py-1.5 rounded-md font-body text-[11.5px] transition-colors text-left ${
                            flyoutProject?.id === proj.id
                              ? 'text-fq-dark bg-fq-light-accent/60'
                              : 'text-fq-muted hover:text-fq-dark hover:bg-fq-light-accent/30'
                          }`}
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-fq-muted/60 shrink-0">
                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                          </svg>
                          <span className="truncate">{proj.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <a href="/api/auth/google/login" className="flex items-center gap-2 px-1 hover:text-fq-dark transition-colors group">
                  <span className="w-1.5 h-1.5 rounded-full bg-fq-amber shrink-0" />
                  <span className="font-body text-[11.5px] text-fq-muted group-hover:text-fq-dark">Connect Drive</span>
                </a>
              )}
            </div>
          )}
        </nav>
      </aside>

      {/* Drive flyout — rendered via portal */}
      {flyoutProject && (
        <SidebarDriveFlyout
          projectName={flyoutProject.name}
          projectId={flyoutProject.id}
          internalFolderUrl={flyoutProject.internalFolderUrl}
          clientFolderUrl={flyoutProject.clientFolderUrl}
          subfolderIds={flyoutProject.subfolderIds}
          anchorTop={flyoutTop}
          sidebarWidth={sidebarWidth}
          onClose={() => setFlyoutProject(null)}
        />
      )}
    </>
  );
}
