'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useFullProjects } from '@/lib/hooks';
import { formatCountdown, formatDate } from '@/data/seed';
import type { Project, TeamMember } from '@/data/seed';

/* ── Compact project card for the grid ── */
function ProjectCard({ project, getTeamMember }: { project: Project; getTeamMember: (id: string) => TeamMember | undefined }) {
  const countdown = formatCountdown(project.event_date);
  const progressPct = project.tasks_total > 0
    ? (project.tasks_completed / project.tasks_total) * 100
    : 0;

  const t = {
    heading: 'text-fq-dark/90',
    body: 'text-fq-muted/90',
    light: 'text-fq-muted/70',
  };

  return (
    <Link href={`/projects/${project.id}`} className="block">
      <div className="bg-fq-card rounded-xl border border-fq-border shadow-sm p-5 hover:shadow-md transition-shadow h-full">
        {/* Row 1: Name + Status */}
        <div className="flex items-start justify-between mb-1">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: project.color }} />
            <h3 className={`font-heading text-[17px] font-semibold ${t.heading} truncate`}>
              {project.name}
            </h3>
          </div>
          <span className="text-[11px] font-body font-medium text-fq-accent bg-fq-light-accent px-2 py-0.5 rounded-full shrink-0 ml-2">
            {project.status}
          </span>
        </div>

        {/* Concept / description */}
        {project.concept && (
          <p className={`font-body text-[12px] ${t.light} mb-2 line-clamp-2`}>
            {project.concept}
          </p>
        )}

        {/* Date + countdown */}
        <div className="flex items-center gap-3 mb-3">
          <span className={`font-body text-[12px] ${t.body}`}>
            {formatDate(project.event_date)}
          </span>
          <span className={`font-body text-[12px] font-medium ${countdown.isUrgent ? 'text-fq-alert' : t.light}`}>
            {countdown.text}
          </span>
        </div>

        {/* Task progress */}
        {project.tasks_total > 0 && (
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <span className={`font-body text-[11px] ${t.light}`}>Tasks</span>
              <span className={`font-body text-[11px] ${t.light}`}>
                {project.tasks_completed}/{project.tasks_total}
              </span>
            </div>
            <div className="h-[4px] bg-fq-border rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${progressPct}%`, backgroundColor: project.color }}
              />
            </div>
          </div>
        )}

        {/* Design board link (shoots only) */}
        {project.design_board_link && (
          <div className="mb-3">
            <span
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.open(project.design_board_link, '_blank'); }}
              className="inline-flex items-center gap-1 font-body text-[11px] text-fq-accent hover:underline cursor-pointer"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="8" height="8" rx="1.5" /><path d="M4 6h4M6 4v4" /></svg>
              Design Board
            </span>
          </div>
        )}

        {/* Team avatars */}
        <div className="flex items-center gap-1">
          {project.assigned_to.map((id) => {
            const member = getTeamMember(id);
            if (!member) return null;
            return (
              <div
                key={id}
                className="w-6 h-6 rounded-full bg-fq-light-accent flex items-center justify-center"
                title={member.name}
              >
                <span className="font-body text-[9px] font-semibold text-fq-accent">
                  {member.initials}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </Link>
  );
}

const PROJECT_COLORS = [
  '#8B7355', '#6B8E6B', '#C4A882', '#8E6B6B', '#6B7F8E',
  '#A882C4', '#82A8C4', '#C4826B', '#6BC4A8', '#C4B882',
];

function NewProjectModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [type, setType] = useState<'client' | 'shoot' | 'proposal'>('client');
  const [eventDate, setEventDate] = useState('');
  const [color, setColor] = useState(PROJECT_COLORS[0]);
  const [applyTemplates, setApplyTemplates] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (!name.trim()) { setError('Name is required'); return; }
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), type, event_date: eventDate || null, color, status: 'active' }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error || 'Failed to create'); setSaving(false); return; }
      const project = await res.json();

      // Auto-apply template tasks if event_date is set and requested
      if (applyTemplates && eventDate && type === 'client') {
        await fetch('/api/template-tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ project_id: project.id, event_date: eventDate }),
        });
      }

      onCreated();
      onClose();
    } catch (err: any) {
      setError(err.message);
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center" onClick={onClose}>
      <div
        className="bg-fq-card rounded-2xl border border-fq-border shadow-xl p-8 w-full max-w-md"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="font-heading text-[22px] font-semibold text-fq-dark mb-6">New Project</h2>

        <div className="space-y-4">
          {/* Name */}
          <div>
            <label className="block font-body text-[12px] font-medium text-fq-muted mb-1">Project Name *</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Smith & Jones Wedding"
              className="w-full font-body text-[14px] text-fq-dark bg-fq-bg border border-fq-border rounded-lg px-3 py-2 outline-none focus:border-fq-accent/40"
              autoFocus
            />
          </div>

          {/* Type */}
          <div>
            <label className="block font-body text-[12px] font-medium text-fq-muted mb-1">Type</label>
            <div className="flex gap-2">
              {(['client', 'shoot', 'proposal'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={`px-3 py-1.5 rounded-lg font-body text-[12px] font-medium transition-colors ${type === t ? 'bg-fq-accent text-white' : 'bg-fq-light-accent text-fq-dark hover:bg-fq-border'}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Event date */}
          <div>
            <label className="block font-body text-[12px] font-medium text-fq-muted mb-1">Event Date</label>
            <input
              type="date"
              value={eventDate}
              onChange={e => setEventDate(e.target.value)}
              className="w-full font-body text-[14px] text-fq-dark bg-fq-bg border border-fq-border rounded-lg px-3 py-2 outline-none focus:border-fq-accent/40"
            />
          </div>

          {/* Color */}
          <div>
            <label className="block font-body text-[12px] font-medium text-fq-muted mb-1">Color</label>
            <div className="flex gap-2 flex-wrap">
              {PROJECT_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full transition-all ${color === c ? 'ring-2 ring-offset-2 ring-fq-accent' : ''}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Apply template tasks */}
          {type === 'client' && eventDate && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={applyTemplates}
                onChange={e => setApplyTemplates(e.target.checked)}
                className="w-4 h-4 accent-fq-accent"
              />
              <span className="font-body text-[13px] text-fq-muted">Apply task templates (generates tasks based on event date)</span>
            </label>
          )}

          {error && <p className="font-body text-[12px] text-fq-alert">{error}</p>}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={handleCreate}
            disabled={saving}
            className="flex-1 py-2.5 bg-fq-accent text-white font-body text-[14px] font-medium rounded-lg hover:bg-fq-dark transition-colors disabled:opacity-50"
          >
            {saving ? 'Creating...' : 'Create Project'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 font-body text-[14px] text-fq-muted hover:text-fq-dark transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProjectsPage() {
  const { projects, getTeamMember, loading, refetch } = useFullProjects();
  const [showNewProject, setShowNewProject] = useState(false);

  const clients = projects.filter(p => p.type === 'client' && p.status === 'active');
  const shoots = projects.filter(p => p.type === 'shoot');

  const t = {
    heading: 'text-fq-dark',
    light: 'text-fq-muted/70',
  };

  if (loading) {
    return (
      <div className="py-10 px-10">
        <p className="font-body text-[14px] text-fq-muted">Loading...</p>
      </div>
    );
  }

  return (
    <div className="py-10 px-10">
      {showNewProject && (
        <NewProjectModal
          onClose={() => setShowNewProject(false)}
          onCreated={refetch}
        />
      )}
      <div className="flex items-end justify-between mb-10">
        <div>
          <h1 className="font-heading text-[32px] font-semibold text-fq-dark">Projects</h1>
          <p className={`font-body text-[14px] ${t.light}`}>All projects organized by type</p>
        </div>
        <button
          onClick={() => setShowNewProject(true)}
          className="px-4 py-2 bg-fq-accent text-white font-body text-[13px] font-medium rounded-lg hover:bg-fq-dark transition-colors"
        >
          + New Project
        </button>
      </div>

      {/* Client Weddings */}
      <div className="mb-12">
        <div className="flex items-center gap-2.5 mb-5">
          <span className="text-fq-muted/50 text-[18px]">♡</span>
          <h2 className="font-heading text-[24px] font-semibold text-fq-dark">Client Weddings</h2>
          <span className="bg-fq-light-accent text-fq-accent font-body text-[12px] font-medium px-2 py-0.5 rounded-full">
            {clients.length}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-5">
          {clients.map((project) => (
            <ProjectCard key={project.id} project={project} getTeamMember={getTeamMember} />
          ))}
        </div>
      </div>

      {/* Styled Shoots */}
      <div>
        <div className="flex items-center gap-2.5 mb-5">
          <span className="text-fq-muted/50 text-[18px]">📸</span>
          <h2 className="font-heading text-[24px] font-semibold text-fq-dark">Styled Shoots</h2>
          <span className="bg-fq-light-accent text-fq-accent font-body text-[12px] font-medium px-2 py-0.5 rounded-full">
            {shoots.length}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-5">
          {shoots.map((project) => (
            <ProjectCard key={project.id} project={project} getTeamMember={getTeamMember} />
          ))}
        </div>
      </div>
    </div>
  );
}
