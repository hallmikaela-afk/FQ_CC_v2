'use client';

/**
 * ComposePanel — slide-up compose/new-email modal.
 * Features: To autocomplete, CC (collapsed), Subject, Project tag,
 * basic rich-text body (bold/italic/list), auto-appended signature.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, X, ChevronDown, Mail, Paperclip } from 'lucide-react';
import { renderSignatureHtml } from '@/lib/emailSignature';
import type { Project } from './EmailCard';

/* ── Design tokens ── */
const tk = {
  heading: 'text-fq-dark/90',
  body:    'text-fq-muted/85',
  light:   'text-fq-muted/65',
  icon:    'text-fq-muted/55',
};

const INPUT = `w-full font-body text-[13px] text-fq-dark/85 bg-fq-bg border border-fq-border rounded-lg
  px-3 py-2 focus:outline-none focus:ring-1 focus:ring-fq-accent/30 placeholder:text-fq-muted/50`;

/* ── Contact suggestion type ── */
interface Contact {
  name: string;
  email: string;
  source: 'client' | 'vendor' | 'recent';
}

/* ── Props ── */
export interface ComposePanelProps {
  projects: Project[];
  initialProjectId?: string | null;
  initialTo?: string;
  onClose: () => void;
  onSent?: () => void;
}

/* ─────────────────────────────────────────────────────────────────────────────
   RichTextToolbar — thin formatting bar above contentEditable body
───────────────────────────────────────────────────────────────────────────── */
function RichTextToolbar({ containerRef }: { containerRef: React.RefObject<HTMLDivElement | null> }) {
  const exec = (cmd: string, value?: string) => {
    containerRef.current?.focus();
    document.execCommand(cmd, false, value);
  };

  const btnCls = `px-2 py-1 rounded font-body text-[12px] font-medium ${tk.light}
    hover:bg-fq-light-accent hover:text-fq-dark/80 transition-colors select-none`;

  return (
    <div className="flex items-center gap-0.5 px-3 py-1.5 border-b border-fq-border bg-fq-light-accent/30">
      <button type="button" className={btnCls} onMouseDown={(e) => { e.preventDefault(); exec('bold'); }} title="Bold">
        <strong>B</strong>
      </button>
      <button type="button" className={btnCls} onMouseDown={(e) => { e.preventDefault(); exec('italic'); }} title="Italic">
        <em>I</em>
      </button>
      <button type="button" className={`${btnCls} text-[14px] leading-none`} onMouseDown={(e) => { e.preventDefault(); exec('insertUnorderedList'); }} title="Bullet list">
        •≡
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   ToField — text input with autocomplete dropdown
───────────────────────────────────────────────────────────────────────────── */
function ToField({
  value,
  onChange,
  contacts,
  placeholder = 'To',
  label = 'To',
}: {
  value: string;
  onChange: (v: string) => void;
  contacts: Contact[];
  placeholder?: string;
  label?: string;
}) {
  const [open, setOpen]   = useState(false);
  const wrapRef           = useRef<HTMLDivElement>(null);

  const suggestions = value.length > 0
    ? contacts.filter((c) => {
        const q = value.toLowerCase();
        return (
          c.name.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q)
        );
      }).slice(0, 6)
    : [];

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={wrapRef} className="relative">
      <div className="flex items-center gap-2">
        <span className={`font-body text-[11.5px] font-medium ${tk.light} w-14 shrink-0`}>{label}</span>
        <input
          type="email"
          value={value}
          onChange={(e) => { onChange(e.target.value); setOpen(true); }}
          onFocus={() => value.length > 0 && setOpen(true)}
          placeholder={placeholder}
          className="flex-1 font-body text-[13px] text-fq-dark/85 bg-transparent border-none outline-none py-0 placeholder:text-fq-muted/50"
        />
      </div>

      {open && suggestions.length > 0 && (
        <div className="absolute left-16 right-0 top-full mt-1 z-50 rounded-xl border border-fq-border bg-fq-card shadow-lg overflow-hidden">
          {suggestions.map((c) => (
            <button
              key={c.email}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(c.email);
                setOpen(false);
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 hover:bg-fq-bg transition-colors text-left`}
            >
              <div className="w-6 h-6 rounded-full bg-fq-light-accent flex items-center justify-center shrink-0">
                <span className={`font-body text-[10px] font-semibold ${tk.light}`}>
                  {c.name?.[0]?.toUpperCase() ?? '?'}
                </span>
              </div>
              <div className="min-w-0">
                <p className={`font-body text-[12.5px] font-medium text-fq-dark/80 truncate`}>{c.name}</p>
                <p className={`font-body text-[11px] ${tk.light} truncate`}>{c.email}</p>
              </div>
              <span className={`ml-auto font-body text-[10px] ${tk.light} shrink-0 capitalize`}>
                {c.source}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   ComposePanel — main export
───────────────────────────────────────────────────────────────────────────── */
export default function ComposePanel({
  projects,
  initialProjectId,
  initialTo,
  onClose,
  onSent,
}: ComposePanelProps) {
  /* ── Field state ── */
  const [to,        setTo]        = useState(initialTo ?? '');
  const [cc,        setCc]        = useState('');
  const [showCc,    setShowCc]    = useState(false);
  const [subject,   setSubject]   = useState('');
  const [projectId, setProjectId] = useState(initialProjectId ?? '');

  /* ── Contacts for autocomplete ── */
  const [contacts, setContacts] = useState<Contact[]>([]);

  /* ── UI state ── */
  const [sending,     setSending]     = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [sent,        setSent]        = useState(false);
  const [toast,       setToast]       = useState<string | null>(null);
  const [discardAsk,  setDiscardAsk]  = useState(false);

  /* ── Refs ── */
  const bodyRef      = useRef<HTMLDivElement>(null);
  const sigRef       = useRef<HTMLDivElement>(null);
  const toastTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Load contacts ── */
  useEffect(() => {
    const load = async () => {
      try {
        // Clients from projects
        const projRes  = await fetch('/api/projects');
        const projData = await projRes.json();
        const projectList: Array<{
          client1_name?: string; client1_email?: string;
          client2_name?: string; client2_email?: string;
        }> = projData.projects ?? projData ?? [];

        const clientContacts: Contact[] = [];
        for (const p of projectList) {
          if (p.client1_email) clientContacts.push({ name: p.client1_name ?? p.client1_email, email: p.client1_email, source: 'client' });
          if (p.client2_email) clientContacts.push({ name: p.client2_name ?? p.client2_email, email: p.client2_email, source: 'client' });
        }

        // Vendors
        const vendorRes  = await fetch('/api/vendors');
        const vendorData = await vendorRes.json();
        const vendorContacts: Contact[] = (vendorData.vendors ?? vendorData ?? [])
          .filter((v: { email?: string }) => !!v.email)
          .map((v: { vendor_name?: string; email: string }) => ({
            name: v.vendor_name ?? v.email,
            email: v.email,
            source: 'vendor' as const,
          }));

        // Recent senders
        const emailRes  = await fetch('/api/emails?top=50');
        const emailData = await emailRes.json();
        const seen = new Set<string>();
        const recentContacts: Contact[] = [];
        for (const e of (emailData.emails ?? [])) {
          if (e.from_email && !seen.has(e.from_email)) {
            seen.add(e.from_email);
            recentContacts.push({ name: e.from_name ?? e.from_email, email: e.from_email, source: 'recent' });
          }
        }

        // Merge, deduplicate by email (prefer earlier sources)
        const allSeen = new Set<string>();
        const merged: Contact[] = [];
        for (const c of [...clientContacts, ...vendorContacts, ...recentContacts]) {
          if (!allSeen.has(c.email.toLowerCase())) {
            allSeen.add(c.email.toLowerCase());
            merged.push(c);
          }
        }
        setContacts(merged);
      } catch {}
    };
    load();
  }, []);

  /* ── Show toast ── */
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  /* ── Has content? (for discard confirmation) ── */
  const hasContent = useCallback(() => {
    return (
      to.trim().length > 0 ||
      subject.trim().length > 0 ||
      (bodyRef.current?.innerText ?? '').trim().length > 0
    );
  }, [to, subject]);

  /* ── Build email body HTML ── */
  const buildBodyHtml = (): string => {
    const bodyHtml  = bodyRef.current?.innerHTML ?? '';
    const sigHtml   = sigRef.current?.innerHTML ?? renderSignatureHtml();
    return `${bodyHtml}<hr style="border:none;border-top:1px solid #E8E0D8;margin:24px 0 16px" />${sigHtml}`;
  };

  /* ── Parse recipients ── */
  const parseRecipients = (raw: string) =>
    raw.split(/[,;]/).map((s) => s.trim()).filter(Boolean).map((addr) => ({
      emailAddress: { address: addr, name: addr },
    }));

  /* ── Send ── */
  const handleSend = async () => {
    if (!to.trim() || !subject.trim()) {
      showToast('Please fill in To and Subject');
      return;
    }
    setSending(true);
    try {
      const res = await fetch('/api/emails/compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action:      'send',
          to:          parseRecipients(to),
          cc:          cc.trim() ? parseRecipients(cc) : [],
          subject,
          body:        buildBodyHtml(),
          project_id:  projectId || null,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        showToast(d.error ?? 'Failed to send');
        return;
      }
      setSent(true);
      showToast('Email sent');
      if (onSent) onSent();
      setTimeout(onClose, 1200);
    } finally {
      setSending(false);
    }
  };

  /* ── Save Draft ── */
  const handleSaveDraft = async () => {
    setSavingDraft(true);
    try {
      const res = await fetch('/api/emails/compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action:      'draft',
          to:          parseRecipients(to),
          cc:          cc.trim() ? parseRecipients(cc) : [],
          subject:     subject || '(no subject)',
          body:        buildBodyHtml(),
          project_id:  projectId || null,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        showToast(d.error ?? 'Failed to save draft');
        return;
      }
      showToast('Draft saved');
    } finally {
      setSavingDraft(false);
    }
  };

  /* ── Discard ── */
  const handleDiscard = () => {
    if (hasContent()) {
      setDiscardAsk(true);
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center bg-fq-dark/30 backdrop-blur-[2px]">
      <div className="w-full max-w-2xl bg-fq-card rounded-t-2xl sm:rounded-2xl border border-fq-border shadow-2xl flex flex-col max-h-[90vh]">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-fq-border bg-fq-light-accent/30 rounded-t-2xl sm:rounded-t-2xl shrink-0">
          <div className="flex items-center gap-2">
            <Mail size={15} className="text-fq-accent" />
            <span className={`font-heading text-[15px] font-semibold ${tk.heading}`}>New Email</span>
          </div>
          <button
            onClick={handleDiscard}
            className={`p-1.5 rounded-lg hover:bg-fq-border/40 transition-colors ${tk.icon}`}
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Fields ── */}
        <div className="divide-y divide-fq-border shrink-0">
          {/* To */}
          <div className="px-5 py-2.5">
            <div className="flex items-center gap-2">
              <ToField value={to} onChange={setTo} contacts={contacts} label="To" placeholder="recipient@email.com" />
              <button
                type="button"
                onClick={() => setShowCc((v) => !v)}
                className={`shrink-0 font-body text-[11px] font-medium ${tk.light} hover:text-fq-dark flex items-center gap-0.5 transition-colors`}
              >
                CC <ChevronDown size={11} className={`transition-transform ${showCc ? 'rotate-180' : ''}`} />
              </button>
            </div>
          </div>

          {/* CC (collapsed by default) */}
          {showCc && (
            <div className="px-5 py-2.5">
              <ToField value={cc} onChange={setCc} contacts={contacts} label="CC" placeholder="cc@email.com" />
            </div>
          )}

          {/* Subject */}
          <div className="px-5 py-2.5 flex items-center gap-2">
            <span className={`font-body text-[11.5px] font-medium ${tk.light} w-14 shrink-0`}>Subject</span>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
              className="flex-1 font-body text-[13px] text-fq-dark/85 bg-transparent border-none outline-none placeholder:text-fq-muted/50"
            />
          </div>

          {/* Project tag */}
          <div className="px-5 py-2.5 flex items-center gap-2">
            <span className={`font-body text-[11.5px] font-medium ${tk.light} w-14 shrink-0`}>Project</span>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className={`flex-1 font-body text-[12.5px] ${tk.body} bg-transparent border-none outline-none`}
            >
              <option value="">— None —</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* ── Rich text body ── */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          <RichTextToolbar containerRef={bodyRef} />

          {/* Body contentEditable */}
          <div
            ref={bodyRef}
            contentEditable
            suppressContentEditableWarning
            data-placeholder="Write your message…"
            className={`flex-1 overflow-y-auto px-5 py-3 font-body text-[13px] text-fq-dark/85 leading-relaxed focus:outline-none min-h-[140px]
              empty:before:content-[attr(data-placeholder)] empty:before:text-fq-muted/45`}
          />

          {/* Signature separator + editable signature */}
          <div className="px-5 pt-1 pb-2 shrink-0">
            <hr className="border-fq-border mb-3" />
            <div
              ref={sigRef}
              contentEditable
              suppressContentEditableWarning
              className={`font-body text-[12.5px] ${tk.light} leading-relaxed focus:outline-none`}
              dangerouslySetInnerHTML={{ __html: [
                '<strong style="color:#2C2420;font-weight:600">Mikaela Hall | Owner &amp; Creative Director</strong><br/>',
                '(916)715-4122<br/>',
                '<a href="mailto:Mikaela@foxandquinn.co" style="color:#8B6F4E;text-decoration:none">Mikaela@foxandquinn.co</a><br/>',
                '<a href="https://www.foxandquinn.co" style="color:#8B6F4E;text-decoration:none">www.foxandquinn.co</a>',
              ].join('') }}
            />
          </div>
        </div>

        {/* ── Action bar ── */}
        <div className="px-5 py-3 border-t border-fq-border flex items-center gap-2 shrink-0 bg-fq-card rounded-b-2xl">
          <button
            onClick={handleSend}
            disabled={sending || sent}
            className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-fq-accent text-white font-body text-[13px] font-medium hover:bg-fq-accent/90 transition-colors disabled:opacity-50"
          >
            <Send size={13} />
            {sending ? 'Sending…' : sent ? 'Sent!' : 'Send'}
          </button>

          <button
            onClick={handleSaveDraft}
            disabled={savingDraft}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg border border-fq-border font-body text-[12.5px] ${tk.body} hover:bg-fq-light-accent transition-colors disabled:opacity-50`}
          >
            {savingDraft ? 'Saving…' : 'Save Draft'}
          </button>

          <button
            type="button"
            title="Google Drive attachments coming soon"
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border border-fq-border font-body text-[12px] ${tk.light} hover:bg-fq-light-accent transition-colors cursor-not-allowed opacity-60`}
          >
            <Paperclip size={13} />
            Attach
          </button>

          <button
            onClick={handleDiscard}
            className={`ml-auto font-body text-[12px] ${tk.light} hover:text-fq-dark transition-colors`}
          >
            Discard
          </button>
        </div>
      </div>

      {/* ── Discard confirmation ── */}
      {discardAsk && (
        <div className="absolute inset-0 flex items-center justify-center bg-fq-dark/20 backdrop-blur-[1px] z-10">
          <div className="bg-fq-card rounded-2xl border border-fq-border shadow-xl px-6 py-5 max-w-xs w-full mx-4">
            <p className={`font-heading text-[15px] font-semibold ${tk.heading} mb-1.5`}>Discard email?</p>
            <p className={`font-body text-[12.5px] ${tk.light} mb-4`}>
              Your draft will not be saved.
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-fq-dark text-white font-body text-[12.5px] font-medium hover:bg-fq-dark/85 transition-colors"
              >
                Discard
              </button>
              <button
                onClick={() => setDiscardAsk(false)}
                className={`px-4 py-2 rounded-lg border border-fq-border font-body text-[12.5px] ${tk.body} hover:bg-fq-light-accent transition-colors`}
              >
                Keep editing
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Success toast ── */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 rounded-xl bg-fq-dark text-white font-body text-[13px] shadow-lg whitespace-nowrap pointer-events-none">
          {toast}
        </div>
      )}
    </div>
  );
}
