'use client';

import Link from 'next/link';
import { Project, getTeamMember, formatCountdown, formatDate } from '@/data/seed';

export default function ShootCard({ project }: { project: Project }) {
  const countdown = formatCountdown(project.event_date);
  const openTasks = project.tasks_total - project.tasks_completed;

  const t = {
    heading: 'text-fq-dark/90',
    body: 'text-fq-muted/90',
    light: 'text-fq-muted/70',
    icon: 'text-fq-muted/60',
  };

  return (
    <Link href={`/projects/${project.id}`} className="block group">
      <div className="bg-fq-card rounded-xl border border-fq-border shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden">
        <div className="h-[4px]" style={{ backgroundColor: project.color }} />

        <div className="p-5">
          {/* Row 1: Name + Countdown */}
          <div className="flex items-start justify-between mb-0.5">
            <h2 className={`font-heading text-[18px] font-semibold ${t.heading} leading-tight group-hover:text-fq-accent transition-colors`}>
              {project.name}
            </h2>
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

          {/* Venue / Location */}
          {(project.location || project.venue_name) && (
            <div className="mb-1">
              <div className="flex items-center gap-2">
                <span className={`${t.icon} w-4 text-center text-[12px]`}>◉</span>
                <span className={`font-body text-[13px] ${t.body}`}>
                  {project.venue_name || project.location}
                </span>
              </div>
              {/* Address lines */}
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

          {/* Open Tasks */}
          <div className="mt-4">
            <span className={`font-body text-[12px] ${t.body}`}>
              {openTasks} open task{openTasks !== 1 ? 's' : ''}
            </span>
            <span className={`font-body text-[12px] ${t.light} ml-1`}>
              ({project.tasks_completed}/{project.tasks_total} completed)
            </span>
          </div>

          {/* Team */}
          <div className="flex items-center gap-1.5 mt-3">
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
        </div>
      </div>
    </Link>
  );
}
