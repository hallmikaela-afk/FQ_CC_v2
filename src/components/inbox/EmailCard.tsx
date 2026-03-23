'use client';

import { useState } from 'react';
import { Reply, PenLine, Clock, Check, X } from 'lucide-react';

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
  onSelect: () => void;
  onConfirmSuggested: (email: Email) => void;
  onDismissSuggested: (email: Email) => void;
  onToggleFollowup: (email: Email) => void;
  onResolve: (email: Email) => void;
  onNeedsResponse: (email: Email) => void;
  onDraftResponse: (email: Email) => Promise<void>;
  onDismiss: (email: Email) => void;
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

/* ── Project type icon: wedding ring vs camera ── */
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

export default function EmailCard({
  email,
  isSelected,
  showStatusPill = false,
  onSelect,
  onConfirmSuggested,
  onDismissSuggested,
  onToggleFollowup,
  onResolve,
  onNeedsResponse,
  onDraftResponse,
  onDismiss,
}: Props) {
  const proj        = email.projects;
  const isUntagged  = !email.project_id;
  const isSuggested = email.match_confidence === 'suggested';
  const { bg, text } = proj ? projectColors(proj.color) : { bg: '', text: '' };
  const [draftLoading, setDraftLoading] = useState(false);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => e.key === 'Enter' && onSelect()}
      className={`group relative rounded-xl mb-2 transition-all duration-150 border cursor-pointer overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-fq-accent/40 ${
        isSelected
          ? 'bg-fq-light-accent border-fq-accent/35 shadow-sm'
          : 'bg-fq-card border-fq-border hover:border-fq-accent/20 hover:shadow-sm'
      }`}
    >
      <div className="flex">
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
                {/* Project badge (confirmed match) */}
                {proj && !isSuggested && (
                  <span
                    className={`inline-flex items-center gap-1 font-body text-[11px] font-medium px-2 py-0.5 rounded-full ${bg} ${text}`}
                  >
                    <ProjectTypeIcon type={proj.type} />
                    {proj.name}
                  </span>
                )}

                {/* Untagged badge */}
                {isUntagged && (
                  <span className="font-body text-[11px] font-medium px-2 py-0.5 rounded-full bg-fq-amber-light text-fq-amber">
                    Untagged
                  </span>
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

                {/* Status pill — shown in All tab when not already shown via specific badge */}
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
              </div>
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

      {/* ── Quick action bar — absolute overlay, visible on hover ── */}
      <div
        className="absolute top-2.5 right-3 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none group-hover:pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-0.5 bg-fq-card/95 border border-fq-border rounded-lg px-1 py-0.5 shadow-sm">

          {/* 1. Needs Response */}
          <button
            onClick={() => onNeedsResponse(email)}
            title="Needs Response"
            className={`w-6 h-6 flex items-center justify-center rounded-md transition-colors ${
              email.needs_response
                ? 'bg-fq-blue-light text-fq-blue'
                : 'text-fq-muted/55 hover:bg-fq-light-accent hover:text-fq-blue'
            }`}
          >
            <Reply size={12} />
          </button>

          {/* 2. Draft Response */}
          <button
            onClick={async () => {
              if (draftLoading || email.draft_message_id) return;
              setDraftLoading(true);
              try { await onDraftResponse(email); } finally { setDraftLoading(false); }
            }}
            title={email.draft_message_id ? 'Draft Ready' : 'Draft Response'}
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

          {/* 3. Needs Follow-up */}
          <button
            onClick={() => onToggleFollowup(email)}
            title={email.needs_followup ? 'Remove Follow-up' : 'Needs Follow-up'}
            className={`w-6 h-6 flex items-center justify-center rounded-md transition-colors ${
              email.needs_followup
                ? 'bg-fq-amber-light text-fq-amber'
                : 'text-fq-muted/55 hover:bg-fq-light-accent hover:text-fq-amber'
            }`}
          >
            <Clock size={12} />
          </button>

          {/* 4. Resolved */}
          <button
            onClick={() => onResolve(email)}
            title="Mark Resolved"
            className={`w-6 h-6 flex items-center justify-center rounded-md transition-colors ${
              email.resolved
                ? 'bg-fq-sage-light text-fq-sage'
                : 'text-fq-muted/55 hover:bg-fq-light-accent hover:text-fq-sage'
            }`}
          >
            <Check size={12} />
          </button>

          {/* 5. Dismiss */}
          <button
            onClick={() => onDismiss(email)}
            title="Dismiss"
            className="w-6 h-6 flex items-center justify-center rounded-md text-fq-muted/55 hover:bg-red-50 hover:text-red-500 transition-colors"
          >
            <X size={12} />
          </button>

        </div>
      </div>
    </div>
  );
}
