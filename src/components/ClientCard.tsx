'use client';

import { useState, useRef, useEffect, ReactNode } from 'react';
import Link from 'next/link';
import { Project, getTeamMember, formatCountdown, formatDate } from '@/data/seed';

/* ── Inline editable text field ── */
function EditableField({
  value,
  onChange,
  className = '',
  placeholder = 'Click to edit...',
  inputClassName = '',
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  placeholder?: string;
  inputClassName?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { onChange(draft); setEditing(false); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { onChange(draft); setEditing(false); }
          if (e.key === 'Escape') { setDraft(value); setEditing(false); }
        }}
        className={`bg-transparent border-b border-fq-accent/40 outline-none w-full py-0 ${inputClassName || className}`}
        placeholder={placeholder}
      />
    );
  }

  return (
    <span
      onClick={() => { setDraft(value); setEditing(true); }}
      className={`cursor-text hover:border-b hover:border-fq-border/60 transition-colors ${className}`}
    >
      {value || <span className="text-fq-border italic">{placeholder}</span>}
    </span>
  );
}

/* ── Editable link row (for expanded details) ── */
function EditableLinkRow({
  icon,
  label,
  value,
  onChange,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  return (
    <div className="flex items-center gap-2 text-[12px] font-body">
      <span className="text-fq-muted/70 w-4 text-center shrink-0">{icon}</span>
      <span className="text-fq-muted/80 w-[130px] shrink-0">{label}</span>
      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => { onChange(draft); setEditing(false); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { onChange(draft); setEditing(false); }
            if (e.key === 'Escape') { setDraft(value); setEditing(false); }
          }}
          className="flex-1 min-w-0 text-fq-muted bg-fq-bg border border-fq-border rounded px-2 py-1 text-[11px] outline-none focus:border-fq-accent/40"
          placeholder="https://..."
        />
      ) : (
        <span
          onClick={() => { setDraft(value); setEditing(true); }}
          className="flex-1 min-w-0 text-fq-muted/60 bg-fq-bg px-2 py-1 rounded text-[11px] truncate cursor-text hover:border hover:border-fq-border/60"
        >
          {value || 'https://...'}
        </span>
      )}
    </div>
  );
}

/* ── Main card ── */
export default function ClientCard({ project }: { project: Project }) {
  const [expanded, setExpanded] = useState(false);
  const countdown = formatCountdown(project.event_date);
  const progressPct = project.tasks_total > 0
    ? (project.tasks_completed / project.tasks_total) * 100
    : 0;
  const callNoteCount = project.call_notes?.length ?? 0;

  // Editable state for all fields
  const [name, setName] = useState(project.name);
  const [eventDate, setEventDate] = useState(project.event_date);
  const [serviceTier, setServiceTier] = useState(project.service_tier || '');
  const [concept, setConcept] = useState(project.concept || '');
  const [venueName, setVenueName] = useState(project.venue_name || '');
  const [venueLocation, setVenueLocation] = useState(project.venue_location || '');
  const [venueAddress, setVenueAddress] = useState(project.venue_address || '');
  const [clientAddress, setClientAddress] = useState(project.client_address || '');
  const [guestCount, setGuestCount] = useState(project.guest_count?.toString() || '');
  const [budget, setBudget] = useState(project.estimated_budget || '');
  const [signedDate, setSignedDate] = useState(project.contract_signed_date || '');
  const [partner1, setPartner1] = useState(project.client1_name || '');
  const [partner2, setPartner2] = useState(project.client2_name || '');
  const [canvaLink, setCanvaLink] = useState(project.canva_link || '');
  const [internalShare, setInternalShare] = useState(project.internal_file_share || '');
  const [clientFolder, setClientFolder] = useState(project.client_shared_folder || '');
  const [portalLink, setPortalLink] = useState(project.client_portal_link || '');
  const [clientWebsite, setClientWebsite] = useState(project.client_website || '');
  const [sharepointFolder, setSharepointFolder] = useState(project.sharepoint_folder || '');

  // Text color classes — lighter muted tones
  const t = {
    heading: 'text-fq-dark/90',
    body: 'text-fq-muted/90',
    light: 'text-fq-muted/70',
    icon: 'text-fq-muted/60',
    label: 'text-fq-muted/80',
  };

  return (
    <div className="bg-fq-card rounded-xl border border-fq-border shadow-sm overflow-hidden flex flex-col min-w-0">
      {/* Color bar */}
      <div className="h-[4px]" style={{ backgroundColor: project.color }} />

      <div className="p-5 pb-3 flex-1">
        {/* Header: Name + Countdown */}
        <div className="flex items-start justify-between mb-0.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className={`${t.icon} text-[14px] shrink-0`}>♡</span>
            <h2 className={`font-heading text-[18px] font-semibold ${t.heading} leading-tight min-w-0`}>
              <EditableField
                value={name}
                onChange={setName}
                className={`font-heading text-[18px] font-semibold ${t.heading}`}
                placeholder="Client name..."
              />
            </h2>
          </div>
          <div className="text-right shrink-0 ml-2">
            <span className={`font-heading text-[20px] font-bold tracking-tight ${countdown.isUrgent ? 'text-fq-alert' : t.heading}`}>
              {countdown.text}
            </span>
            <p className={`font-body text-[10px] ${t.light}`}>countdown</p>
          </div>
        </div>

        {/* Date */}
        <div className="ml-5 mb-2">
          <EditableField
            value={eventDate}
            onChange={setEventDate}
            className={`font-body text-[12px] ${t.light}`}
            placeholder="YYYY-MM-DD"
          />
        </div>

        {/* Service tier + Concept badges */}
        <div className="flex flex-wrap items-center gap-1.5 ml-5 mb-3">
          <EditableField
            value={serviceTier}
            onChange={setServiceTier}
            className="text-[11px] font-body font-medium text-fq-accent bg-fq-light-accent px-2.5 py-0.5 rounded-full"
            inputClassName="text-[11px] font-body text-fq-accent bg-fq-light-accent px-2.5 py-0.5 rounded-full"
            placeholder="Service tier..."
          />
          <EditableField
            value={concept}
            onChange={setConcept}
            className={`text-[11px] font-body ${t.light} bg-fq-bg px-2.5 py-0.5 rounded-full`}
            inputClassName={`text-[11px] font-body ${t.light} bg-fq-bg px-2.5 py-0.5 rounded-full`}
            placeholder="Concept..."
          />
        </div>

        {/* Metadata rows */}
        <div className="space-y-1.5 ml-5 mb-4 text-[13px] font-body">
          {/* Venue */}
          <div className="flex items-center gap-2">
            <span className={`${t.icon} w-4 text-center text-[12px]`}>◉</span>
            <EditableField
              value={venueName ? `${venueName}, ${venueLocation}` : ''}
              onChange={(v) => {
                const parts = v.split(',').map(s => s.trim());
                setVenueName(parts[0] || '');
                setVenueLocation(parts.slice(1).join(', ') || '');
              }}
              className={t.body}
              placeholder="Venue, Location"
            />
          </div>
          {/* Venue Address */}
          <div className="flex items-center gap-2">
            <span className={`${t.icon} w-4 text-center text-[12px]`}>&nbsp;</span>
            <EditableField
              value={venueAddress}
              onChange={setVenueAddress}
              className={`${t.light} text-[12px]`}
              placeholder="Venue address..."
            />
          </div>
          {/* Client Address */}
          <div className="flex items-center gap-2">
            <span className={`${t.icon} w-4 text-center text-[12px]`}>⌂</span>
            <EditableField
              value={clientAddress}
              onChange={setClientAddress}
              className={t.body}
              placeholder="Client address..."
            />
          </div>
          {/* Guests */}
          <div className="flex items-center gap-2">
            <span className={`${t.icon} w-4 text-center text-[12px]`}>♗</span>
            <EditableField
              value={guestCount ? `${guestCount} guests` : ''}
              onChange={(v) => setGuestCount(v.replace(/[^0-9]/g, ''))}
              className={t.body}
              placeholder="Guest count..."
            />
          </div>
          {/* Budget */}
          <div className="flex items-center gap-2">
            <span className={`${t.icon} w-4 text-center text-[12px]`}>$</span>
            <EditableField
              value={budget}
              onChange={setBudget}
              className={t.body}
              placeholder="Budget..."
            />
          </div>
          {/* Signed date */}
          <div className="flex items-center gap-2">
            <span className={`${t.icon} w-4 text-center text-[12px]`}>☐</span>
            <EditableField
              value={signedDate ? `Signed ${formatDate(signedDate)}` : ''}
              onChange={(v) => setSignedDate(v.replace('Signed ', ''))}
              className={t.body}
              placeholder="Signed date..."
            />
          </div>
        </div>

        {/* Task Progress */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className={`font-body text-[12px] ${t.label}`}>Task Progress</span>
            <span className={`font-body text-[12px] ${t.light}`}>
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
            <span className={`font-body text-[11px] ${t.light} w-8 text-right`}>
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
            <span className={`text-[11px] font-body ${t.light} bg-fq-bg px-2 py-0.5 rounded-full`}>
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
                className={`text-[11px] font-body ${t.light} bg-fq-bg px-2 py-0.5 rounded-full`}
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
        className={`w-full py-2.5 border-t border-fq-border text-[12px] font-body ${t.light} hover:text-fq-dark hover:bg-fq-bg/50 transition-colors flex items-center justify-center gap-1`}
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
          <h3 className={`font-heading text-[16px] font-semibold ${t.heading} mb-3`}>
            Client Details
          </h3>

          {/* Project Color palette */}
          {project.project_colors && project.project_colors.length > 0 && (
            <div className="mb-4">
              <p className="font-body text-[12px] text-fq-accent/80 font-medium mb-2">Project Color</p>
              <div className="flex flex-wrap gap-1.5">
                {project.project_colors.map((c, i) => (
                  <div
                    key={i}
                    className="w-7 h-7 rounded-full border border-fq-border/50 cursor-pointer hover:scale-110 transition-transform"
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Partner cards */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            <div className="border border-fq-border rounded-lg p-2.5">
              <p className={`font-body text-[10px] ${t.light} mb-0.5`}>Partner 1</p>
              <EditableField
                value={partner1}
                onChange={setPartner1}
                className={`font-body text-[13px] ${t.heading} font-medium`}
                placeholder="Partner name..."
              />
            </div>
            <div className="border border-fq-border rounded-lg p-2.5">
              <p className={`font-body text-[10px] ${t.light} mb-0.5`}>Partner 2</p>
              <EditableField
                value={partner2}
                onChange={setPartner2}
                className={`font-body text-[13px] ${t.heading} font-medium`}
                placeholder="Partner name..."
              />
            </div>
          </div>

          {/* Links & Resources */}
          <div className="mb-4">
            <h3 className={`font-heading text-[15px] font-semibold ${t.heading} mb-2`}>
              Links &amp; Resources
            </h3>
            <div className="space-y-1.5">
              <EditableLinkRow icon="✎" label="Design Deck / Canva" value={canvaLink} onChange={setCanvaLink} />
              <EditableLinkRow icon="⊡" label="Internal File Share" value={internalShare} onChange={setInternalShare} />
              <EditableLinkRow icon="⊡" label="Client Shared Folder" value={clientFolder} onChange={setClientFolder} />
              <EditableLinkRow icon="⊞" label="Client Portal" value={portalLink} onChange={setPortalLink} />
              <EditableLinkRow icon="◎" label="Client Website" value={clientWebsite} onChange={setClientWebsite} />
              <EditableLinkRow icon="⊘" label="SharePoint Folder" value={sharepointFolder} onChange={setSharepointFolder} />
            </div>
          </div>

          {/* Latest Call Note */}
          {project.call_notes && project.call_notes.length > 0 && (
            <div>
              <h3 className={`font-heading text-[14px] font-semibold ${t.heading} mb-2 flex items-center gap-1.5`}>
                <span className="text-fq-accent/70">✦</span>
                Latest Call Note
                <span className={`font-body text-[11px] font-normal ${t.light}`}>
                  ({project.call_notes.length} total)
                </span>
              </h3>
              <div className="bg-fq-bg rounded-lg p-3 border-l-[3px] border-fq-accent/60">
                <p className={`font-body text-[12px] font-semibold ${t.heading} mb-1`}>
                  {formatDate(project.call_notes[0].date)}
                </p>
                <p className={`font-body text-[12px] ${t.light} leading-relaxed`}>
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
