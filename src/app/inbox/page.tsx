'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Search, X, Mail } from 'lucide-react';
import FolderSidebar, { type Folder } from '@/components/inbox/FolderSidebar';
import EmailCard, { type Email, type Project } from '@/components/inbox/EmailCard';
import EmailDetail from '@/components/inbox/EmailDetail';
import ComposePanel from '@/components/inbox/ComposePanel';

/* ── Filter types ── */
type TabFilter = 'all' | 'active' | 'needs_response' | 'draft_ready' | 'followup' | 'resolved' | 'untagged';

const TAB_FILTERS: { key: TabFilter; label: string }[] = [
  { key: 'all',            label: 'All' },
  { key: 'active',         label: 'Active' },
  { key: 'needs_response', label: 'Needs Response' },
  { key: 'draft_ready',    label: 'Draft Ready' },
  { key: 'followup',       label: 'Needs Follow-up' },
  { key: 'resolved',       label: 'Resolved' },
  // 'untagged' is appended dynamically only when its count > 0
];

/* ── Inbox rules ── */
interface InboxRule {
  id: string;
  rule_type: 'sender' | 'domain';
  value: string;
  action: 'hide';
}

/* ── Design tokens ── */
const tk = {
  heading: 'text-fq-dark/90',
  body:    'text-fq-muted/85',
  light:   'text-fq-muted/65',
  icon:    'text-fq-muted/55',
};

/* ─────────────────────────────────────────────────────────────────────────────
   Smart email filtering — runs client-side, never hides project-matched emails
───────────────────────────────────────────────────────────────────────────── */
const NO_REPLY_PATTERNS = [
  'no-reply@', 'noreply@', 'no_reply@', 'donotreply@', 'do-not-reply@',
  'notifications@canva.com', 'mail@canva.com', 'design@canva.com',
  'noreply@adobe.com', 'echosign@echosign.com',
  'drive-shares-noreply@google.com', 'comments-noreply@docs.google.com',
  'no-reply@dropbox.com', 'noreply@dropbox.com',
  'calendar-notification@google.com', 'calendar-server@google.com',
];

const MARKETING_SUBJECT_PATTERNS = [
  'unsubscribe', 'newsletter', 'promotional', 'special offer', 'limited time',
  'sale ends', 'discount', 'coupon', '% off', 'free trial', 'upgrade your plan',
  'monthly digest', 'weekly digest', 'weekly newsletter',
  'confirm your email', 'verify your email address',
];

const MARKETING_SENDER_DOMAINS = [
  '@mailchimp.com', '@sendgrid.net', '@klaviyo.com', '@constantcontact.com',
  '@campaignmonitor.com', '@hubspot.com', '@marketo.com',
];

const AUTOMATED_SUBJECT_PATTERNS = [
  'meeting invitation', 'calendar invitation', 'zoom meeting invitation',
  'accepted your invitation', 'declined your invitation', 'tentatively accepted',
  'your receipt from', 'your invoice from', 'payment confirmation',
  'order confirmation', 'booking confirmation', 'reservation confirmation',
  'shared a design with you', 'has shared a file', 'shared an item with you',
  'has sent you a document', 'document waiting for your signature',
];

function shouldFilterEmail(email: Email, rules: InboxRule[]): boolean {
  // Never filter matched project emails (client/vendor)
  if (email.project_id) return false;
  // Never filter Zoom AI Companion meeting summaries
  if (email.is_meeting_summary) return false;

  const fromEmail = (email.from_email ?? '').toLowerCase();
  const domain    = fromEmail.split('@')[1] ?? '';
  const subject   = (email.subject ?? '').toLowerCase();
  const preview   = (email.body_preview ?? '').toLowerCase();

  // User-defined inbox rules (highest priority)
  for (const rule of rules) {
    if (rule.action !== 'hide') continue;
    if (rule.rule_type === 'sender' && fromEmail === rule.value.toLowerCase()) return true;
    if (rule.rule_type === 'domain' && domain === rule.value.toLowerCase()) return true;
  }

  if (NO_REPLY_PATTERNS.some((p) => fromEmail.includes(p))) return true;
  if (MARKETING_SENDER_DOMAINS.some((p) => fromEmail.includes(p))) return true;
  if (MARKETING_SUBJECT_PATTERNS.some((p) => subject.includes(p))) return true;
  if (AUTOMATED_SUBJECT_PATTERNS.some((p) => subject.includes(p) || preview.includes(p))) return true;

  return false;
}

/* ── Relative timestamp ── */
function relativeTime(date: Date | null): string {
  if (!date) return '';
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 60)   return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

/* ─────────────────────────────────────────────────────────────────────────────
   Page
───────────────────────────────────────────────────────────────────────────── */
export default function InboxPage() {
  /* ── Data state ── */
  const [emails,    setEmails]    = useState<Email[]>([]);
  const [folders,   setFolders]   = useState<Folder[]>([]);
  const [projects,  setProjects]  = useState<Project[]>([]);
  const [rules,     setRules]     = useState<InboxRule[]>([]);

  /* ── UI state ── */
  const [loading,      setLoading]      = useState(true);
  const [syncing,      setSyncing]      = useState(false); // background refresh indicator
  const [notConnected, setNotConnected] = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [syncedAt,     setSyncedAt]     = useState<Date | null>(null);
  const [nowTick,      setNowTick]      = useState(0); // increments every minute to trigger re-render

  /* ── Filter/nav state ── */
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [tabFilter,      setTabFilter]      = useState<TabFilter>('all');
  const [projectFilter,  setProjectFilter]  = useState('');
  const [selectedId,     setSelectedId]     = useState<string | null>(null);

  /* ── Search state ── */
  const [searchQuery,        setSearchQuery]        = useState('');
  const [searchResults,      setSearchResults]      = useState<Email[] | null>(null);
  const [searchLoading,      setSearchLoading]      = useState(false);
  const [searchedGraph,      setSearchedGraph]      = useState(false);
  const searchDebounceRef    = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Compose state ── */
  const [composeOpen, setComposeOpen] = useState(false);

  /* ── Undo toast ── */
  const [undoToast, setUndoToast] = useState<{ message: string; undo: () => void } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── "now" tick — updates relative "synced X ago" label every minute ── */
  useEffect(() => {
    const id = setInterval(() => setNowTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  /* ─── Data loaders ────────────────────────────────────────────────────── */

  const loadEmails = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true); else setSyncing(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (selectedFolder) params.set('folder_id', selectedFolder);
      const res  = await fetch(`/api/emails?${params}`);
      const data = await res.json();
      if (data.error === 'NOT_CONNECTED') { setNotConnected(true); return; }
      if (!res.ok) throw new Error(data.error ?? 'Failed to load emails');
      setEmails(data.emails ?? []);
      setSyncedAt(new Date());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  }, [selectedFolder]);

  const loadFolders = useCallback(async () => {
    try {
      const res  = await fetch('/api/emails/folders');
      const data = await res.json();
      if (!data.error) setFolders(data.folders ?? []);
    } catch {}
  }, []);

  const loadProjects = useCallback(async () => {
    try {
      const res  = await fetch('/api/projects');
      const data = await res.json();
      const list: Project[] = data.projects ?? data ?? [];
      setProjects(list.filter((p) => ['active', 'planning'].includes(p.status)));
    } catch {}
  }, []);

  const loadRules = useCallback(async () => {
    try {
      const res  = await fetch('/api/inbox-rules');
      const data = await res.json();
      setRules(data.rules ?? []);
    } catch {}
  }, []);

  /* ── Initial load ── */
  useEffect(() => {
    loadEmails(true);
    loadFolders();
    loadProjects();
    loadRules();
  }, [loadEmails, loadFolders, loadProjects, loadRules]);

  /* ── Auto-refresh every 5 min using Page Visibility API ── */
  const loadEmailsRef = useRef(loadEmails);
  useEffect(() => { loadEmailsRef.current = loadEmails; }, [loadEmails]);

  useEffect(() => {
    const FIVE_MIN = 5 * 60_000;
    let timerId: ReturnType<typeof setInterval>;

    const tick = () => {
      if (!document.hidden) loadEmailsRef.current(false);
    };

    const onVisibility = () => {
      if (!document.hidden) {
        // Tab became active — refresh immediately, restart timer
        loadEmailsRef.current(false);
        clearInterval(timerId);
        timerId = setInterval(tick, FIVE_MIN);
      } else {
        clearInterval(timerId);
      }
    };

    timerId = setInterval(tick, FIVE_MIN);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(timerId);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []); // runs once; uses ref for fresh loadEmails

  /* ── Reload emails when folder changes ── */
  useEffect(() => {
    if (!loading) loadEmails(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFolder]);

  /* ── Debounced search ── */
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (!searchQuery.trim()) {
      setSearchResults(null);
      setSearchLoading(false);
      setSearchedGraph(false);
      return;
    }
    setSearchLoading(true);
    setSearchedGraph(false);
    searchDebounceRef.current = setTimeout(async () => {
      try {
        const res  = await fetch(`/api/emails/search?q=${encodeURIComponent(searchQuery)}`);
        const data = await res.json();
        setSearchResults(data.emails ?? []);
        setSearchedGraph(data.searchedGraph ?? false);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchQuery]);

  /* ── Derived email list ── */
  // Dismissed emails are already excluded by the API; shouldFilterEmail is a client-side safety net
  const visibleEmails = useMemo(
    () => emails.filter((e) => !shouldFilterEmail(e, rules)),
    [emails, rules],
  );

  const filteredEmails = useMemo(() => {
    const byTab = visibleEmails.filter((e) => {
      switch (tabFilter) {
        case 'all':
          return !!e.project_id && !e.dismissed;
        case 'active':
          return !!e.project_id && !e.resolved;
        case 'needs_response':
          return !!e.project_id && !!e.needs_response && !e.resolved;
        case 'draft_ready':
          return !!e.project_id && !!e.draft_message_id && !e.resolved;
        case 'followup':
          return !!e.project_id && e.needs_followup && !e.resolved;
        case 'resolved':
          return !!e.project_id && e.resolved;
        case 'untagged':
          return !e.project_id && !e.dismissed;
        default:
          return false;
      }
    }).filter((e) => tabFilter === 'untagged' || !projectFilter || e.project_id === projectFilter);

    if (tabFilter === 'all' || tabFilter === 'untagged') {
      return [...byTab].sort((a, b) =>
        (b.received_at ?? '').localeCompare(a.received_at ?? ''),
      );
    }
    return byTab;
  }, [visibleEmails, tabFilter, projectFilter]);

  const countFor = useCallback(
    (tab: TabFilter) => {
      switch (tab) {
        case 'all':
          return visibleEmails.filter((e) => !!e.project_id && !e.dismissed).length;
        case 'active':
          return visibleEmails.filter((e) => !!e.project_id && !e.resolved).length;
        case 'needs_response':
          return visibleEmails.filter((e) => !!e.project_id && !!e.needs_response && !e.resolved).length;
        case 'draft_ready':
          return visibleEmails.filter((e) => !!e.project_id && !!e.draft_message_id && !e.resolved).length;
        case 'followup':
          return visibleEmails.filter((e) => !!e.project_id && e.needs_followup && !e.resolved).length;
        case 'resolved':
          return visibleEmails.filter((e) => !!e.project_id && e.resolved).length;
        case 'untagged':
          return visibleEmails.filter((e) => !e.project_id && !e.dismissed).length;
        default:
          return 0;
      }
    },
    [visibleEmails],
  );

  const untaggedCount = useMemo(
    () => visibleEmails.filter((e) => !e.project_id && !e.dismissed).length,
    [visibleEmails],
  );

  const totalUnread = visibleEmails.filter((e) => !e.is_read && !!e.project_id && !e.resolved).length;
  const selected    = selectedId ? emails.find((e) => e.id === selectedId) ?? null : null;

  /* ── Email actions ── */
  const patch = useCallback(async (id: string, updates: Record<string, unknown>) => {
    // Optimistic update
    setEmails((prev) => prev.map((e) => {
      if (e.id !== id) return e;
      const merged = { ...e, ...updates };
      // If project_id was cleared, also clear projects join
      if ('project_id' in updates && !updates.project_id) merged.projects = null;
      return merged;
    }));
    await fetch('/api/emails', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...updates }),
    });
  }, []);

  const handleSelectEmail = (email: Email) => {
    setSelectedId(email.id);
    if (!email.is_read) patch(email.id, { is_read: true });
  };

  const handleConfirmSuggested = (email: Email) => {
    patch(email.id, { match_confidence: 'exact' });
  };

  const handleDismissSuggested = (email: Email) => {
    // No project → auto-dismiss completely from main view
    patch(email.id, { project_id: null, match_confidence: null, dismissed: true });
  };

  const showToast = useCallback((message: string, undo: () => void) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setUndoToast({ message, undo });
    toastTimerRef.current = setTimeout(() => setUndoToast(null), 5000);
  }, []);

  const handleResolve = useCallback(
    (email: Email) => {
      patch(email.id, { resolved: true, needs_followup: false, needs_response: false });
      showToast('Marked as resolved', () =>
        patch(email.id, {
          resolved:        false,
          needs_followup:  email.needs_followup,
          needs_response:  email.needs_response,
        }),
      );
    },
    [patch, showToast],
  );

  const handleToggleFollowup = (email: Email) => {
    // Turning on follow-up clears needs_response (mutually exclusive)
    if (!email.needs_followup) {
      patch(email.id, { needs_followup: true, needs_response: false });
    } else {
      patch(email.id, { needs_followup: false });
    }
  };

  const handleNeedsResponse = useCallback(
    (email: Email) => {
      // Turning on needs_response clears needs_followup (mutually exclusive)
      if (!email.needs_response) {
        patch(email.id, { needs_response: true, needs_followup: false });
      } else {
        patch(email.id, { needs_response: false });
      }
    },
    [patch],
  );

  const handleDraftResponse = useCallback(
    async (email: Email) => {
      const res  = await fetch('/api/emails/quick-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email_id: email.id }),
      });
      const data = await res.json();
      if (data.draft_message_id) {
        patch(email.id, { draft_message_id: data.draft_message_id });
      }
    },
    [patch],
  );

  const handleDismiss = useCallback(
    (email: Email) => {
      patch(email.id, { dismissed: true });
      showToast('Email dismissed', () => patch(email.id, { dismissed: false }));
    },
    [patch, showToast],
  );

  const handleReply = useCallback(
    (email: Email) => {
      handleSelectEmail(email);
    },
    [handleSelectEmail],
  );

  const handleReassign = useCallback(
    async (email: Email, projectId: string | null) => {
      // Optimistic update
      const targetProject = projectId ? projects.find((p) => p.id === projectId) ?? null : null;
      setEmails((prev) =>
        prev.map((e) => {
          if (e.id !== email.id) return e;
          return {
            ...e,
            project_id:       projectId,
            match_confidence: projectId ? 'exact' : null,
            dismissed:        false,
            projects: targetProject
              ? { id: targetProject.id, name: targetProject.name, type: targetProject.type, color: targetProject.color, event_date: null }
              : null,
          };
        }),
      );
      await fetch('/api/emails/reassign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email_id: email.id, project_id: projectId }),
      });
    },
    [projects],
  );

  const handleTriageSave = async (opts: {
    emailId: string;
    projectId: string | null;
    needsFollowup: boolean;
    followupDate: string | null;
    addVendor: boolean;
    vendorName: string;
    vendorEmail: string;
  }) => {
    const res = await fetch('/api/emails/triage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email_id:        opts.emailId,
        project_id:      opts.projectId,
        needs_followup:  opts.needsFollowup,
        followup_due_date: opts.followupDate,
        add_vendor:      opts.addVendor,
        vendor_name:     opts.vendorName,
        vendor_email:    opts.vendorEmail,
        email_subject:   selected?.subject,
        from_name:       selected?.from_name,
      }),
    });
    if (res.ok) {
      const proj = projects.find((p) => p.id === opts.projectId) ?? null;
      setEmails((prev) => prev.map((e) => {
        if (e.id !== opts.emailId) return e;
        return {
          ...e,
          project_id:       opts.projectId,
          match_confidence: opts.projectId ? 'exact' : null,
          needs_followup:   opts.needsFollowup,
          projects: proj
            ? { id: proj.id, name: proj.name, type: proj.type, color: proj.color, event_date: null }
            : null,
        };
      }));
    }
  };

  /* ── Not connected screen ── */
  if (notConnected) {
    return (
      <div className="flex h-screen items-center justify-center bg-fq-bg">
        <div className="text-center max-w-[340px] px-6">
          <div className="w-16 h-16 rounded-2xl bg-fq-light-accent flex items-center justify-center mx-auto mb-5">
            <svg width="26" height="26" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className="text-fq-accent">
              <rect x="6" y="10" width="36" height="28" rx="4" />
              <path d="M6 16l18 10 18-10" />
            </svg>
          </div>
          <h2 className={`font-heading text-[22px] font-semibold ${tk.heading} mb-2`}>
            Connect your Outlook
          </h2>
          <p className={`font-body text-[13.5px] ${tk.light} mb-7 leading-relaxed`}>
            Sign in with Microsoft to sync your inbox and start triaging emails here.
          </p>
          <a
            href="/api/auth/microsoft/login"
            className="inline-flex items-center gap-2.5 px-7 py-3 rounded-xl bg-fq-accent text-white font-body text-[14px] font-medium hover:bg-fq-accent/90 transition-colors shadow-sm"
          >
            {/* Microsoft logo squares */}
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
              <rect x="1"  y="1"  width="8" height="8" fill="#F25022" rx="0.5" />
              <rect x="11" y="1"  width="8" height="8" fill="#7FBA00" rx="0.5" />
              <rect x="1"  y="11" width="8" height="8" fill="#00A4EF" rx="0.5" />
              <rect x="11" y="11" width="8" height="8" fill="#FFB900" rx="0.5" />
            </svg>
            Connect Outlook
          </a>
        </div>
      </div>
    );
  }

  /* ─────────────────────────────────────────────────────────────────────────
     Main layout
  ───────────────────────────────────────────────────────────────────────── */
  return (
    <div className="flex h-screen overflow-hidden">

      {/* ── Folder sidebar ── */}
      <FolderSidebar
        folders={folders}
        selectedFolder={selectedFolder}
        onSelectFolder={(fid) => {
          setSelectedFolder(fid);
          setSelectedId(null);
          setTabFilter('all');
        }}
        totalUnread={totalUnread}
      />

      {/* ── Email list panel ── */}
      <div
        className={`flex flex-col border-r border-fq-border bg-fq-bg transition-all ${
          selected ? 'w-[400px] min-w-[400px]' : 'w-full max-w-[620px]'
        }`}
      >
        {/* Header */}
        <div className="px-6 pt-8 pb-2 bg-fq-bg">
          <div className="flex items-center justify-between mb-0.5">
            <h1 className={`font-heading text-[28px] font-semibold ${tk.heading}`}>Inbox</h1>
            <div className="flex items-center gap-2">
              <button
                onClick={() => loadEmails(false)}
                disabled={syncing || loading}
                title="Refresh"
                className={`p-2 rounded-lg hover:bg-fq-light-accent transition-colors ${tk.icon} disabled:opacity-40`}
              >
                <svg
                  width="14" height="14" viewBox="0 0 20 20" fill="none"
                  stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                  className={syncing ? 'animate-spin' : ''}
                >
                  <path d="M4 10a6 6 0 1 0 1.3-3.8" /><path d="M4 6v4h4" />
                </svg>
              </button>
              {/* Compose button */}
              <button
                onClick={() => setComposeOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-fq-accent text-white font-body text-[12px] font-medium hover:bg-fq-accent/90 transition-colors shadow-sm"
              >
                <Mail size={12} />
                New Email
              </button>
            </div>
          </div>
          {/* Sync timestamp — re-renders each minute via nowTick */}
          <p className={`font-body text-[11.5px] ${tk.light}`} suppressHydrationWarning>
            {nowTick >= 0 && syncedAt
              ? `Synced ${relativeTime(syncedAt)}`
              : loading ? 'Syncing…' : 'Not synced yet'}
          </p>
        </div>

        {/* Search bar */}
        <div className="px-5 pt-3 pb-1">
          <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${searchQuery ? 'border-fq-accent/30 bg-fq-card' : 'border-fq-border bg-fq-card'} transition-colors`}>
            <Search size={13} className={`shrink-0 ${searchQuery ? 'text-fq-accent' : tk.icon}`} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                // Clear folder + filter when searching
                if (e.target.value) {
                  setSelectedFolder(null);
                  setSelectedId(null);
                }
              }}
              placeholder="Search emails…"
              className={`flex-1 font-body text-[12.5px] ${tk.body} bg-transparent border-none outline-none placeholder:text-fq-muted/45`}
            />
            {searchLoading && (
              <div className="w-3 h-3 border border-fq-accent/30 border-t-fq-accent rounded-full animate-spin shrink-0" />
            )}
            {searchQuery && !searchLoading && (
              <button
                onClick={() => { setSearchQuery(''); setSearchResults(null); }}
                className={`shrink-0 p-0.5 rounded hover:bg-fq-light-accent transition-colors ${tk.icon}`}
              >
                <X size={12} />
              </button>
            )}
          </div>
          {searchedGraph && (
            <p className={`font-body text-[11px] ${tk.light} mt-1 px-1`}>
              Searching all email…
            </p>
          )}
        </div>

        {/* Error banner */}
        {error && (
          <div className="mx-5 mt-3 px-4 py-2.5 rounded-lg border border-red-200 bg-red-50">
            <p className="font-body text-[12px] text-red-600">{error}</p>
          </div>
        )}

        {/* Tab filter bar — hidden when searching */}
        {!searchQuery && (
          <div className="flex items-center gap-1 px-5 pt-4 pb-2 flex-wrap">
            {[
              ...TAB_FILTERS,
              ...(untaggedCount > 0 ? [{ key: 'untagged' as TabFilter, label: 'Untagged' }] : []),
            ].map((f) => {
              const count  = countFor(f.key);
              const active = tabFilter === f.key;
              return (
                <button
                  key={f.key}
                  onClick={() => setTabFilter(f.key)}
                  className={`font-body text-[12px] px-3 py-1.5 rounded-full transition-all ${
                    active
                      ? f.key === 'untagged'
                        ? 'bg-fq-amber text-white font-medium'
                        : 'bg-fq-dark text-white font-medium'
                      : `${tk.light} hover:text-fq-dark hover:bg-fq-light-accent`
                  }`}
                >
                  {f.label}
                  {count > 0 && (
                    <span className={`ml-1.5 ${active ? 'text-white/65' : 'text-fq-muted/45'}`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Project filter dropdown — hidden when searching */}
        {!searchQuery && (
          <div className="px-5 pb-3">
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className={`w-full font-body text-[12px] ${tk.body} bg-fq-card border border-fq-border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-fq-accent/30`}
            >
              <option value="">All Projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Email list */}
        <div className="flex-1 overflow-y-auto px-4 pb-6">

          {/* ── Search results mode ── */}
          {searchQuery && (
            <>
              {searchLoading && (
                <div className="flex flex-col items-center justify-center mt-16 gap-3">
                  <div className="w-5 h-5 border-2 border-fq-accent/30 border-t-fq-accent rounded-full animate-spin" />
                  <p className={`font-body text-[12.5px] ${tk.light}`}>Searching…</p>
                </div>
              )}
              {!searchLoading && searchResults !== null && searchResults.length === 0 && (
                <div className="text-center mt-12">
                  <p className={`font-body text-[13px] ${tk.light}`}>No results for &ldquo;{searchQuery}&rdquo;</p>
                </div>
              )}
              {!searchLoading && searchResults?.map((email) => (
                <EmailCard
                  key={email.id}
                  email={email}
                  isSelected={selectedId === email.id}
                  projects={projects}
                  onSelect={() => handleSelectEmail(email)}
                  onReply={handleReply}
                  onConfirmSuggested={handleConfirmSuggested}
                  onDismissSuggested={handleDismissSuggested}
                  onToggleFollowup={handleToggleFollowup}
                  onResolve={handleResolve}
                  onNeedsResponse={handleNeedsResponse}
                  onDraftResponse={handleDraftResponse}
                  onDismiss={handleDismiss}
                  onReassign={handleReassign}
                />
              ))}
            </>
          )}

          {/* ── Normal list mode ── */}
          {!searchQuery && (
            <>
              {loading && (
                <div className="flex flex-col items-center justify-center mt-16 gap-3">
                  <div className="w-6 h-6 border-2 border-fq-accent/30 border-t-fq-accent rounded-full animate-spin" />
                  <p className={`font-body text-[13px] ${tk.light}`}>Syncing from Outlook…</p>
                </div>
              )}

              {!loading && filteredEmails.length === 0 && (
                <div className="text-center mt-12">
                  <p className={`font-body text-[13px] ${tk.light}`}>
                    {tabFilter === 'all'
                      ? 'No emails.'
                      : tabFilter === 'active'
                      ? 'No active project emails.'
                      : tabFilter === 'needs_response'
                      ? 'No emails need a response right now.'
                      : tabFilter === 'draft_ready'
                      ? 'No drafts are ready to send.'
                      : tabFilter === 'followup'
                      ? 'No emails need follow-up right now.'
                      : tabFilter === 'resolved'
                      ? 'No resolved emails yet.'
                      : tabFilter === 'untagged'
                      ? 'All emails are tagged — great work!'
                      : 'No emails in this view.'}
                  </p>
                </div>
              )}

              {!loading && filteredEmails.map((email) => (
                <EmailCard
                  key={email.id}
                  email={email}
                  isSelected={selectedId === email.id}
                  showStatusPill={tabFilter === 'all'}
                  showTriage={tabFilter === 'untagged'}
                  projects={projects}
                  onSelect={() => handleSelectEmail(email)}
                  onReply={handleReply}
                  onConfirmSuggested={handleConfirmSuggested}
                  onDismissSuggested={handleDismissSuggested}
                  onToggleFollowup={handleToggleFollowup}
                  onResolve={handleResolve}
                  onNeedsResponse={handleNeedsResponse}
                  onDraftResponse={handleDraftResponse}
                  onDismiss={handleDismiss}
                  onReassign={handleReassign}
                />
              ))}
            </>
          )}
        </div>
      </div>

      {/* ── Undo toast ── */}
      {undoToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 rounded-xl bg-fq-dark text-white shadow-lg font-body text-[13px] whitespace-nowrap">
          <span className="text-white/80">{undoToast.message}</span>
          <button
            onClick={() => {
              undoToast.undo();
              setUndoToast(null);
              if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
            }}
            className="font-medium text-fq-accent hover:text-fq-accent/80 transition-colors"
          >
            Undo
          </button>
        </div>
      )}

      {/* ── Detail panel ── */}
      {selected ? (
        <EmailDetail
          email={selected}
          projects={projects}
          onClose={() => setSelectedId(null)}
          onPatch={patch}
          onReassign={handleReassign}
          onTriageSave={handleTriageSave}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center bg-fq-bg">
          <div className="text-center">
            <div className="w-14 h-14 rounded-2xl bg-fq-light-accent flex items-center justify-center mx-auto mb-4">
              <svg width="22" height="22" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className="text-fq-muted/45">
                <rect x="6" y="10" width="36" height="28" rx="4" />
                <path d="M6 16l18 10 18-10" />
              </svg>
            </div>
            <p className={`font-body text-[13.5px] ${tk.light}`}>Select an email to read</p>
          </div>
        </div>
      )}

      {/* ── Compose panel ── */}
      {composeOpen && (
        <ComposePanel
          projects={projects}
          onClose={() => setComposeOpen(false)}
          onSent={() => loadEmails(false)}
        />
      )}
    </div>
  );
}
