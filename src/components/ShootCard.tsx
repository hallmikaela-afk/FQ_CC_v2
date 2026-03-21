'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatCountdown, formatDate } from '@/data/seed';
import type { Project, TeamMember } from '@/data/seed';
import QuickUploadButton from '@/components/QuickUploadButton';

const defaultGetTeamMember = (_id: string): TeamMember | undefined => undefined;

export default function ShootCard({ project, getTeamMember = defaultGetTeamMember }: { project: Project; getTeamMember?: (id: string) => TeamMember | undefined }) {
  const countdown = formatCountdown(project.event_date);
  const [tasks, setTasks] = useState(project.tasks || []);
  const callNoteCount = project.call_notes?.length ?? 0;

  const openTasks = tasks.filter(t => !t.completed).slice(0, 10);
  const completedCount = tasks.filter(t => t.completed).length;

  const toggleTask = (taskId: string) => {
    setTasks(prev => prev.map(t =>
      t.id === taskId ? { ...t, completed: !t.completed } : t
    ));
  };

  const t = {
    heading: 'text-fq-dark/90',
    body: 'text-fq-muted/90',
    light: 'text-fq-muted/70',
    icon: 'text-fq-muted/60',
  };

  return (
    <div className="bg-fq-card rounded-xl border border-fq-border shadow-sm overflow-hidden">
      <div className="h-[4px]" style={{ backgroundColor: project.color }} />

      <div className="p-5">
        {/* Row 1: Name + Countdown */}
        <div className="flex items-start justify-between mb-0.5">
          <Link href={`/projects/${project.id}`} className="group">
            <h2 className={`font-heading text-[18px] font-semibold ${t.heading} leading-tight group-hover:text-fq-accent transition-colors`}>
              {project.name}
            </h2>
          </Link>
          <div className="text-right shrink-0 ml-2">
            <span className={`font-heading text-[20px] font-bold tracking-tight ${countdown.isUrgent ? 'text-fq-alert' : t.heading}`}>
              {countdown.text}
            </span>
            <p className={`font-body text-[10px] ${t.light}`}>countdown</p>
          </div>
        </div>

        {/* Date */}
        <p className={`font-body text-[12px] ${t.light} mb-3`}>
          {formatDate(project.event_date)}
        </p>

        {/* Design Board Link */}
        {project.design_board_link && (
          <div className="mb-3">
            <a
              href={project.design_board_link}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className={`inline-flex items-center gap-1.5 font-body text-[12px] text-fq-accent hover:underline`}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="8" height="8" rx="1.5" /><path d="M4 6h4M6 4v4" /></svg>
              Design / Canva
            </a>
          </div>
        )}

        {/* Venue / Location + Address */}
        {(project.location || project.venue_name) && (
          <div className="mb-3">
            <div className="flex items-center gap-2">
              <span className={`${t.icon} w-4 text-center text-[12px]`}>◉</span>
              <span className={`font-body text-[13px] ${t.body}`}>
                {project.venue_name || project.location}
              </span>
            </div>
            {(project.location_street || project.venue_street) && (
              <div className="ml-6 mt-0.5">
                <p className={`font-body text-[12px] ${t.light} leading-snug`}>
                  {project.location_street || project.venue_street}
                </p>
                {(project.location_city_state_zip || project.venue_city_state_zip) && (
                  <p className={`font-body text-[12px] ${t.light} leading-snug`}>
                    {project.location_city_state_zip || project.venue_city_state_zip}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Divider */}
        <div className="border-t border-fq-border my-3" />

        {/* Open Tasks header */}
        <div className="flex items-center justify-between mb-2">
          <span className={`font-body text-[12px] font-medium ${t.body}`}>
            Open Tasks
          </span>
          <span className={`font-body text-[11px] ${t.light}`}>
            {completedCount}/{tasks.length} done
          </span>
        </div>

        {/* Task list — open tasks with checkboxes */}
        {openTasks.length > 0 ? (
          <div className="space-y-1.5 mb-3">
            {openTasks.map((task) => (
              <label
                key={task.id}
                className="flex items-start gap-2 cursor-pointer group/task"
              >
                <button
                  onClick={() => toggleTask(task.id)}
                  className="mt-0.5 w-4 h-4 rounded border border-fq-border shrink-0 flex items-center justify-center hover:border-fq-accent/60 transition-colors"
                >
                  {task.completed && (
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-fq-accent">
                      <path d="M2 5l2.5 2.5L8 3" />
                    </svg>
                  )}
                </button>
                <span className={`font-body text-[12px] ${t.body} leading-snug group-hover/task:text-fq-dark transition-colors`}>
                  {task.text}
                  {task.due_date && (
                    <span className={`ml-1.5 ${t.light} text-[10px]`}>
                      · {formatDate(task.due_date)}
                    </span>
                  )}
                </span>
              </label>
            ))}
          </div>
        ) : (
          <p className={`font-body text-[12px] ${t.light} italic mb-3`}>All tasks completed!</p>
        )}

        {/* Team */}
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          {project.assigned_to.map((id) => {
            const member = getTeamMember(id);
            if (!member) return null;
            return (
              <div
                key={id}
                className="w-7 h-7 rounded-full bg-fq-light-accent flex items-center justify-center"
                title={member.name}
              >
                <span className="font-body text-[10px] font-semibold text-fq-accent">
                  {member.initials}
                </span>
              </div>
            );
          })}
        </div>

        {/* Call notes badge + upload */}
        <div className="flex flex-wrap items-center gap-1.5 mt-2">
          {callNoteCount > 0 && (
            <Link
              href={`/projects/${project.id}`}
              className={`text-[11px] font-body ${t.light} bg-fq-bg px-2 py-0.5 rounded-full hover:bg-fq-border/50 transition-colors`}
            >
              ☐ {callNoteCount} call note{callNoteCount !== 1 ? 's' : ''}
            </Link>
          )}
          <QuickUploadButton projectId={project.id} projectName={project.name} />
        </div>
      </div>
    </div>
  );
}
