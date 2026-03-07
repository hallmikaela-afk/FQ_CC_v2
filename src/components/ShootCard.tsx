'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Project, getTeamMember, formatCountdown, formatDate } from '@/data/seed';

export default function ShootCard({ project }: { project: Project }) {
  const [concept, setConcept] = useState(project.concept || '');
  const [isEditingConcept, setIsEditingConcept] = useState(false);
  const countdown = formatCountdown(project.event_date);
  const progressPct = project.tasks_total > 0
    ? (project.tasks_completed / project.tasks_total) * 100
    : 0;

  return (
    <Link href={`/projects/${project.id}`} className="block group">
      <div className="bg-fq-card rounded-xl border border-fq-border shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden cursor-pointer">
        <div className="h-[3px]" style={{ backgroundColor: project.color }} />

        <div className="p-6">
          {/* Name + Date */}
          <div className="flex items-start justify-between mb-1">
            <div className="flex items-center gap-3">
              <h2 className="font-heading text-[24px] font-semibold text-fq-dark leading-tight">
                {project.name}
              </h2>
              <span className="text-[11px] font-body font-medium text-fq-success bg-fq-success/10 px-2 py-0.5 rounded-full">
                {project.status}
              </span>
            </div>
            <div className="flex items-center gap-3 text-right shrink-0">
              <span className="font-body text-[13px] text-fq-muted">
                {formatDate(project.event_date)}
              </span>
              <span className={`font-heading text-[15px] font-bold ${countdown.isUrgent ? 'text-fq-alert' : 'text-fq-accent'}`}>
                {countdown.text}
              </span>
            </div>
          </div>

          {/* Concept */}
          <div className="mb-4" onClick={(e) => { e.preventDefault(); setIsEditingConcept(true); }}>
            {isEditingConcept ? (
              <input
                type="text"
                value={concept}
                onChange={(e) => setConcept(e.target.value)}
                onBlur={() => setIsEditingConcept(false)}
                onKeyDown={(e) => e.key === 'Enter' && setIsEditingConcept(false)}
                autoFocus
                className="font-body text-[13px] italic text-fq-muted bg-transparent border-b border-fq-border outline-none w-full py-0.5"
                placeholder="Click to add concept..."
              />
            ) : (
              <p className="font-body text-[13px] italic text-fq-muted">
                {concept || 'Click to add concept...'}
              </p>
            )}
          </div>

          {/* Location + Key vendors */}
          <div className="flex items-center gap-2 text-[13px] font-body text-fq-muted mb-4 flex-wrap">
            {project.location && (
              <span>📍 {project.location}</span>
            )}
            {project.photographer && (
              <>
                <span className="text-fq-border">|</span>
                <span>📷 {project.photographer}</span>
              </>
            )}
            {project.florist && (
              <>
                <span className="text-fq-border">|</span>
                <span>🌸 {project.florist}</span>
              </>
            )}
          </div>

          {/* Divider */}
          <div className="border-t border-fq-border my-4" />

          {/* Progress + Team */}
          <div className="flex items-center justify-between">
            <div className="flex-1 mr-6">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-body text-[12px] text-fq-muted">Task progress</span>
                <span className="font-body text-[12px] text-fq-muted">
                  {project.tasks_completed}/{project.tasks_total} completed
                </span>
              </div>
              <div className="w-full h-[6px] bg-fq-border rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full animate-progress"
                  style={{
                    width: `${progressPct}%`,
                    backgroundColor: project.color,
                  }}
                />
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {project.assigned_to.map((id) => {
                const member = getTeamMember(id);
                if (!member) return null;
                return (
                  <div
                    key={id}
                    className="w-8 h-8 rounded-full bg-fq-light-accent flex items-center justify-center"
                    title={member.name}
                  >
                    <span className="font-body text-[11px] font-semibold text-fq-accent">
                      {member.initials}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
