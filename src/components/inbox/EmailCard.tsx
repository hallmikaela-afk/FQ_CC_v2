'use client';

import { useState, useEffect, useRef } from 'react';
import { Reply, PenLine, Clock, Check, X, Trash2, Paperclip } from 'lucide-react';

/* ── Shared types (also used by page + EmailDetail) ── */
export interface EmailProject {
  id: string;
  name: string;
  type: string; // 'wedding' | 'shoot' | ...
  color: string | null;
  event_date: string | null;
}

export interface Email {
  id: string;
  message_id: string;
  subject: string | null;
  from_name: string | null;
  from_email: string | null;
  body_preview: string | null;
  body: string | null;
  received_at: string | null;
  is_read: boolean;
  needs_followup: boolean;
  needs_response: boolean;
  project_id: string | null;
  match_confidence: 'exact' | 'high' | 'suggested' | 'thread' | null;
  conversation_id: string | null;
  folder_id: string | null;
  is_meeting_summary: boolean;
  dismissed: boolean;
  resolved: boolean;
  draft_message_id: string | null;
  category: string | null;
  has_attachments?: boolean;
  projects: EmailProject | null;
}

export interface Project {
  id: string;
  name: string;
  color: string | null;
  type: string;
  status: string;
}

interface Props {
  email: Email;
  isSelected: boolean;
  showStatusPill?: boolean;
  showTriage?: boolean;           // Untagged tab: show always-visible triage controls
  projects: Project[];
  onSelect: () => void;
  onReply: (email: Email) => void;
  onConfirmSuggested: (email: Email) => void;
  onDismissSuggested: (email: Email) => void;
  onToggleFollowup: (email: Email) => void;
  onResolve: (email: Email) => void;
  onNeedsResponse: (email: Email) => void;
  onDraftResponse: (email: Email) => Promise<void>;
  onDismiss: (email: Email) => void;
  onDelete?: (email: Email) => void;
  onReassign: (email: Email, projectId: string | null) => void;
}

/* ── Design tokens ── */
const tk = {
  heading: 'text-fq-dark/90',
  body:    'text-fq-muted/85',
  light:   'text-fq-muted/65',
};

/* ── Project color map ── */
const COLOR_MAP: Record<string, { bg: string; text: string }> = {
  rose:  { bg: 'bg-fq-rose-light',  text: 'text-fq-rose' },
  sage:  { bg: 'bg-fq-sage-light',  text: 'text-fq-sage' },
  blue:  { bg: 'bg-fq-blue-light',  text: 'text-fq-blue' },
  plum:  { bg: 'bg-fq-plum-light',  text: 'text-fq-plum' },
  amber: { bg: 'bg-fq-amber-light', text: 'text-fq-amber' },
  teal:  { bg: 'bg-fq-teal-light',  text: 'text-fq-teal' },
};

function projectColors(color: string | null) {
  return COLOR_MAP[(color ?? '').toLowerCase()] ?? { bg: 'bg-fq-light-accent', text: 'text-fq-muted' };
}

/* ── Project type icon ── */
function ProjectTypeIcon({ type }: { type: string }) {
  if (type === 'wedding') {
    return (
      <svg width="10" height="10" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="inline shrink-0">
        <circle cx="10" cy="10" r="7" />
        <path d="M7 10h6" />
        <path d="M10 7v6" />
      </svg>
    );
  }
  if (type === 'shoot') {
    return (
      <svg width="10" height="10" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="inline shrink-0">
        <rect x="2" y="6" width="16" height="11" rx="2" />
        <circle cx="10" cy="12" r="3" />
        <path d="M7 6l1.5-2h3L13 6" />
      </svg>
    );
  }
  return null;
}

/* ── Unread dot ── */
function ReadDot({ isRead }: { isRead: boolean }) {
  return (
    <span
      className={`w-2 h-2 rounded-full shrink-0 mt-1.5 transition-colors ${
        isRead ? 'bg-transparent' : 'bg-fq-sage'
      }`}
    />
  );
}

/* ── Relative time ── */
function fmtTime(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  }
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  if (now.getTime() - d.getTime() < 7 * 86_400_000) {
    return d.toLocaleDateString('en-US', { weekday: 'short' });
  }
  return d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
}

/* ── Tooltip wrapper ── */
function Tip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="relative group/tip">
      {children}
      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-0.5 rounded-md bg-fq-dark text-white text-[10px] font-medium whitespace-nowrap opacity-0 group-hover/tip:opacity-100 transition-opacity z-30">
        {label}
      </span>
    </div>
  );
}

/* ── Project reassign dropdown ── */
function ReassignDropdown({
  email,
  projects,
  onSelect,
  onClose,
  upward,
}: {
  email: Email;
  projects: Project[];
  onSelect: (projectId: string | null) => void;
  onClose: () => void;
  upward?: boolean;
}) {
  return (
    <div
      className={`absolute ${upward ? 'bottom-full mb-1' : 'top-full mt-1'} left-0 z-50 bg-fq-card border border-fq-border rounded-xl shadow-lg py-1 min-w-[180px]`}
      onClick={(e) => e.stopPropagation()}
    >
      {projects.map((p) => {
        const { bg } = projectColors(p.color);
        const isCurrent = p.id === email.project_id;
        return (
          <button
            key={p.id}
            onClick={() => { onSelect(p.id); onClose(); }}
            className={`w-full text-left px-3 py-1.5 font-body text-[12px] hover:bg-fq-light-accent transition-colors flex items-center gap-2 ${tk.body} ${isCurrent ? 'font-semibold' : ''}`}
          >
            <span className={`w-2 h-2 rounded-full shrink-0 ${bg}`} />
            {p.name}
            {isCurrent && (
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="ml-auto text-fq-sage">
                <path d="M2 6l3 3 5-5" />
              </svg>
            )}
          </button>
        );
      })}
      <div className="border-t border-fq-border my-1" />
      <button
        onClick={() => { onSelect(null); onClose(); }}
        className={`w-full text-left px-3 py-1.5 font-body text-[12px] hover:bg-fq-light-accent transition-colors flex items-center gap-2 ${tk.light}`}
      >
        <span className="w-2 h-2 rounded-full shrink-0 bg-fq-amber/60" />
        Untagged
        {!email.project_id && (
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="ml-auto text-fq-sage">
            <path d="M2 6l3 3 5-5" />
          </svg>
        )}
      </button>
    </div>
  );
}

export default function EmailCard({
  email,
  isSelected,
  showStatusPill = false,
  showTriage = false,
  projects,
  onSelect,
  onReply,
  onConfirmSuggested,
  onDismissSuggested,
  onToggleFollowup,
  onResolve,
  onNeedsResponse,
  onDraftResponse,
  onDismiss,
  onDelete,
  onReassign,
}: Props) {
  const proj        = email.projects;
  const isUntagged  = !email.project_id;
  const isSuggested = email.match_confidence === 'suggested';
  const { bg, text } = proj ? projectColors(proj.color) : { bg: '', text: '' };

  const [draftLoading,  setDraftLoading]  = useState(false);
  const [reassignOpen,  setReassignOpen]  = useState(false);
  const [deleting,      setDeleting]      = useState(false);
  const reassignContainerRef = useRef<HTMLDivElement>(null);

  /* ── Close dropdown on outside click ── */
  useEffect(() => {
    if (!reassignOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (
        reassignContainerRef.current &&
        !reassignContainerRef.current.contains(e.target as Node)
      ) {
        setReassignOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [reassignOpen]);

  const handleReassignSelect = (projectId: string | null) => {
    onReassign(email, projectId);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => e.key === 'Enter' && onSelect()}
      className={`group relative rounded-xl mb-2 transition-all duration-150 border cursor-pointer overflow-visible outline-none focus-visible:ring-2 focus-visible:ring-fq-accent/40 ${
        deleting
          ? 'opacity-40 scale-[0.98] pointer-events-none'
          : isSelected
          ? 'bg-fq-light-accent border-fq-accent/35 shadow-sm'
          : 'bg-fq-card border-fq-border hover:border-fq-accent/20 hover:shadow-sm'
      }`}
    >
      <div className="flex overflow-visible">
        {/* Amber left-edge stripe for untagged emails */}
        {isUntagged && (
          <div className="w-[3px] shrink-0 bg-fq-amber/55 rounded-l-xl" />
        )}

        <div className="flex-1 px-4 py-3.5 min-w-0">
          {/* Row 1: sender + time */}
          <div className="flex items-start gap-2.5">
            <ReadDot isRead={email.is_read} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-0.5">
                <span
                  className={`font-body text-[13.5px] truncate ${
                    email.is_read
                      ? `font-normal ${tk.body}`
                      : `font-semibold ${tk.heading}`
                  }`}
                >
                  {email.from_name || email.from_email || 'Unknown'}
                </span>
                <span className={`font-body text-[11px] ${tk.light} shrink-0`}>
                  {fmtTime(email.received_at)}
                </span>
              </div>

              {/* Row 2: subject */}
              <p className={`font-body text-[12.5px] font-medium ${tk.heading} truncate`}>
                {email.subject || '(no subject)'}
              </p>

              {/* Row 3: preview */}
              <p className={`font-body text-[11.5px] ${tk.light} mt-0.5 truncate leading-snug`}>
                {email.body_preview}
              </p>

              {/* Row 4: badges */}
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">

                {/* ── Project badge (confirmed match) — clickable to reassign ── */}
                {proj && !isSuggested && (
                  <div
                    ref={reassignContainerRef}
                    className="relative"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => setReassignOpen((v) => !v)}
                      className={`inline-flex items-center gap-1 font-body text-[11px] font-medium px-2 py-0.5 rounded-full ${bg} ${text} hover:opacity-75 transition-opacity`}
                    >
                      <ProjectTypeIcon type={proj.type} />
                      {proj.name}
                      <svg width="7" height="7" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="ml-0.5">
                        <path d="M1 2.5l3 3 3-3" />
                      </svg>
                    </button>
                    {reassignOpen && (
                      <ReassignDropdown
                        email={email}
                        projects={projects}
                        onSelect={handleReassignSelect}
                        onClose={() => setReassignOpen(false)}
                      />
                    )}
                  </div>
                )}

                {/* ── Untagged badge — clickable to assign a project ── */}
                {isUntagged && !showTriage && (
                  <div
                    ref={reassignContainerRef}
                    className="relative"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => setReassignOpen((v) => !v)}
                      className="font-body text-[11px] font-medium px-2 py-0.5 rounded-full bg-fq-amber-light text-fq-amber hover:opacity-75 transition-opacity"
                    >
                      Untagged
                    </button>
                    {reassignOpen && (
                      <ReassignDropdown
                        email={email}
                        projects={projects}
                        onSelect={handleReassignSelect}
                        onClose={() => setReassignOpen(false)}
                      />
                    )}
                  </div>
                )}

                {/* Suggested match chip */}
                {isSuggested && proj && (
                  <span className="inline-flex items-center gap-1 font-body text-[11px]">
                    <span className="px-2 py-0.5 rounded-full bg-fq-light-accent text-fq-muted border border-fq-border">
                      Suggested: {proj.name}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); onConfirmSuggested(email); }}
                      title="Confirm match"
                      className="w-5 h-5 flex items-center justify-center rounded-full bg-fq-sage-light text-fq-sage hover:bg-fq-sage hover:text-white transition-colors"
                    >
                      <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2 6l3 3 5-5" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onDismissSuggested(email); }}
                      title="Not this project"
                      className="w-5 h-5 flex items-center justify-center rounded-full bg-fq-light-accent text-fq-muted hover:bg-fq-border hover:text-fq-dark transition-colors"
                    >
                      <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2 2l8 8M10 2L2 10" />
                      </svg>
                    </button>
                  </span>
                )}

                {/* Needs follow-up badge */}
                {email.needs_followup && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onToggleFollowup(email); }}
                    title="Remove follow-up flag"
                    className="font-body text-[11px] font-medium px-2 py-0.5 rounded-full bg-fq-amber-light text-fq-amber hover:bg-fq-amber hover:text-white transition-colors"
                  >
                    Follow-up
                  </button>
                )}

                {/* Status pill — shown in All tab */}
                {showStatusPill && !email.needs_followup && (
                  email.resolved ? (
                    <span className="font-body text-[11px] font-medium px-2 py-0.5 rounded-full bg-fq-light-accent text-fq-muted/70">
                      Resolved
                    </span>
                  ) : email.draft_message_id ? (
                    <span className="font-body text-[11px] font-medium px-2 py-0.5 rounded-full bg-fq-sage-light text-fq-sage">
                      Draft Ready
                    </span>
                  ) : email.needs_response ? (
                    <span className="font-body text-[11px] font-medium px-2 py-0.5 rounded-full bg-fq-blue-light text-fq-blue">
                      Reply Needed
                    </span>
                  ) : null
                )}

                {/* Meeting summary badge */}
                {email.is_meeting_summary && (
                  <span className="font-body text-[11px] font-medium px-2 py-0.5 rounded-full bg-fq-teal-light text-fq-teal">
                    Meeting Summary
                  </span>
                )}

                {/* Attachment indicator */}
                {email.has_attachments && (
                  <span className="inline-flex items-center gap-1 font-body text-[11px] font-medium px-2 py-0.5 rounded-full bg-fq-light-accent text-fq-muted/70">
                    <Paperclip size={10} />
                  </span>
                )}
              </div>

              {/* ── Inline triage panel (Untagged tab only) ── */}
              {showTriage && (
                <div
                  className="flex items-center gap-2 mt-2.5 pt-2.5 border-t border-fq-border/60"
                  onClick={(e) => e.stopPropagation()}
                >
                  <select
                    value={email.project_id ?? ''}
                    onChange={(e) => handleReassignSelect(e.target.value || null)}
                    className={`flex-1 px-2.5 py-1.5 font-body text-[11.5px] bg-fq-bg border border-fq-border rounded-lg ${tk.light} hover:border-fq-accent/30 focus:outline-none focus:ring-1 focus:ring-fq-accent/30 transition-colors`}
                  >
                    <option value="">Tag to project…</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => onDismiss(email)}
                    className={`px-2.5 py-1.5 font-body text-[11.5px] ${tk.light} hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-fq-border hover:border-red-200 shrink-0`}
                  >
                    Dismiss
                  </button>
                </div>
              )}
            </div>

            {/* Chevron — hidden on hover when quick actions appear */}
            <svg
              width="12" height="12" viewBox="0 0 14 14" fill="none"
              stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
              className={`mt-1 shrink-0 ${tk.light} group-hover:opacity-0 transition-opacity`}
            >
              <path d="M5 3l4 4-4 4" />
            </svg>
          </div>
        </div>
      </div>

      {/* ── Quick action toolbar — absolute overlay, visible on hover ── */}
      <div
        className="absolute top-2.5 right-3 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none group-hover:pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-0.5 bg-fq-card/95 border border-fq-border rounded-lg px-1 py-0.5 shadow-sm">

          {/* 1. Reply — opens the email to compose a reply */}
          <Tip label="Reply">
            <button
              onClick={() => onReply(email)}
              className="w-6 h-6 flex items-center justify-center rounded-md text-fq-muted/55 hover:bg-fq-blue-light hover:text-fq-blue transition-colors"
            >
              <Reply size={12} />
            </button>
          </Tip>

          {/* 2. Draft Response — opens detail + generates or shows existing draft */}
          <Tip label={email.draft_message_id ? 'View Draft' : 'Draft Response'}>
            <button
              onClick={async () => {
                if (draftLoading) return;
                if (email.draft_message_id) {
                  // Draft already exists — just open the detail panel
                  onSelect();
                } else {
                  // No draft — open panel then generate (handleDraftResponse selects + generates)
                  setDraftLoading(true);
                  try { await onDraftResponse(email); } finally { setDraftLoading(false); }
                }
              }}
              disabled={draftLoading}
              className={`w-6 h-6 flex items-center justify-center rounded-md transition-colors ${
                email.draft_message_id
                  ? 'bg-fq-sage-light text-fq-sage'
                  : 'text-fq-muted/55 hover:bg-fq-light-accent hover:text-fq-sage'
              } disabled:opacity-40`}
            >
              {draftLoading ? (
                <span className="w-3 h-3 border border-fq-sage/40 border-t-fq-sage rounded-full animate-spin" />
              ) : (
                <PenLine size={12} />
              )}
            </button>
          </Tip>

          {/* 3. Needs Follow-up — toggles needs_followup */}
          <Tip label={email.needs_followup ? 'Remove Follow-up' : 'Needs Follow-up'}>
            <button
              onClick={() => onToggleFollowup(email)}
              className={`w-6 h-6 flex items-center justify-center rounded-md transition-colors ${
                email.needs_followup
                  ? 'bg-fq-amber-light text-fq-amber'
                  : 'text-fq-muted/55 hover:bg-fq-light-accent hover:text-fq-amber'
              }`}
            >
              <Clock size={12} />
            </button>
          </Tip>

          {/* 4. Resolved — sets resolved = true */}
          <Tip label={email.resolved ? 'Resolved' : 'Mark Resolved'}>
            <button
              onClick={() => onResolve(email)}
              className={`w-6 h-6 flex items-center justify-center rounded-md transition-colors ${
                email.resolved
                  ? 'bg-fq-sage-light text-fq-sage'
                  : 'text-fq-muted/55 hover:bg-fq-light-accent hover:text-fq-sage'
              }`}
            >
              <Check size={12} />
            </button>
          </Tip>

          {/* 5. Dismiss — sets dismissed = true */}
          <Tip label="Dismiss">
            <button
              onClick={() => onDismiss(email)}
              className="w-6 h-6 flex items-center justify-center rounded-md text-fq-muted/55 hover:bg-red-50 hover:text-red-500 transition-colors"
            >
              <X size={12} />
            </button>
          </Tip>

          {/* 6. Delete — hard delete from DB */}
          {onDelete && (
            <Tip label="Delete">
              <button
                onClick={() => {
                  setDeleting(true);
                  setTimeout(() => onDelete(email), 350);
                }}
                disabled={deleting}
                className="w-6 h-6 flex items-center justify-center rounded-md text-fq-muted/55 hover:bg-red-100 hover:text-red-600 transition-colors disabled:opacity-40"
              >
                <Trash2 size={12} />
              </button>
            </Tip>
          )}

        </div>
      </div>
    </div>
  );
}
