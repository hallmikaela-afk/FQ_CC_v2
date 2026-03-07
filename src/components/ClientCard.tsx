'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Project, getTeamMember, formatCountdown, formatDate } from '@/data/seed';

export default function ClientCard({ project }: { project: Project }) {
  const [expanded, setExpanded] = useState(false);
  const countdown = formatCountdown(project.event_date);
  const progressPct = project.tasks_total > 0
    ? (project.tasks_completed / project.tasks_total) * 100
    : 0;

  const callNoteCount = project.call_notes?.length ?? 0;

  return (
    <div className="bg-fq-card rounded-xl border border-fq-border shadow-sm overflow-hidden flex flex-col min-w-0">
      {/* Color bar */}
      <div className="h-[4px]" style={{ backgroundColor: project.color }} />

      <div className="p-5 pb-3 flex-1">
        {/* Header: Name + Countdown */}
        <div className="flex items-start justify-between mb-0.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-fq-muted text-[14px] shrink-0">♡</span>
            <h2 className="font-heading text-[18px] font-semibold text-fq-dark leading-tight truncate">
              {project.name}
            </h2>
          </div>
          <div className="text-right shrink-0 ml-2">
            <span className={`font-heading text-[20px] font-bold tracking-tight ${countdown.isUrgent ? 'text-fq-alert' : 'text-fq-dark'}`}>
              {countdown.text}
            </span>
            <p className="font-body text-[10px] text-fq-muted">countdown</p>
          </div>
        </div>

        {/* Date */}
        <p className="font-body text-[12px] text-fq-muted ml-5 mb-2">
          {formatDate(project.event_date)}
        </p>

        {/* Service tier + Concept badges */}
        <div className="flex flex-wrap items-center gap-1.5 ml-5 mb-3">
          {project.service_tier && (
            <span className="text-[11px] font-body font-medium text-fq-accent bg-fq-light-accent px-2.5 py-0.5 rounded-full">
              {project.service_tier}
            </span>
          )}
          {project.concept && (
            <span className="text-[11px] font-body text-fq-muted bg-fq-bg px-2.5 py-0.5 rounded-full">
              {project.concept}
            </span>
          )}
        </div>

        {/* Metadata rows */}
        <div className="space-y-1.5 ml-5 mb-4 text-[13px] font-body text-fq-dark">
          {project.venue_name && (
            <div className="flex items-center gap-2">
              <span className="text-fq-muted w-4 text-center text-[12px]">◉</span>
              <span className="truncate">{project.venue_name}, {project.venue_location}</span>
            </div>
          )}
          {project.guest_count && (
            <div className="flex items-center gap-2">
              <span className="text-fq-muted w-4 text-center text-[12px]">♗</span>
              <span>{project.guest_count} guests</span>
            </div>
          )}
          {project.estimated_budget && (
            <div className="flex items-center gap-2">
              <span className="text-fq-muted w-4 text-center text-[12px]">$</span>
              <span>{project.estimated_budget}</span>
            </div>
          )}
          {project.contract_signed_date && (
            <div className="flex items-center gap-2">
              <span className="text-fq-muted w-4 text-center text-[12px]">☐</span>
              <span>Signed {formatDate(project.contract_signed_date)}</span>
            </div>
          )}
        </div>

        {/* Task Progress */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="font-body text-[12px] text-fq-dark">Task Progress</span>
            <span className="font-body text-[12px] text-fq-muted">
              {project.tasks_completed}/{project.tasks_total}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-[6px] bg-fq-border rounded-full overflow-hidden">
              <div
                className="h-full rounded-full animate-progress"
                style={{
                  width: `${progressPct}%`,
                  backgroundColor: project.color,
                }}
              />
            </div>
            <span className="font-body text-[11px] text-fq-muted w-8 text-right">
              {Math.round(progressPct)}%
            </span>
          </div>
        </div>

        {/* Badges row */}
        <div className="flex flex-wrap items-center gap-1.5 mb-3">
          {project.overdue_count > 0 && (
            <span className="text-[11px] font-body font-medium text-fq-alert bg-fq-alert/10 px-2 py-0.5 rounded-full">
              {project.overdue_count} overdue
            </span>
          )}
          {callNoteCount > 0 && (
            <span className="text-[11px] font-body text-fq-muted bg-fq-bg px-2 py-0.5 rounded-full">
              ☐ {callNoteCount} call note{callNoteCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Team members */}
        <div className="flex flex-wrap items-center gap-1.5 mb-2">
          {project.assigned_to.map((id) => {
            const member = getTeamMember(id);
            if (!member) return null;
            return (
              <span
                key={id}
                className="text-[11px] font-body text-fq-muted bg-fq-bg px-2 py-0.5 rounded-full"
              >
                {member.name}
              </span>
            );
          })}
        </div>

        {/* View project link */}
        <Link
          href={`/projects/${project.id}`}
          className="inline-block text-[11px] font-body font-medium text-fq-accent bg-fq-light-accent px-2.5 py-0.5 rounded-full hover:bg-fq-accent/20 transition-colors"
        >
          View project
        </Link>
      </div>

      {/* Expand / Collapse toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full py-2.5 border-t border-fq-border text-[12px] font-body text-fq-muted hover:text-fq-dark hover:bg-fq-bg/50 transition-colors flex items-center justify-center gap-1"
      >
        {expanded ? 'Less details' : 'Full details'}
        <svg
          width="10"
          height="10"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
        >
          <path d="M3 5l3 3 3-3" />
        </svg>
      </button>

      {/* Expanded Details */}
      {expanded && (
        <div className="border-t border-fq-border px-5 py-5">
          {/* Client Details Section */}
          <h3 className="font-heading text-[16px] font-semibold text-fq-dark mb-3">
            Client Details
          </h3>

          {/* Project Color palette */}
          {project.project_colors && project.project_colors.length > 0 && (
            <div className="mb-4">
              <p className="font-body text-[12px] text-fq-accent font-medium mb-2">Project Color</p>
              <div className="flex flex-wrap gap-1.5">
                {project.project_colors.map((c, i) => (
                  <div
                    key={i}
                    className="w-7 h-7 rounded-full border border-fq-border/50"
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Partner cards */}
          {(project.client1_name || project.client2_name) && (
            <div className="grid grid-cols-2 gap-2 mb-4">
              {project.client1_name && (
                <div className="border border-fq-border rounded-lg p-2.5">
                  <p className="font-body text-[10px] text-fq-muted mb-0.5">Partner 1</p>
                  <p className="font-body text-[13px] text-fq-dark font-medium">{project.client1_name}</p>
                </div>
              )}
              {project.client2_name && (
                <div className="border border-fq-border rounded-lg p-2.5">
                  <p className="font-body text-[10px] text-fq-muted mb-0.5">Partner 2</p>
                  <p className="font-body text-[13px] text-fq-dark font-medium">{project.client2_name}</p>
                </div>
              )}
            </div>
          )}

          {/* Links & Resources */}
          {(project.canva_link || project.internal_file_share || project.client_shared_folder || project.client_portal_link || project.client_website || project.sharepoint_folder) && (
            <div className="mb-4">
              <h3 className="font-heading text-[15px] font-semibold text-fq-dark mb-2">
                Links &amp; Resources
              </h3>
              <div className="space-y-1.5">
                {project.canva_link && (
                  <LinkRow icon="✎" label="Design Deck / Canva" url={project.canva_link} />
                )}
                {project.internal_file_share && (
                  <LinkRow icon="☐" label="Internal File Share" url={project.internal_file_share} />
                )}
                {project.client_shared_folder && (
                  <LinkRow icon="☐" label="Client Shared Folder" url={project.client_shared_folder} />
                )}
                {project.client_portal_link && (
                  <LinkRow icon="☐" label="Client Portal" url={project.client_portal_link} />
                )}
                {project.client_website && (
                  <LinkRow icon="◎" label="Client Website" url={project.client_website} />
                )}
                {project.sharepoint_folder && (
                  <LinkRow icon="⊘" label="SharePoint Folder" url={project.sharepoint_folder} />
                )}
              </div>
            </div>
          )}

          {/* Latest Call Note */}
          {project.call_notes && project.call_notes.length > 0 && (
            <div>
              <h3 className="font-heading text-[14px] font-semibold text-fq-dark mb-2 flex items-center gap-1.5">
                <span className="text-fq-accent">✦</span>
                Latest Call Note
                <span className="font-body text-[11px] font-normal text-fq-muted">
                  ({project.call_notes.length} total)
                </span>
              </h3>
              <div className="bg-fq-bg rounded-lg p-3 border-l-[3px] border-fq-accent">
                <p className="font-body text-[12px] font-semibold text-fq-dark mb-1">
                  {formatDate(project.call_notes[0].date)}
                </p>
                <p className="font-body text-[12px] text-fq-muted leading-relaxed">
                  {project.call_notes[0].raw_text}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LinkRow({ icon, label, url }: { icon: string; label: string; url: string }) {
  const displayUrl = url.length > 20 ? url.slice(0, 20) + '...' : url;
  return (
    <div className="flex items-center gap-2 text-[11px] font-body">
      <span className="text-fq-muted w-4 text-center shrink-0">{icon}</span>
      <span className="text-fq-dark shrink-0">{label}</span>
      <span className="text-fq-muted bg-fq-bg px-2 py-1 rounded text-[10px] truncate">
        {displayUrl}
      </span>
    </div>
  );
}
