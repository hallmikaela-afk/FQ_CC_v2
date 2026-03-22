'use client';

import { useState, useEffect, useCallback } from 'react';

/* ── colour / typography tokens (matches rest of app) ── */
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

type FilterKey = 'all' | 'unread' | 'followup' | 'read';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all',     label: 'All' },
  { key: 'unread',  label: 'Unread' },
  { key: 'followup',label: 'Needs Follow-up' },
  { key: 'read',    label: 'Read' },
];

/* ── Status badge ── */
function StatusBadge({ email }: { email: EmailRow }) {
  if (email.needs_followup) {
    return <span className="text-[11px] font-body font-medium px-2 py-0.5 rounded-full bg-fq-amber-light text-fq-amber">Follow-up</span>;
  }
  if (!email.is_read) {
    return <span className="text-[11px] font-body font-medium px-2 py-0.5 rounded-full bg-fq-sage-light text-fq-sage">Unread</span>;
  }
  return <span className="text-[11px] font-body font-medium px-2 py-0.5 rounded-full bg-fq-light-accent text-fq-muted">Read</span>;
}

/* ── Status icon ── */
function StatusIcon({ email }: { email: EmailRow }) {
  if (email.needs_followup) {
    return (
      <span className="text-fq-amber">
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 3L2 17h16L10 3z" /><path d="M10 8v4M10 14h.01" />
        </svg>
      </span>
    );
  }
  if (!email.is_read) {
    return (
      <span className="text-fq-sage">
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="14" height="12" rx="2" /><path d="M3 7l7 4 7-4" />
        </svg>
      </span>
    );
  }
  return (
    <span className="text-fq-muted/40">
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
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

/* ── Main page ── */
export default function InboxPage() {
  const [emails, setEmails] = useState<EmailRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notConnected, setNotConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const loadEmails = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/emails');
      const data = await res.json();
      if (data.error === 'NOT_CONNECTED') {
        setNotConnected(true);
        return;
      }
      if (!res.ok) throw new Error(data.error ?? 'Failed to load emails');
      setEmails(data.emails ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadEmails(); }, [loadEmails]);

  const patch = async (id: string, updates: Partial<Pick<EmailRow, 'is_read' | 'needs_followup' | 'project_id'>>) => {
    setEmails(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
    await fetch('/api/emails', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...updates }),
    });
  };

  const filtered = emails.filter(e => {
    if (activeFilter === 'unread') return !e.is_read;
    if (activeFilter === 'followup') return e.needs_followup;
    if (activeFilter === 'read') return e.is_read;
    return true;
  });

  const countFor = (key: FilterKey) => {
    if (key === 'all') return emails.length;
    if (key === 'unread') return emails.filter(e => !e.is_read).length;
    if (key === 'followup') return emails.filter(e => e.needs_followup).length;
    if (key === 'read') return emails.filter(e => e.is_read).length;
    return 0;
  };

  const selected = selectedId ? emails.find(e => e.id === selectedId) ?? null : null;

  /* ── Not connected state ── */
  if (notConnected) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center max-w-sm">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto text-fq-muted/30 mb-4">
            <rect x="6" y="10" width="36" height="28" rx="4" /><path d="M6 16l18 10 18-10" />
          </svg>
          <h2 className={`font-heading text-[20px] font-semibold ${t.heading} mb-2`}>Connect your Outlook</h2>
          <p className={`font-body text-[13px] ${t.light} mb-6`}>Sign in with Microsoft to sync your Outlook inbox.</p>
          <a
            href="/api/auth/microsoft/login"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-fq-accent text-white font-body text-[13px] font-medium hover:bg-fq-accent/90 transition-colors"
          >
            Connect Outlook
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      {/* ── Left: Email List ── */}
      <div className={`flex flex-col ${selected ? 'w-[480px] min-w-[480px]' : 'flex-1 max-w-[780px]'} border-r border-fq-border`}>
        {/* Header */}
        <div className="px-8 pt-10 pb-2">
          <h1 className={`font-heading text-[32px] font-semibold ${t.heading}`}>Inbox</h1>
          <p className={`font-body text-[14px] ${t.light} mt-0.5`}>Synced from Outlook</p>
        </div>

        {/* Error / loading banner */}
        {error && (
          <div className="mx-8 mt-4 px-4 py-3 rounded-lg border border-red-200 bg-red-50">
            <p className="font-body text-[12px] text-red-600">{error}</p>
          </div>
        )}

        {/* Filter tabs */}
        <div className="flex gap-1 px-8 mt-5 mb-4">
          {FILTERS.map(f => {
            const count = countFor(f.key);
            const isActive = activeFilter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setActiveFilter(f.key)}
                className={`font-body text-[13px] px-3 py-1.5 rounded-full transition-all duration-200 ${
                  isActive
                    ? 'bg-fq-dark text-white font-medium'
                    : 'text-fq-muted hover:text-fq-dark hover:bg-fq-light-accent'
                }`}
              >
                {f.label}
                <span className={`ml-1.5 ${isActive ? 'text-white/70' : 'text-fq-muted/50'}`}>{count}</span>
              </button>
            );
          })}
          <button
            onClick={loadEmails}
            className="ml-auto text-fq-muted/60 hover:text-fq-dark transition-colors p-1.5 rounded-lg hover:bg-fq-light-accent"
            title="Refresh"
          >
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
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
            <p className={`font-body text-[13px] ${t.light} text-center mt-10`}>No emails in this category</p>
          )}
          {filtered.map(email => {
            const isSelected = selectedId === email.id;
            return (
              <button
                key={email.id}
                onClick={() => {
                  setSelectedId(email.id);
                  if (!email.is_read) patch(email.id, { is_read: true });
                }}
                className={`w-full text-left px-5 py-4 rounded-xl mb-2 transition-all duration-200 border ${
                  isSelected
                    ? 'bg-fq-light-accent border-fq-accent/30 shadow-sm'
                    : 'bg-fq-card border-fq-border hover:border-fq-accent/20 hover:shadow-sm'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5"><StatusIcon email={email} /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`font-body text-[14px] font-semibold ${t.heading} truncate`}>
                        {email.from_name || email.from_email || 'Unknown'}
                      </span>
                      <span className={`font-body text-[12px] ${t.light} shrink-0`}>
                        {formatTime(email.received_at)}
                      </span>
                    </div>
                    <p className={`font-body text-[13px] ${t.heading} font-medium mt-0.5 truncate`}>
                      {email.subject || '(no subject)'}
                    </p>
                    <p className={`font-body text-[12px] ${t.light} mt-0.5 truncate`}>
                      {email.body_preview}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <StatusBadge email={email} />
                      {email.projects && (
                        <span className={`font-body text-[11px] ${t.light}`}>{email.projects.name}</span>
                      )}
                    </div>
                  </div>
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
            <h2 className={`font-heading text-[22px] font-semibold ${t.heading}`}>Email Details</h2>
            <button
              onClick={() => setSelectedId(null)}
              className={`p-1 rounded-lg hover:bg-fq-light-accent transition-colors ${t.icon}`}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <circle cx="10" cy="10" r="7" /><path d="M7.5 7.5l5 5M12.5 7.5l-5 5" />
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-8 py-6 space-y-5">
            {/* Subject + meta */}
            <div>
              <h3 className={`font-heading text-[20px] font-semibold ${t.heading} leading-tight`}>
                {selected.subject || '(no subject)'}
              </h3>
              <div className={`font-body text-[13px] ${t.body} mt-2 space-y-0.5`}>
                <p>From: <span className="font-medium text-fq-dark/80">{selected.from_name}</span> &lt;{selected.from_email}&gt;</p>
                <p>Received: {formatDateTime(selected.received_at)}</p>
                {selected.projects && (
                  <p>Project: <span className="font-medium text-fq-dark/80">{selected.projects.name}</span>
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
            </div>

            {/* Email body */}
            <div>
              <h4 className={`font-heading text-[15px] font-semibold ${t.heading} mb-2`}>Message</h4>
              <div className="bg-fq-card border border-fq-border rounded-xl px-5 py-4">
                <p className={`font-body text-[13px] ${t.body} leading-relaxed whitespace-pre-line`}>
                  {selected.body || selected.body_preview || '(no content)'}
                </p>
              </div>
            </div>
          </div>

          {/* Action bar */}
          <div className="px-8 py-4 border-t border-fq-border bg-fq-card flex items-center gap-3">
            <button
              onClick={() => patch(selected.id, { needs_followup: !selected.needs_followup })}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg border font-body text-[13px] font-medium transition-colors ${
                selected.needs_followup
                  ? 'border-fq-amber/30 bg-fq-amber-light text-fq-amber'
                  : 'border-fq-border bg-fq-card text-fq-dark/80 hover:bg-fq-light-accent'
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 3L2 17h16L10 3z" /><path d="M10 8v4M10 14h.01" />
              </svg>
              {selected.needs_followup ? 'Remove Follow-up' : 'Flag Follow-up'}
            </button>
            {!selected.is_read && (
              <button
                onClick={() => patch(selected.id, { is_read: true })}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-fq-sage/30 bg-fq-sage-light/30 font-body text-[13px] font-medium text-fq-sage hover:bg-fq-sage-light/60 transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 10l3 3 7-7" />
                </svg>
                Mark Read
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-fq-bg">
          <div className="text-center">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto text-fq-muted/30 mb-4">
              <rect x="6" y="10" width="36" height="28" rx="4" /><path d="M6 16l18 10 18-10" />
            </svg>
            <p className={`font-body text-[14px] ${t.light}`}>Select an email to view details</p>
          </div>
        </div>
      )}
    </div>
  );
}
