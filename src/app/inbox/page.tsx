'use client';

import { useState, useEffect, useCallback } from 'react';

/* ── colour / typography tokens ── */
const t = {
  heading: 'text-fq-dark/90',
  body: 'text-fq-muted/90',
  light: 'text-fq-muted/70',
  icon: 'text-fq-muted/60',
};

/* ── Types ── */
interface EmailRow {
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
  project_id: string | null;
  match_confidence: string | null;
  conversation_id: string | null;
  folder_id: string | null;
  is_meeting_summary: boolean;
  projects: { id: string; name: string; type: string; color: string | null; event_date: string | null } | null;
}

interface Project {
  id: string;
  name: string;
  color: string | null;
  type: string;
  status: string;
}

type FilterKey = 'flagged' | 'draft_ready' | 'responded' | 'dismissed' | 'all';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'flagged',     label: 'Flagged' },
  { key: 'draft_ready', label: 'Draft Ready' },
  { key: 'responded',   label: 'Responded' },
  { key: 'dismissed',   label: 'Dismissed' },
  { key: 'all',         label: 'All' },
];

/* ── Smart email filtering ── */
const NO_REPLY_PATTERNS = [
  'no-reply@', 'noreply@', 'no_reply@', 'donotreply@', 'do-not-reply@',
  'notifications@canva.com', 'mail@canva.com', 'design@canva.com',
  'noreply@adobe.com', 'echosign@echosign.com', 'adobesign@adobesign.com',
  'drive-shares-noreply@google.com', 'comments-noreply@docs.google.com',
  'no-reply@dropbox.com', 'noreply@dropbox.com',
  'calendar-notification@google.com', 'calendar-server@google.com',
  'invitations-noreply@mail.instagram.com',
];

const MARKETING_SUBJECT_PATTERNS = [
  'unsubscribe', 'newsletter', 'promotional', 'special offer', 'limited time',
  'sale ends', 'discount', 'coupon', '% off', 'free trial', 'upgrade your plan',
  'monthly digest', 'weekly digest', 'weekly newsletter',
  'confirm your email', 'verify your email address',
  'you\'re invited to try', 'new feature announcement',
];

const MARKETING_SENDER_DOMAINS = [
  '@mailchimp.com', '@sendgrid.net', '@klaviyo.com', '@constantcontact.com',
  '@campaignmonitor.com', '@hubspot.com', '@marketo.com',
];

const AUTOMATED_SUBJECT_PATTERNS = [
  // Calendar / scheduling
  'meeting invitation', 'calendar invitation', 'zoom meeting invitation',
  'accepted your invitation', 'declined your invitation', 'tentatively accepted',
  // Receipts / confirmations
  'your receipt from', 'your invoice from', 'payment confirmation',
  'order confirmation', 'booking confirmation', 'reservation confirmation',
  // Platform notifications
  'shared a design with you', 'invited you to edit', 'canva',
  'has shared a file', 'shared an item with you', 'google drive',
  'has sent you a document', 'document waiting for your signature',
];

function shouldFilterEmail(email: EmailRow): boolean {
  // NEVER filter matched project emails (client/vendor)
  if (email.project_id) return false;
  // NEVER filter Zoom AI Companion meeting summaries
  if (email.is_meeting_summary) return false;

  const fromEmail = (email.from_email ?? '').toLowerCase();
  const subject = (email.subject ?? '').toLowerCase();
  const preview = (email.body_preview ?? '').toLowerCase();

  // No-reply senders
  if (NO_REPLY_PATTERNS.some(p => fromEmail.includes(p))) return true;
  // Marketing domains
  if (MARKETING_SENDER_DOMAINS.some(p => fromEmail.includes(p))) return true;
  // Marketing subjects
  if (MARKETING_SUBJECT_PATTERNS.some(p => subject.includes(p))) return true;
  // Automated platform patterns
  if (AUTOMATED_SUBJECT_PATTERNS.some(p => subject.includes(p) || preview.includes(p))) return true;

  return false;
}

/* ── Project badge color map ── */
const COLOR_CLASSES: Record<string, { bg: string; text: string }> = {
  rose:  { bg: 'bg-fq-rose-light',  text: 'text-fq-rose' },
  sage:  { bg: 'bg-fq-sage-light',  text: 'text-fq-sage' },
  blue:  { bg: 'bg-fq-blue-light',  text: 'text-fq-blue' },
  plum:  { bg: 'bg-fq-plum-light',  text: 'text-fq-plum' },
  amber: { bg: 'bg-fq-amber-light', text: 'text-fq-amber' },
  teal:  { bg: 'bg-fq-teal-light',  text: 'text-fq-teal' },
};
function projectColors(color: string | null) {
  return COLOR_CLASSES[color?.toLowerCase() ?? ''] ?? { bg: 'bg-fq-light-accent', text: 'text-fq-muted' };
}

/* ── Status icon ── */
function StatusIcon({ email }: { email: EmailRow }) {
  if (email.needs_followup) {
    return (
      <span className="text-fq-amber">
        <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 3L2 17h16L10 3z" /><path d="M10 8v4M10 14h.01" />
        </svg>
      </span>
    );
  }
  if (!email.is_read) {
    return (
      <span className="text-fq-sage">
        <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="14" height="12" rx="2" /><path d="M3 7l7 4 7-4" />
        </svg>
      </span>
    );
  }
  return (
    <span className="text-fq-muted/35">
      <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="14" height="12" rx="2" /><path d="M3 7l7 4 7-4" />
      </svg>
    </span>
  );
}

function formatTime(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  return d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
}

function formatDateTime(iso: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-US', {
    month: 'numeric', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

/* ── Triage form state ── */
interface TriageState {
  projectId: string;
  needsFollowup: boolean;
  followupDate: string;
  addVendor: boolean;
  vendorName: string;
  vendorEmail: string;
}

/* ── Main page ── */
export default function InboxPage() {
  const [emails, setEmails] = useState<EmailRow[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [notConnected, setNotConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Draft reply state: email_id → draft text
  const [drafts, setDrafts] = useState<Map<string, string>>(new Map());
  const [draftLoading, setDraftLoading] = useState<string | null>(null);
  const [sendLoading, setSendLoading] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState<string | null>(null);

  // Triage form state
  const [triage, setTriage] = useState<TriageState>({
    projectId: '', needsFollowup: false, followupDate: '',
    addVendor: false, vendorName: '', vendorEmail: '',
  });
  const [triageSaving, setTriageSaving] = useState(false);

  const loadEmails = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/emails');
      const data = await res.json();
      if (data.error === 'NOT_CONNECTED') { setNotConnected(true); return; }
      if (!res.ok) throw new Error(data.error ?? 'Failed to load emails');
      setEmails(data.emails ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      setProjects((data.projects ?? data ?? []).filter((p: Project) =>
        p.status === 'active' || p.status === 'planning'
      ));
    } catch {}
  }, []);

  useEffect(() => { loadEmails(); loadProjects(); }, [loadEmails, loadProjects]);

  const patch = async (id: string, updates: Partial<Pick<EmailRow, 'is_read' | 'needs_followup' | 'project_id'>>) => {
    setEmails(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
    await fetch('/api/emails', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...updates }),
    });
  };

  // Smart-filter then apply tab filter
  const visibleEmails = emails.filter(e => !shouldFilterEmail(e));

  const filtered = visibleEmails.filter(e => {
    if (activeFilter === 'flagged')     return e.needs_followup;
    if (activeFilter === 'draft_ready') return drafts.has(e.id);
    if (activeFilter === 'responded')   return e.is_read && !!e.project_id && !e.needs_followup;
    if (activeFilter === 'dismissed')   return e.is_read && !e.project_id && !e.needs_followup;
    return true; // 'all'
  });

  const countFor = (key: FilterKey) => {
    if (key === 'flagged')     return visibleEmails.filter(e => e.needs_followup).length;
    if (key === 'draft_ready') return drafts.size;
    if (key === 'responded')   return visibleEmails.filter(e => e.is_read && !!e.project_id && !e.needs_followup).length;
    if (key === 'dismissed')   return visibleEmails.filter(e => e.is_read && !e.project_id && !e.needs_followup).length;
    return visibleEmails.length;
  };

  const selected = selectedId ? emails.find(e => e.id === selectedId) ?? null : null;

  // Reset triage form when selection changes
  useEffect(() => {
    if (selected) {
      setTriage({
        projectId: selected.project_id ?? '',
        needsFollowup: selected.needs_followup,
        followupDate: '',
        addVendor: false,
        vendorName: selected.from_name ?? '',
        vendorEmail: selected.from_email ?? '',
      });
    }
  }, [selectedId]);

  /* ── Triage save ── */
  const handleTriage = async () => {
    if (!selected) return;
    setTriageSaving(true);
    try {
      const res = await fetch('/api/emails/triage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email_id: selected.id,
          project_id: triage.projectId || null,
          needs_followup: triage.needsFollowup,
          followup_due_date: triage.followupDate || null,
          add_vendor: triage.addVendor,
          vendor_name: triage.vendorName,
          vendor_email: triage.vendorEmail,
          email_subject: selected.subject,
          from_name: selected.from_name,
        }),
      });
      if (res.ok) {
        const proj = projects.find(p => p.id === triage.projectId) ?? null;
        setEmails(prev => prev.map(e => e.id === selected.id ? {
          ...e,
          project_id: triage.projectId || null,
          needs_followup: triage.needsFollowup,
          projects: proj ? { id: proj.id, name: proj.name, type: proj.type, color: proj.color, event_date: null } : null,
        } : e));
      }
    } finally {
      setTriageSaving(false);
    }
  };

  /* ── Draft reply ── */
  const handleDraftReply = async (emailId: string) => {
    setDraftLoading(emailId);
    try {
      const res = await fetch('/api/emails/draft-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email_id: emailId }),
      });
      const data = await res.json();
      if (data.draft) {
        setDrafts(prev => new Map(prev).set(emailId, data.draft));
      }
    } catch {}
    finally { setDraftLoading(null); }
  };

  /* ── Send reply ── */
  const handleSendReply = async (email: EmailRow) => {
    const draft = drafts.get(email.id);
    if (!draft?.trim()) return;
    setSendLoading(email.id);
    try {
      const res = await fetch('/api/emails/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message_id: email.message_id, reply_text: draft }),
      });
      if (res.ok) {
        setSendSuccess(email.id);
        patch(email.id, { is_read: true });
        setTimeout(() => setSendSuccess(null), 3000);
      }
    } finally { setSendLoading(null); }
  };

  /* ── Not connected ── */
  if (notConnected) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center max-w-sm">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto text-fq-muted/30 mb-4">
            <rect x="6" y="10" width="36" height="28" rx="4" /><path d="M6 16l18 10 18-10" />
          </svg>
          <h2 className={`font-heading text-[20px] font-semibold ${t.heading} mb-2`}>Connect your Outlook</h2>
          <p className={`font-body text-[13px] ${t.light} mb-6`}>Sign in with Microsoft to sync your Outlook inbox.</p>
          <a href="/api/auth/microsoft/login" className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-fq-accent text-white font-body text-[13px] font-medium hover:bg-fq-accent/90 transition-colors">
            Connect Outlook
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      {/* ── Left: Email List ── */}
      <div className={`flex flex-col ${selected ? 'w-[460px] min-w-[460px]' : 'flex-1 max-w-[760px]'} border-r border-fq-border`}>
        {/* Header */}
        <div className="px-8 pt-10 pb-2">
          <h1 className={`font-heading text-[32px] font-semibold ${t.heading}`}>Inbox</h1>
          <p className={`font-body text-[13px] ${t.light} mt-0.5`}>Synced from Outlook</p>
        </div>

        {error && (
          <div className="mx-8 mt-3 px-4 py-3 rounded-lg border border-red-200 bg-red-50">
            <p className="font-body text-[12px] text-red-600">{error}</p>
          </div>
        )}

        {/* Filter tabs */}
        <div className="flex gap-1 px-8 mt-5 mb-3 flex-wrap">
          {FILTERS.map(f => {
            const count = countFor(f.key);
            const isActive = activeFilter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setActiveFilter(f.key)}
                className={`font-body text-[12px] px-3 py-1.5 rounded-full transition-all duration-200 ${
                  isActive
                    ? 'bg-fq-dark text-white font-medium'
                    : 'text-fq-muted hover:text-fq-dark hover:bg-fq-light-accent'
                }`}
              >
                {f.label}
                {count > 0 && (
                  <span className={`ml-1.5 ${isActive ? 'text-white/70' : 'text-fq-muted/50'}`}>{count}</span>
                )}
              </button>
            );
          })}
          <button
            onClick={loadEmails}
            className={`ml-auto p-1.5 rounded-lg hover:bg-fq-light-accent transition-colors ${t.icon} hover:text-fq-dark`}
            title="Refresh"
          >
            <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 10a6 6 0 1 0 1.3-3.8"/><path d="M4 6v4h4"/>
            </svg>
          </button>
        </div>

        {/* Email list */}
        <div className="flex-1 overflow-y-auto px-5 pb-6">
          {loading && (
            <p className={`font-body text-[13px] ${t.light} text-center mt-10`}>Syncing emails…</p>
          )}
          {!loading && filtered.length === 0 && (
            <p className={`font-body text-[13px] ${t.light} text-center mt-10`}>
              {activeFilter === 'draft_ready' ? 'No drafts yet — click "Draft Reply" on any email.' : 'No emails in this category'}
            </p>
          )}
          {filtered.map(email => {
            const isSelected = selectedId === email.id;
            const isUntagged = !email.project_id;
            const hasDraft = drafts.has(email.id);
            const proj = email.projects;
            const { bg, text } = proj ? projectColors(proj.color) : { bg: '', text: '' };

            return (
              <button
                key={email.id}
                onClick={() => {
                  setSelectedId(email.id);
                  if (!email.is_read) patch(email.id, { is_read: true });
                }}
                className={`w-full text-left rounded-xl mb-2 transition-all duration-200 border overflow-hidden ${
                  isSelected
                    ? 'bg-fq-light-accent border-fq-accent/30 shadow-sm'
                    : 'bg-fq-card border-fq-border hover:border-fq-accent/20 hover:shadow-sm'
                }`}
              >
                <div className="flex">
                  {/* Amber left border stripe for untagged emails */}
                  {isUntagged && (
                    <div className="w-[3px] shrink-0 bg-fq-amber/60 rounded-l-xl" />
                  )}
                  <div className="flex-1 px-5 py-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 shrink-0"><StatusIcon email={email} /></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`font-body text-[14px] font-semibold ${t.heading} truncate`}>
                            {email.from_name || email.from_email || 'Unknown'}
                          </span>
                          <span className={`font-body text-[11px] ${t.light} shrink-0`}>
                            {formatTime(email.received_at)}
                          </span>
                        </div>
                        <p className={`font-body text-[13px] ${t.heading} font-medium mt-0.5 truncate`}>
                          {email.subject || '(no subject)'}
                        </p>
                        <p className={`font-body text-[11px] ${t.light} mt-0.5 truncate`}>
                          {email.body_preview}
                        </p>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          {/* Project badge */}
                          {proj ? (
                            <span className={`font-body text-[11px] font-medium px-2 py-0.5 rounded-full ${bg} ${text}`}>
                              {proj.name}
                            </span>
                          ) : (
                            <span className="font-body text-[11px] font-medium px-2 py-0.5 rounded-full bg-fq-amber-light text-fq-amber">
                              Untagged
                            </span>
                          )}
                          {/* Status badges */}
                          {email.needs_followup && (
                            <span className="font-body text-[11px] font-medium px-2 py-0.5 rounded-full bg-fq-amber-light text-fq-amber">
                              Follow-up
                            </span>
                          )}
                          {hasDraft && (
                            <span className="font-body text-[11px] font-medium px-2 py-0.5 rounded-full bg-fq-blue-light text-fq-blue">
                              Draft Ready
                            </span>
                          )}
                          {email.is_meeting_summary && (
                            <span className="font-body text-[11px] font-medium px-2 py-0.5 rounded-full bg-fq-teal-light text-fq-teal">
                              Meeting Summary
                            </span>
                          )}
                        </div>
                      </div>
                      <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={`mt-3 shrink-0 ${t.icon}`}>
                        <path d="M5 3l4 4-4 4" />
                      </svg>
                    </div>
                  </div>
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
          <div className="flex items-center justify-between px-8 pt-7 pb-4 border-b border-fq-border bg-fq-card">
            <div className="flex items-center gap-3">
              <h2 className={`font-heading text-[20px] font-semibold ${t.heading}`}>
                {selected.subject || '(no subject)'}
              </h2>
            </div>
            <button
              onClick={() => setSelectedId(null)}
              className={`p-1.5 rounded-lg hover:bg-fq-light-accent transition-colors ${t.icon}`}
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M5 5l10 10M15 5L5 15" />
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-8 py-6 space-y-5">
            {/* Meta */}
            <div className={`font-body text-[13px] ${t.body} space-y-0.5`}>
              <p>
                <span className={t.light}>From </span>
                <span className="font-medium text-fq-dark/80">{selected.from_name}</span>
                {selected.from_email && <span className={t.light}> &lt;{selected.from_email}&gt;</span>}
              </p>
              <p><span className={t.light}>Received </span>{formatDateTime(selected.received_at)}</p>
              {selected.projects && (
                <p>
                  <span className={t.light}>Project </span>
                  <span className={`font-medium px-2 py-0.5 rounded-full text-[11px] ${projectColors(selected.projects.color).bg} ${projectColors(selected.projects.color).text}`}>
                    {selected.projects.name}
                  </span>
                  {selected.match_confidence && (
                    <span className={`ml-2 text-[11px] px-1.5 py-0.5 rounded-full ${
                      selected.match_confidence === 'exact' ? 'bg-fq-sage-light text-fq-sage' :
                      selected.match_confidence === 'high' ? 'bg-fq-blue-light text-fq-blue' :
                      'bg-fq-light-accent text-fq-muted'
                    }`}>{selected.match_confidence}</span>
                  )}
                </p>
              )}
            </div>

            {/* Email body */}
            <div>
              <div className="bg-fq-card border border-fq-border rounded-xl px-5 py-4">
                <p className={`font-body text-[13px] ${t.body} leading-relaxed whitespace-pre-line`}>
                  {selected.body || selected.body_preview || '(no content)'}
                </p>
              </div>
            </div>

            {/* ── Inline triage panel (untagged emails) ── */}
            {!selected.project_id && (
              <div className="border border-fq-amber/20 bg-fq-amber-light/30 rounded-xl px-5 py-4">
                <h4 className={`font-heading text-[14px] font-semibold ${t.heading} mb-3`}>
                  Triage this email
                </h4>
                <div className="space-y-3">
                  {/* Project select */}
                  <div>
                    <label className={`font-body text-[12px] ${t.light} block mb-1`}>Assign to project</label>
                    <select
                      value={triage.projectId}
                      onChange={e => setTriage(s => ({ ...s, projectId: e.target.value }))}
                      className={`w-full font-body text-[13px] ${t.body} bg-fq-card border border-fq-border rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-fq-accent/40`}
                    >
                      <option value="">— None / General —</option>
                      {projects.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Follow-up toggle */}
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setTriage(s => ({ ...s, needsFollowup: !s.needsFollowup }))}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border font-body text-[12px] font-medium transition-colors ${
                        triage.needsFollowup
                          ? 'border-fq-amber/30 bg-fq-amber-light text-fq-amber'
                          : 'border-fq-border bg-fq-card text-fq-dark/70 hover:bg-fq-light-accent'
                      }`}
                    >
                      <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M10 3L2 17h16L10 3z" />
                      </svg>
                      Flag follow-up
                    </button>
                    {triage.needsFollowup && (
                      <input
                        type="date"
                        value={triage.followupDate}
                        onChange={e => setTriage(s => ({ ...s, followupDate: e.target.value }))}
                        className={`font-body text-[12px] ${t.body} bg-fq-card border border-fq-border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-fq-accent/40`}
                      />
                    )}
                  </div>

                  {/* Add vendor */}
                  <div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={triage.addVendor}
                        onChange={e => setTriage(s => ({ ...s, addVendor: e.target.checked }))}
                        className="rounded border-fq-border text-fq-accent focus:ring-fq-accent/40"
                      />
                      <span className={`font-body text-[12px] ${t.light}`}>Add sender to vendor directory</span>
                    </label>
                    {triage.addVendor && (
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <input
                          value={triage.vendorName}
                          onChange={e => setTriage(s => ({ ...s, vendorName: e.target.value }))}
                          placeholder="Vendor name"
                          className={`font-body text-[12px] ${t.body} bg-fq-card border border-fq-border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-fq-accent/40`}
                        />
                        <input
                          value={triage.vendorEmail}
                          onChange={e => setTriage(s => ({ ...s, vendorEmail: e.target.value }))}
                          placeholder="Vendor email"
                          className={`font-body text-[12px] ${t.body} bg-fq-card border border-fq-border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-fq-accent/40`}
                        />
                      </div>
                    )}
                  </div>

                  <button
                    onClick={handleTriage}
                    disabled={triageSaving}
                    className="px-4 py-2 rounded-lg bg-fq-dark text-white font-body text-[12px] font-medium hover:bg-fq-dark/90 transition-colors disabled:opacity-50"
                  >
                    {triageSaving ? 'Saving…' : 'Save Triage'}
                  </button>
                </div>
              </div>
            )}

            {/* ── Draft reply area ── */}
            {drafts.has(selected.id) && (
              <div>
                <h4 className={`font-heading text-[14px] font-semibold ${t.heading} mb-2`}>Draft Reply</h4>
                <textarea
                  value={drafts.get(selected.id) ?? ''}
                  onChange={e => setDrafts(prev => new Map(prev).set(selected.id, e.target.value))}
                  rows={10}
                  className={`w-full font-body text-[13px] ${t.body} bg-fq-card border border-fq-border rounded-xl px-4 py-3 focus:outline-none focus:ring-1 focus:ring-fq-accent/40 resize-none leading-relaxed`}
                />
                {sendSuccess === selected.id && (
                  <p className="font-body text-[12px] text-fq-sage mt-1.5">Reply sent successfully.</p>
                )}
              </div>
            )}
          </div>

          {/* Action bar */}
          <div className="px-8 py-4 border-t border-fq-border bg-fq-card flex items-center gap-2 flex-wrap">
            {/* Follow-up toggle */}
            <button
              onClick={() => patch(selected.id, { needs_followup: !selected.needs_followup })}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg border font-body text-[12px] font-medium transition-colors ${
                selected.needs_followup
                  ? 'border-fq-amber/30 bg-fq-amber-light text-fq-amber'
                  : 'border-fq-border bg-fq-card text-fq-dark/80 hover:bg-fq-light-accent'
              }`}
            >
              <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 3L2 17h16L10 3z" /><path d="M10 8v4M10 14h.01" />
              </svg>
              {selected.needs_followup ? 'Remove Flag' : 'Flag Follow-up'}
            </button>

            {/* Mark read */}
            {!selected.is_read && (
              <button
                onClick={() => patch(selected.id, { is_read: true })}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-fq-sage/30 bg-fq-sage-light/30 font-body text-[12px] font-medium text-fq-sage hover:bg-fq-sage-light/60 transition-colors"
              >
                <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 10l3 3 7-7" />
                </svg>
                Mark Read
              </button>
            )}

            {/* Draft Reply button */}
            <button
              onClick={() => handleDraftReply(selected.id)}
              disabled={draftLoading === selected.id}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-fq-blue/30 bg-fq-blue-light/50 font-body text-[12px] font-medium text-fq-blue hover:bg-fq-blue-light transition-colors disabled:opacity-50"
            >
              {draftLoading === selected.id ? (
                <>
                  <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                    <path d="M10 3a7 7 0 0 1 7 7" />
                  </svg>
                  Drafting…
                </>
              ) : (
                <>
                  <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 15l4-4 4 4 6-8" /><path d="M17 3l-6 8" />
                  </svg>
                  {drafts.has(selected.id) ? 'Regenerate Draft' : 'Draft Reply'}
                </>
              )}
            </button>

            {/* Send Reply (only when draft exists) */}
            {drafts.has(selected.id) && (
              <button
                onClick={() => handleSendReply(selected)}
                disabled={sendLoading === selected.id}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-fq-accent text-white font-body text-[12px] font-medium hover:bg-fq-accent/90 transition-colors disabled:opacity-50 ml-auto"
              >
                {sendLoading === selected.id ? 'Sending…' : (
                  <>
                    <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 10l14-7-7 14V10H3z" />
                    </svg>
                    Send Reply
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-fq-bg">
          <div className="text-center">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto text-fq-muted/25 mb-4">
              <rect x="6" y="10" width="36" height="28" rx="4" /><path d="M6 16l18 10 18-10" />
            </svg>
            <p className={`font-body text-[14px] ${t.light}`}>Select an email to view details</p>
          </div>
        </div>
      )}
    </div>
  );
}
