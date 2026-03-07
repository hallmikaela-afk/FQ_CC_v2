'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { projects, getTeamMember, formatCountdown, formatDate } from '@/data/seed';
import type { Project, Vendor, CallNote } from '@/data/seed';

/* ─────────────── Header Card ─────────────── */
function HeaderCard({ project }: { project: Project }) {
  const countdown = formatCountdown(project.event_date);
  const progressPct = project.tasks_total > 0
    ? (project.tasks_completed / project.tasks_total) * 100
    : 0;

  const t = {
    heading: 'text-fq-dark/90',
    body: 'text-fq-muted/90',
    light: 'text-fq-muted/70',
    icon: 'text-fq-muted/60',
  };

  return (
    <div className="bg-fq-card rounded-xl border border-fq-border shadow-sm p-6">
      {/* Row 1: Name + status + date + countdown */}
      <div className="flex items-start justify-between mb-1">
        <div className="flex items-center gap-3">
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: project.color }} />
          <h1 className={`font-heading text-[28px] font-bold ${t.heading}`}>
            {project.name}
          </h1>
          <span className="text-[11px] font-body font-medium text-fq-accent bg-fq-light-accent px-2.5 py-0.5 rounded-full">
            {project.status}
          </span>
        </div>
        <div className="flex items-center gap-3 text-right">
          <span className={`font-body text-[14px] ${t.body} flex items-center gap-1.5`}>
            📅 {formatDate(project.event_date)}
          </span>
          <span className={`font-heading text-[16px] font-bold ${countdown.isUrgent ? 'text-fq-alert' : 'text-fq-accent'}`}>
            {countdown.text} away
          </span>
        </div>
      </div>

      {/* Concept */}
      <p className={`font-body text-[13px] ${t.light} italic ml-6 mb-4`}>
        {project.concept || 'Click to add concept...'}
      </p>

      <div className="border-t border-fq-border my-4" />

      {/* Info row: venue, guests, budget, service tier */}
      <div className="flex items-center gap-6 mb-4 flex-wrap">
        {(project.venue_name || project.location) && (
          <div className="flex items-center gap-1.5">
            <span className={`${t.icon} text-[13px]`}>◉</span>
            <span className={`font-body text-[13px] ${t.body}`}>
              {project.venue_name || project.location}
              {project.venue_location && `, ${project.venue_location}`}
            </span>
          </div>
        )}
        {project.guest_count && (
          <div className="flex items-center gap-1.5">
            <span className={`${t.icon} text-[13px]`}>♗</span>
            <span className={`font-body text-[13px] ${t.body}`}>{project.guest_count} guests</span>
          </div>
        )}
        {project.estimated_budget && (
          <span className={`font-body text-[13px] ${t.body}`}>{project.estimated_budget} budget</span>
        )}
        {project.service_tier && (
          <span className="text-[11px] font-body font-medium text-fq-accent bg-fq-light-accent px-2.5 py-0.5 rounded-full">
            {project.service_tier}
          </span>
        )}
      </div>

      {/* Task progress + team avatars */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className={`font-body text-[12px] ${t.light}`}>Task progress</span>
            <span className={`font-body text-[12px] ${t.light}`}>
              {project.tasks_completed}/{project.tasks_total} completed
            </span>
          </div>
          <div className="h-[6px] bg-fq-border rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${progressPct}%`, backgroundColor: project.color }}
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
  );
}

/* ─────────────── Next Call Agenda ─────────────── */
function NextCallAgenda({ items }: { items: string[] }) {
  const [agenda, setAgenda] = useState(items);
  const [draft, setDraft] = useState('');

  const addItem = () => {
    if (draft.trim()) {
      setAgenda([...agenda, draft.trim()]);
      setDraft('');
    }
  };

  const t = {
    heading: 'text-fq-dark/90',
    light: 'text-fq-muted/70',
    icon: 'text-fq-muted/60',
  };

  return (
    <div className="bg-fq-card rounded-xl border border-fq-border shadow-sm p-5 h-full">
      <div className="flex items-center gap-2 mb-4">
        <span className={`${t.icon} text-[14px]`}>📋</span>
        <h3 className={`font-heading text-[16px] font-semibold ${t.heading}`}>Next Call Agenda</h3>
      </div>

      <div className="mb-3">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addItem()}
          placeholder="Add items to discuss on the next call..."
          className={`w-full font-body text-[13px] ${t.light} bg-transparent border-none outline-none placeholder:text-fq-muted/40`}
        />
      </div>

      {agenda.length > 0 && (
        <div className="space-y-2 mt-4">
          {agenda.map((item, i) => (
            <p key={i} className={`font-body text-[13px] ${t.light}`}>
              - {item}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────── Vendor Contacts ─────────────── */
function VendorContacts({ vendors: initialVendors }: { vendors: Vendor[] }) {
  const [vendors, setVendors] = useState(initialVendors);

  const removeVendor = (id: string) => {
    setVendors(vendors.filter(v => v.id !== id));
  };

  const t = {
    heading: 'text-fq-dark/90',
    body: 'text-fq-muted/90',
    light: 'text-fq-muted/70',
    icon: 'text-fq-muted/60',
  };

  return (
    <div className="bg-fq-card rounded-xl border border-fq-border shadow-sm p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className={`${t.icon} text-[16px]`}>◇</span>
          <h2 className={`font-heading text-[20px] font-semibold ${t.heading}`}>Vendor Contacts</h2>
          <span className="text-[12px] font-body text-fq-muted bg-fq-bg px-2 py-0.5 rounded-full">
            {vendors.length}
          </span>
        </div>
        <button className="flex items-center gap-1.5 bg-fq-dark text-white font-body text-[13px] font-medium px-4 py-2 rounded-lg hover:bg-fq-dark/90 transition-colors">
          + Add Vendor
        </button>
      </div>

      <div className="divide-y divide-fq-border">
        {vendors.map((vendor) => (
          <div key={vendor.id} className="py-4 flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11px] font-body font-medium text-fq-accent bg-fq-light-accent px-2 py-0.5 rounded-full">
                  {vendor.category}
                </span>
                <span className={`font-body text-[15px] font-medium ${t.heading}`}>
                  {vendor.vendor_name}
                </span>
              </div>
              <div className="flex items-center gap-4 flex-wrap">
                {vendor.contact_name && (
                  <span className={`font-body text-[12px] ${t.light} flex items-center gap-1`}>
                    <span className="text-[10px]">♗</span> {vendor.contact_name}
                  </span>
                )}
                {vendor.email && (
                  <span className={`font-body text-[12px] ${t.light} flex items-center gap-1`}>
                    <span className="text-[10px]">✉</span> {vendor.email}
                  </span>
                )}
                {vendor.phone && (
                  <span className={`font-body text-[12px] ${t.light} flex items-center gap-1`}>
                    <span className="text-[10px]">☏</span> {vendor.phone}
                  </span>
                )}
                {vendor.website && (
                  <span className={`font-body text-[12px] ${t.light} flex items-center gap-1`}>
                    <span className="text-[10px]">⊕</span> {vendor.website}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => removeVendor(vendor.id)}
              className={`${t.light} hover:text-fq-alert transition-colors p-1`}
              title="Remove vendor"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 4h10M5.5 4V3a1 1 0 011-1h3a1 1 0 011 1v1M6.5 7v4M9.5 7v4M4.5 4l.5 8a1 1 0 001 1h4a1 1 0 001-1l.5-8" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────── Call Notes ─────────────── */
function CallNotesSection({ notes }: { notes: CallNote[] }) {
  const t = {
    heading: 'text-fq-dark/90',
    body: 'text-fq-muted/90',
    light: 'text-fq-muted/70',
    icon: 'text-fq-muted/60',
  };

  return (
    <div className="bg-fq-card rounded-xl border border-fq-border shadow-sm p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className={`${t.icon} text-[16px]`}>📄</span>
          <h2 className={`font-heading text-[20px] font-semibold ${t.heading}`}>Call Notes</h2>
          <span className="text-[12px] font-body text-fq-muted bg-fq-bg px-2 py-0.5 rounded-full">
            {notes.length}
          </span>
        </div>
        <button className="flex items-center gap-1.5 bg-fq-dark text-white font-body text-[13px] font-medium px-4 py-2 rounded-lg hover:bg-fq-dark/90 transition-colors">
          ↑ Upload Notes
        </button>
      </div>

      <div className="space-y-0">
        {notes.map((note) => (
          <div key={note.id} className="border-l-[3px] border-fq-accent/40 pl-5 py-5 first:pt-0">
            {/* Date + AI Summary button */}
            <div className="flex items-center justify-between mb-3">
              <h4 className={`font-body text-[14px] font-semibold ${t.heading}`}>
                {formatDate(note.date)}
              </h4>
              <button className={`font-body text-[12px] ${t.light} hover:text-fq-accent transition-colors flex items-center gap-1`}>
                <span className="text-[10px]">✦</span> AI Summary
              </button>
            </div>

            {/* Summary or raw text */}
            {note.summary ? (
              <p className={`font-body text-[13px] ${t.body} leading-relaxed mb-4`}>
                {note.summary}
              </p>
            ) : (
              <p className={`font-body text-[13px] ${t.light} leading-relaxed mb-4`}>
                {note.raw_text}
              </p>
            )}

            {/* Extracted Actions */}
            {note.extracted_actions.length > 0 && (
              <div className="mt-3">
                <p className={`font-body text-[12px] font-medium ${t.heading} mb-2`}>
                  Extracted Actions ({note.extracted_actions.filter(a => a.accepted).length} accepted)
                </p>
                <div className="space-y-1.5">
                  {note.extracted_actions.map((action) => (
                    <div key={action.id} className="flex items-center gap-2">
                      <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${
                        action.accepted
                          ? 'bg-fq-accent text-white'
                          : action.dismissed
                            ? 'bg-fq-border'
                            : 'border border-fq-border'
                      }`}>
                        {action.accepted && (
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M2 5l2.5 2.5L8 3" />
                          </svg>
                        )}
                      </div>
                      <span className={`font-body text-[12px] ${action.dismissed ? 'line-through text-fq-muted/50' : t.body}`}>
                        {action.text}
                      </span>
                      <span className={`font-body text-[11px] ${t.light} ml-1`}>
                        — due {formatDate(action.due_date)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────── Main Page ─────────────── */
export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const project = projects.find(p => p.id === projectId);
  const activeProjects = projects.filter(p => p.status === 'active' && (p.type === 'client' || p.type === 'shoot'));

  if (!project) {
    return (
      <div className="px-10 py-10">
        <p className="font-body text-fq-muted">Project not found.</p>
      </div>
    );
  }

  const t = {
    light: 'text-fq-muted/70',
  };

  return (
    <div className="px-10 py-8">
      {/* Top bar: Back + project selector */}
      <div className="flex items-center gap-4 mb-8">
        <Link
          href="/"
          className={`font-body text-[13px] ${t.light} hover:text-fq-dark transition-colors flex items-center gap-1`}
        >
          ← Back
        </Link>
        <span className="text-fq-border">|</span>
        <select
          value={projectId}
          onChange={(e) => router.push(`/projects/${e.target.value}`)}
          className="font-body text-[14px] text-fq-dark bg-fq-bg border border-fq-border rounded-lg px-3 py-1.5 outline-none cursor-pointer"
        >
          {activeProjects.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {/* Header + Next Call Agenda side by side */}
      <div className="grid grid-cols-[1fr_340px] gap-5 mb-8">
        <HeaderCard project={project} />
        <NextCallAgenda items={project.next_call_agenda || []} />
      </div>

      {/* Vendor Contacts */}
      {project.vendors && project.vendors.length > 0 && (
        <div className="mb-8">
          <VendorContacts vendors={project.vendors} />
        </div>
      )}

      {/* Call Notes */}
      {project.call_notes && project.call_notes.length > 0 && (
        <div className="mb-8">
          <CallNotesSection notes={project.call_notes} />
        </div>
      )}
    </div>
  );
}
