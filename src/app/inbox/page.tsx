'use client';

import { useState } from 'react';
import { projects } from '@/data/seed';

/* ── colour / typography tokens (matches rest of app) ── */
const t = {
  heading: 'text-fq-dark/90',
  body: 'text-fq-muted/90',
  light: 'text-fq-muted/70',
  icon: 'text-fq-muted/60',
  label: 'text-fq-muted/80',
};

/* ── Types ── */
type EmailStatus = 'flagged' | 'draft_ready' | 'responded' | 'dismissed';

interface InboxEmail {
  id: string;
  from_name: string;
  from_email: string;
  subject: string;
  preview: string;
  body: string;
  received: string;          // ISO date-time
  status: EmailStatus;
  project_id: string | null; // link to project
  project_label: string;     // display name
  alert?: string;            // e.g. "Deadline mentioned — action needed"
  draft?: string;            // AI-drafted response
}

/* ── Seed inbox data (matches screenshot) ── */
const emails: InboxEmail[] = [
  {
    id: 'e1',
    from_name: 'Wave Resort Events',
    from_email: 'events@waveresort.com',
    subject: 'Re: Julia & Frank Wedding - Room Block Update',
    preview: 'Hi Mikaela, I wanted to follow up on the June 7th wedding. We currently have 25 rooms rese…',
    body: 'Hi Mikaela, I wanted to follow up on the room block for the June 7th wedding. We currently have 25 rooms reserved and need final numbers by April 15th...',
    received: '2026-03-08T04:30:00',
    status: 'draft_ready',
    project_id: 'julia-frank',
    project_label: 'Julia & Frank',
    alert: 'Deadline mentioned — action needed',
    draft: `Hi [Wave Resort Events Team],

Thank you for the update on the room block. I'll confirm final numbers with Julia & Frank and get back to you well before the April 15th deadline.

Best,
Mikaela Hall
Fox & Quinn`,
  },
  {
    id: 'e2',
    from_name: 'Enrich Events',
    from_email: 'cassandra@enrichevents.com',
    subject: 'Menorca Floral Proposal - Interwoven Shoot',
    preview: 'Mikaela, Please find attached our floral design proposal for the Interwoven shoot at Vestige Son Vell. We\'ve inc…',
    body: 'Mikaela, Please find attached our floral design proposal for the Interwoven shoot at Vestige Son Vell. We\'ve included three concept options with mood boards and pricing for each arrangement. The first option features locally sourced Mediterranean wildflowers, while the second uses imported garden roses with olive branch accents. The third is a hybrid approach. Please let us know which direction you\'d like to go, and we can schedule a follow-up call to finalize details.\n\nBest,\nCassandra\nEnrich Events',
    received: '2026-03-08T10:45:00',
    status: 'flagged',
    project_id: 'menorca',
    project_label: 'Menorca: Interwoven',
    draft: `Hi Cassandra,

Thank you so much for putting these concepts together — all three options are beautiful. I'm leaning toward the hybrid approach (Option 3) as it balances the local Mediterranean feel with the romantic garden rose aesthetic we discussed.

I'd love to schedule a call this week to walk through the details. Are you available Thursday or Friday afternoon?

Best,
Mikaela Hall
Fox & Quinn`,
  },
  {
    id: 'e3',
    from_name: 'Tippi Reynolds',
    from_email: 'tippi.reynolds@gmail.com',
    subject: 'Question about photographer timeline',
    preview: 'Hi! Justin and I were wondering about the timeline for selecting a photographer. We saw someone on Instagra…',
    body: 'Hi! Justin and I were wondering about the timeline for selecting a photographer. We saw someone on Instagram (@KateHarrisPhoto) and really loved their work. Is it too early to reach out? Also, do we need to have our venue confirmed before booking a photographer, or can we do that in parallel? We want to make sure we don\'t miss out on our top choice.\n\nThanks!\nTippi',
    received: '2026-03-08T06:20:00',
    status: 'flagged',
    project_id: 'tippi-justin',
    project_label: 'Tippi & Justin',
    draft: `Hi Tippi!

Great taste — I'll look into @KateHarrisPhoto right away! You're actually at the perfect time to start booking a photographer. You don't need the venue finalized first; most photographers book based on date availability, so it's smart to reach out early.

I'll do some research on Kate and a couple of other options that match your style, and we can review them together on our next call.

Best,
Mikaela Hall
Fox & Quinn`,
  },
  {
    id: 'e4',
    from_name: 'Lilysh Floral',
    from_email: 'contact@lilyshdesign.com',
    subject: 'Floral mockup photos - Julia & Frank',
    preview: 'Hi Mikaela, Attached are the mockup photos for the centerpiece and ceremony arch. Let me know if you\'d like…',
    body: 'Hi Mikaela, Attached are the mockup photos for the centerpiece and ceremony arch. Let me know if you\'d like any adjustments before we finalize. The greenery-forward palette with blush and white accents turned out beautifully. I think Julia will love it!\n\nBest,\nLiliya\nLilysh Floral',
    received: '2026-03-07T14:10:00',
    status: 'responded',
    project_id: 'julia-frank',
    project_label: 'Julia & Frank',
  },
  {
    id: 'e5',
    from_name: 'EFEGE Photography',
    from_email: 'hello@efegephoto.com',
    subject: 'Re: Menorca shoot dates confirmed',
    preview: 'Mikaela, Great news — May 18th works perfectly for us. We\'ve blocked the full day…',
    body: 'Mikaela, Great news — May 18th works perfectly for us. We\'ve blocked the full day for the shoot. Looking forward to collaborating on this!\n\nCheers,\nEFEGE',
    received: '2026-03-07T09:30:00',
    status: 'dismissed',
    project_id: 'menorca',
    project_label: 'Menorca',
  },
];

/* ── Filter tabs ── */
const FILTERS: { key: EmailStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'flagged', label: 'Flagged' },
  { key: 'draft_ready', label: 'Draft Ready' },
  { key: 'responded', label: 'Responded' },
  { key: 'dismissed', label: 'Dismissed' },
];

function countByStatus(status: EmailStatus | 'all') {
  if (status === 'all') return emails.length;
  return emails.filter(e => e.status === status).length;
}

/* ── Status badge component ── */
function StatusBadge({ status }: { status: EmailStatus }) {
  const cfg: Record<EmailStatus, { label: string; bg: string; text: string }> = {
    flagged: { label: 'Flagged', bg: 'bg-fq-amber-light', text: 'text-fq-amber' },
    draft_ready: { label: 'Draft Ready', bg: 'bg-fq-sage-light', text: 'text-fq-sage' },
    responded: { label: 'Responded', bg: 'bg-fq-blue-light', text: 'text-fq-blue' },
    dismissed: { label: 'Dismissed', bg: 'bg-fq-light-accent', text: 'text-fq-muted' },
  };
  const c = cfg[status];
  return (
    <span className={`text-[11px] font-body font-medium px-2 py-0.5 rounded-full ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  );
}

/* ── Status icon for list ── */
function StatusIcon({ status }: { status: EmailStatus }) {
  if (status === 'draft_ready') {
    return (
      <span className="text-fq-sage">
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14.5 3.5l2 2L7 15l-3.5.5.5-3.5z" />
        </svg>
      </span>
    );
  }
  // flagged / default — warning triangle
  return (
    <span className="text-fq-amber">
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 3L2 17h16L10 3z" />
        <path d="M10 8v4M10 14h.01" />
      </svg>
    </span>
  );
}

/* ── Format time ── */
function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('en-US', {
    month: 'numeric', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

/* ── Main page ── */
export default function InboxPage() {
  const [activeFilter, setActiveFilter] = useState<EmailStatus | 'all'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState<string | null>(null);
  const [draftTexts, setDraftTexts] = useState<Record<string, string>>({});
  const [emailStatuses, setEmailStatuses] = useState<Record<string, EmailStatus>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const getStatus = (e: InboxEmail) => emailStatuses[e.id] ?? e.status;

  const filtered = activeFilter === 'all'
    ? emails
    : emails.filter(e => getStatus(e) === activeFilter);

  const selected = selectedId ? emails.find(e => e.id === selectedId) ?? null : null;
  const selectedStatus = selected ? getStatus(selected) : null;
  const project = selected?.project_id
    ? projects.find(p => p.id === selected.project_id) ?? null
    : null;

  const getDraftText = (e: InboxEmail) => draftTexts[e.id] ?? e.draft ?? '';

  const handleDismiss = (id: string) => {
    setEmailStatuses(prev => ({ ...prev, [id]: 'dismissed' }));
    setSelectedId(null);
  };

  const handleMarkResponded = (id: string) => {
    setEmailStatuses(prev => ({ ...prev, [id]: 'responded' }));
  };

  const handleCopyDraft = (e: InboxEmail) => {
    navigator.clipboard.writeText(getDraftText(e));
    setCopiedId(e.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="flex h-screen">
      {/* ── Left: Email List ── */}
      <div className={`flex flex-col ${selected ? 'w-[480px] min-w-[480px]' : 'flex-1 max-w-[780px]'} border-r border-fq-border`}>
        {/* Header */}
        <div className="px-8 pt-10 pb-2">
          <h1 className={`font-heading text-[32px] font-semibold ${t.heading}`}>Inbox</h1>
          <p className={`font-body text-[14px] ${t.light} mt-0.5`}>Monitored emails requiring attention</p>
        </div>

        {/* Info banner */}
        <div className="mx-8 mt-4 mb-5 px-4 py-3 rounded-lg border border-fq-border bg-fq-card">
          <p className={`font-body text-[12px] ${t.body} flex items-center gap-2`}>
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
              <rect x="3" y="4" width="14" height="12" rx="2" />
              <path d="M3 7l7 4 7-4" />
            </svg>
            Inbox monitoring polls your Outlook every 15 minutes. Connect your Outlook account in Settings to enable live monitoring.
          </p>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 px-8 mb-4">
          {FILTERS.map(f => {
            const count = f.key === 'all'
              ? emails.length
              : emails.filter(e => getStatus(e) === f.key).length;
            const isActive = activeFilter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setActiveFilter(f.key)}
                className={`
                  font-body text-[13px] px-3 py-1.5 rounded-full transition-all duration-200
                  ${isActive
                    ? 'bg-fq-dark text-white font-medium'
                    : 'text-fq-muted hover:text-fq-dark hover:bg-fq-light-accent'
                  }
                `}
              >
                {f.label}
                <span className={`ml-1.5 ${isActive ? 'text-white/70' : 'text-fq-muted/50'}`}>{count}</span>
              </button>
            );
          })}
        </div>

        {/* Email list */}
        <div className="flex-1 overflow-y-auto px-5 pb-6">
          {filtered.length === 0 && (
            <p className={`font-body text-[13px] ${t.light} text-center mt-10`}>No emails in this category</p>
          )}
          {filtered.map(email => {
            const isSelected = selectedId === email.id;
            const status = getStatus(email);
            return (
              <button
                key={email.id}
                onClick={() => setSelectedId(email.id)}
                className={`
                  w-full text-left px-5 py-4 rounded-xl mb-2 transition-all duration-200 border
                  ${isSelected
                    ? 'bg-fq-light-accent border-fq-accent/30 shadow-sm'
                    : 'bg-fq-card border-fq-border hover:border-fq-accent/20 hover:shadow-sm'
                  }
                `}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    <StatusIcon status={status} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`font-body text-[14px] font-semibold ${t.heading} truncate`}>
                        {email.from_name}
                      </span>
                      <span className={`font-body text-[12px] ${t.light} shrink-0`}>
                        {formatTime(email.received)}
                      </span>
                    </div>
                    <p className={`font-body text-[13px] ${t.heading} font-medium mt-0.5 truncate`}>
                      {email.subject}
                    </p>
                    <p className={`font-body text-[12px] ${t.light} mt-0.5 truncate`}>
                      {email.preview}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <StatusBadge status={status} />
                      <span className={`font-body text-[11px] ${t.light}`}>{email.project_label}</span>
                    </div>
                  </div>
                  {/* chevron */}
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={`mt-3 shrink-0 ${t.icon}`}>
                    <path d="M5 3l4 4-4 4" />
                  </svg>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Right: Detail Panel ── */}
      {selected ? (
        <div className="flex-1 flex flex-col overflow-hidden bg-fq-bg">
          {/* Panel header */}
          <div className="flex items-start justify-between px-8 pt-8 pb-4 border-b border-fq-border bg-fq-card">
            <div>
              <h2 className={`font-heading text-[22px] font-semibold ${t.heading}`}>Email Details</h2>
            </div>
            <button
              onClick={() => setSelectedId(null)}
              className={`p-1 rounded-lg hover:bg-fq-light-accent transition-colors ${t.icon}`}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <circle cx="10" cy="10" r="7" />
                <path d="M7.5 7.5l5 5M12.5 7.5l-5 5" />
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-8 py-6 space-y-5">
            {/* Subject + meta */}
            <div>
              <h3 className={`font-heading text-[20px] font-semibold ${t.heading} leading-tight`}>
                {selected.subject}
              </h3>
              <div className={`font-body text-[13px] ${t.body} mt-2 space-y-0.5`}>
                <p>From: <span className="font-medium text-fq-dark/80">{selected.from_name}</span> &lt;{selected.from_email}&gt;</p>
                <p>Received: {formatDateTime(selected.received)}</p>
                {selected.project_label && (
                  <p>Project: <span className="font-medium text-fq-dark/80">{selected.project_label}</span></p>
                )}
              </div>
            </div>

            {/* Alert */}
            {selected.alert && (
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-fq-amber-light/60 border border-fq-amber/20">
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-fq-amber shrink-0">
                  <path d="M10 3L2 17h16L10 3z" />
                  <path d="M10 8v4M10 14h.01" />
                </svg>
                <span className="font-body text-[13px] font-medium text-fq-amber">{selected.alert}</span>
              </div>
            )}

            {/* Email body preview */}
            <div>
              <h4 className={`font-heading text-[15px] font-semibold ${t.heading} mb-2`}>Email Preview</h4>
              <div className="bg-fq-card border border-fq-border rounded-xl px-5 py-4">
                <p className={`font-body text-[13px] ${t.body} leading-relaxed whitespace-pre-line`}>
                  {selected.body}
                </p>
              </div>
            </div>

            {/* AI Draft Response */}
            {(getDraftText(selected)) && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className={`font-heading text-[15px] font-semibold ${t.heading} flex items-center gap-2`}>
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="14" height="12" rx="2" />
                      <path d="M3 7l7 4 7-4" />
                    </svg>
                    AI Draft Response
                  </h4>
                  <span className="flex items-center gap-1 text-[12px] font-body text-fq-accent font-medium bg-fq-light-accent px-2.5 py-1 rounded-full">
                    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10 2l2 4 4.5.7-3.3 3.1.8 4.5L10 12.2 5.9 14.3l.8-4.5L3.5 6.7 8 6z" />
                    </svg>
                    AI Assist
                  </span>
                </div>
                <div className="bg-fq-amber-light/30 border border-fq-amber/15 rounded-xl px-5 py-4">
                  {editingDraft === selected.id ? (
                    <textarea
                      value={getDraftText(selected)}
                      onChange={e => setDraftTexts(prev => ({ ...prev, [selected.id]: e.target.value }))}
                      className="w-full bg-transparent font-body text-[13px] text-fq-dark/85 leading-relaxed resize-none outline-none min-h-[180px]"
                      autoFocus
                    />
                  ) : (
                    <p className="font-body text-[13px] text-fq-dark/85 leading-relaxed whitespace-pre-line">
                      {getDraftText(selected)}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Project context (if linked) */}
            {project && (
              <div className="bg-fq-card border border-fq-border rounded-xl px-5 py-4">
                <h4 className={`font-heading text-[14px] font-semibold ${t.heading} mb-2`}>Project Context</h4>
                <div className={`font-body text-[12px] ${t.body} space-y-1`}>
                  <p className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: project.color }} />
                    <span className="font-medium text-fq-dark/80">{project.name}</span>
                    {project.venue_name && <span>· {project.venue_name}</span>}
                  </p>
                  {project.event_date && (
                    <p>Event: {new Date(project.event_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                  )}
                  <p>Tasks: {project.tasks_completed}/{project.tasks_total} complete</p>
                </div>
              </div>
            )}
          </div>

          {/* Action bar */}
          <div className="px-8 py-4 border-t border-fq-border bg-fq-card flex items-center gap-3">
            {getDraftText(selected) && selectedStatus !== 'responded' && selectedStatus !== 'dismissed' && (
              <>
                <button
                  onClick={() => {
                    handleCopyDraft(selected);
                    handleMarkResponded(selected.id);
                  }}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-fq-accent text-white font-body text-[13px] font-medium hover:bg-fq-accent/90 transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 3l-7 8-3-2-5 5" />
                    <path d="M17 3l-5 1 5-1zM17 3l-1 5" />
                  </svg>
                  {copiedId === selected.id ? 'Copied!' : 'Copy Draft'}
                </button>
                <button
                  onClick={() => {
                    if (editingDraft === selected.id) {
                      setEditingDraft(null);
                    } else {
                      setEditingDraft(selected.id);
                      if (!draftTexts[selected.id]) {
                        setDraftTexts(prev => ({ ...prev, [selected.id]: selected.draft ?? '' }));
                      }
                    }
                  }}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-fq-border bg-fq-card font-body text-[13px] font-medium text-fq-dark/80 hover:bg-fq-light-accent transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14.5 3.5l2 2L7 15l-3.5.5.5-3.5z" />
                  </svg>
                  {editingDraft === selected.id ? 'Done Editing' : 'Edit Draft'}
                </button>
              </>
            )}
            <button className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-fq-border bg-fq-card font-body text-[13px] font-medium text-fq-dark/80 hover:bg-fq-light-accent transition-colors">
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="10" cy="10" r="7" />
                <path d="M10 7v6M7 10h6" />
              </svg>
              Create Task
            </button>
            {selectedStatus !== 'dismissed' && (
              <button
                onClick={() => handleDismiss(selected.id)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg border border-fq-border bg-fq-card font-body text-[13px] font-medium ${t.light} hover:bg-fq-light-accent transition-colors`}
              >
                <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="10" cy="10" r="7" />
                  <path d="M7.5 7.5l5 5M12.5 7.5l-5 5" />
                </svg>
                Dismiss
              </button>
            )}
          </div>
        </div>
      ) : (
        /* Empty state */
        <div className="flex-1 flex items-center justify-center bg-fq-bg">
          <div className="text-center">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto text-fq-muted/30 mb-4">
              <rect x="6" y="10" width="36" height="28" rx="4" />
              <path d="M6 16l18 10 18-10" />
            </svg>
            <p className={`font-body text-[14px] ${t.light}`}>Select an email to view details</p>
          </div>
        </div>
      )}
    </div>
  );
}
