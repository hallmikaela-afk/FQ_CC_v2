'use client';

import { useState, useEffect, useRef, useMemo, type ReactNode } from 'react';
import DOMPurify from 'dompurify';
import { ChevronDown, Check, CheckSquare, ListPlus, Calendar, Reply, CornerUpRight, Trash2, Paperclip, Bold, Italic, Underline, List, ListOrdered } from 'lucide-react';
import type { Email, Project } from './EmailCard';
import { getISOWeek } from '@/lib/week';
import { buildReplyHtml, emailSignatureHtml, wrapHtmlEmail } from '@/lib/emailSignature';
import { AddressField, useContacts, chipsToRecipients, type ContactChip } from './AddressField';

interface Props {
  email: Email;
  projects: Project[];
  onClose: () => void;
  onPatch: (id: string, updates: Record<string, unknown>) => void;
  onReassign: (email: Email, projectId: string | null) => void;
  onTriageSave: (opts: {
    emailId: string;
    projectId: string | null;
    needsFollowup: boolean;
    followupDate: string | null;
    addVendor: boolean;
    vendorName: string;
    vendorEmail: string;
  }) => Promise<void>;
  /** True while a draft is being generated for this email */
  generatingDraft?: boolean;
  /** Callback to trigger AI draft generation for this email */
  onGenerateDraft?: () => void;
  /** Draft text from Claude when Outlook save failed — opens ReplyPanel with this text */
  draftFallbackText?: string | null;
  /** Called once the fallback text has been consumed so parent can clear it */
  onDraftFallbackConsumed?: () => void;
}

/* ── Design tokens ── */
const tk = {
  heading: 'text-fq-dark/90',
  body:    'text-fq-muted/85',
  light:   'text-fq-muted/65',
  icon:    'text-fq-muted/55',
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

function fmtFull(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

function getFridayISO(): string {
  const today = new Date();
  const day = today.getDay(); // 0=Sun … 5=Fri … 6=Sat
  const daysUntilFriday = (5 - day + 7) % 7; // 0 when already Friday
  const friday = new Date(today);
  friday.setDate(today.getDate() + daysUntilFriday);
  return friday.toISOString().split('T')[0];
}

/* ─── Email body processing helpers ─────────────────────────────────────── */

/**
 * Strips tracking pixels (1×1 or 0×0 images) and optionally blocks all
 * external images. Also ensures every link opens in a new tab safely.
 * Returns the processed HTML and whether any blockable images were found.
 */
function processEmailHtml(
  rawHtml: string,
  showImages: boolean,
): { html: string; hasExternalImages: boolean } {
  if (typeof window === 'undefined') return { html: rawHtml, hasExternalImages: false };

  const parser = new DOMParser();
  const doc = parser.parseFromString(rawHtml, 'text/html');

  let hasExternalImages = false;

  doc.querySelectorAll<HTMLImageElement>('img').forEach((img) => {
    // Strip tracking pixels (dimensions ≤ 1)
    const w = parseInt(img.getAttribute('width') ?? img.style.width ?? '999', 10);
    const h = parseInt(img.getAttribute('height') ?? img.style.height ?? '999', 10);
    if (!isNaN(w) && !isNaN(h) && w <= 1 && h <= 1) {
      img.remove();
      return;
    }

    // Handle external images
    const src = img.getAttribute('src') ?? '';
    if (src.startsWith('http') || src.startsWith('//') || src.startsWith('cid:')) {
      hasExternalImages = true;
      if (!showImages) {
        img.setAttribute('data-src', src);
        img.removeAttribute('src');
        img.style.cssText += ';display:none!important';
      }
    }
  });

  // Open all links in new tab safely
  doc.querySelectorAll('a').forEach((a) => {
    a.setAttribute('target', '_blank');
    a.setAttribute('rel', 'noopener noreferrer');
  });

  const sanitized = DOMPurify.sanitize(doc.body.innerHTML, {
    ADD_ATTR: ['target', 'rel', 'data-src', 'style'],
    ALLOW_DATA_ATTR: true,
    FORCE_BODY: true,
  });

  return { html: sanitized, hasExternalImages };
}

/* Detect whether a string is plain text (no meaningful HTML tags) */
function isPlainText(s: string): boolean {
  return !/<(html|body|div|p|br|table|span|ul|ol|li|h[1-6]|a |img |pre|blockquote)[\s>/]/i.test(s);
}

/* Convert plain text to minimal HTML, preserving line breaks */
function plaintextToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  // Double newlines → paragraph breaks; single newlines → line breaks
  return escaped
    .split(/\n{2,}/)
    .map((para) => `<p>${para.replace(/\n/g, '<br>')}</p>`)
    .join('');
}

/* ── HTML body: renders safely in a sandboxed iframe ── */
function EmailBody({ html, plaintext }: { html: string | null; plaintext: string | null }) {
  const iframeRef  = useRef<HTMLIFrameElement>(null);
  const [iframeHeight, setIframeHeight] = useState(320);
  const [showImages, setShowImages]     = useState(false);

  // Process HTML (memoised so it only re-runs when html/showImages change)
  const { html: processedHtml, hasExternalImages } = useMemo(() => {
    if (!html) return { html: null, hasExternalImages: false };
    // If body is plain text, convert newlines to HTML before processing
    const normalised = isPlainText(html) ? plaintextToHtml(html) : html;
    return processEmailHtml(normalised, showImages);
  }, [html, showImages]);

  // Build the plain-text fallback
  const plainContent = plaintext
    ? `<pre style="white-space:pre-wrap;font-family:inherit;font-size:13px;margin:0;line-height:1.7">${
        plaintext.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      }</pre>`
    : '<p style="color:#9B8E82">(no content)</p>';

  const bodyContent = processedHtml ?? plainContent;

  const srcDoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    *{box-sizing:border-box}
    body{margin:0;padding:16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;line-height:1.65;color:#2C2420;background:#fff;word-break:break-word}
    a{color:#8B6F4E}
    img{max-width:100%;height:auto}
    blockquote{border-left:3px solid #E8E0D8;margin:12px 0;padding:0 12px;color:#9B8E82}
    p{margin:0 0 8px}
    table{border-collapse:collapse;max-width:100%}
  </style></head><body>${bodyContent}</body></html>`;

  const handleLoad = () => {
    try {
      const doc = iframeRef.current?.contentDocument;
      if (doc?.body) {
        const h = Math.min(Math.max(doc.body.scrollHeight + 32, 200), 1200);
        setIframeHeight(h);
      }
    } catch {}
  };

  return (
    <div className="space-y-2">
      {/* Load images banner */}
      {hasExternalImages && !showImages && (
        <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-fq-light-accent border border-fq-border">
          <span className={`font-body text-[12px] ${tk.light}`}>
            External images are blocked
          </span>
          <button
            onClick={() => setShowImages(true)}
            className={`font-body text-[11.5px] font-medium px-3 py-1 rounded-md border border-fq-border bg-fq-card ${tk.body} hover:bg-fq-bg transition-colors`}
          >
            Load images
          </button>
        </div>
      )}

      <iframe
        ref={iframeRef}
        srcDoc={srcDoc}
        sandbox="allow-same-origin"
        onLoad={handleLoad}
        className="w-full rounded-xl border border-fq-border bg-fq-card"
        style={{ height: iframeHeight, border: 'none' }}
        title="Email body"
      />
    </div>
  );
}

/* ── Triage panel (shown for untagged emails) ── */
function TriagePanel({
  email,
  projects,
  onTriageSave,
}: {
  email: Email;
  projects: Project[];
  onTriageSave: Props['onTriageSave'];
}) {
  const [projectId, setProjectId]       = useState(email.project_id ?? '');
  const [needsFollowup, setNeedsFollowup] = useState(email.needs_followup);
  const [followupDate, setFollowupDate]  = useState('');
  const [addVendor, setAddVendor]        = useState(false);
  const [vendorName, setVendorName]      = useState(email.from_name ?? '');
  const [vendorEmail, setVendorEmail]    = useState(email.from_email ?? '');
  const [saving, setSaving]             = useState(false);
  const [saved, setSaved]               = useState(false);

  // Reset when email changes
  useEffect(() => {
    setProjectId(email.project_id ?? '');
    setNeedsFollowup(email.needs_followup);
    setFollowupDate('');
    setAddVendor(false);
    setVendorName(email.from_name ?? '');
    setVendorEmail(email.from_email ?? '');
    setSaved(false);
  }, [email.id]);

  if (saved) {
    return (
      <div className="px-4 py-3 rounded-xl bg-fq-sage-light border border-fq-sage/20">
        <p className="font-body text-[12.5px] text-fq-sage">
          ✓ Triage saved.
        </p>
      </div>
    );
  }

  return (
    <div className="border border-fq-amber/25 bg-fq-amber-light/20 rounded-xl px-5 py-4">
      <h4 className={`font-heading text-[13.5px] font-semibold ${tk.heading} mb-3`}>
        Triage this email
      </h4>
      <div className="space-y-3">
        {/* Project select */}
        <div>
          <label className={`font-body text-[11px] ${tk.light} block mb-1`}>
            Assign to project
          </label>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className={`w-full font-body text-[12.5px] ${tk.body} bg-fq-card border border-fq-border rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-fq-accent/30`}
          >
            <option value="">— None / General —</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {/* Needs follow-up */}
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => setNeedsFollowup((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-body text-[12px] font-medium transition-colors ${
              needsFollowup
                ? 'border-fq-amber/35 bg-fq-amber-light text-fq-amber'
                : `border-fq-border bg-fq-card ${tk.body} hover:bg-fq-light-accent`
            }`}
          >
            <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 3L2 17h16L10 3z" /><path d="M10 8v4M10 14h.01" />
            </svg>
            Needs follow-up
          </button>

          {needsFollowup && (
            <input
              type="date"
              value={followupDate}
              onChange={(e) => setFollowupDate(e.target.value)}
              className={`font-body text-[12px] ${tk.body} bg-fq-card border border-fq-border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-fq-accent/30`}
            />
          )}
        </div>

        {/* Add to vendor directory */}
        <label className="flex items-start gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={addVendor}
            onChange={(e) => setAddVendor(e.target.checked)}
            className="mt-0.5 rounded border-fq-border text-fq-accent focus:ring-fq-accent/30"
          />
          <span className={`font-body text-[12px] ${tk.light}`}>
            Add sender to vendor directory
          </span>
        </label>

        {addVendor && (
          <div className="grid grid-cols-2 gap-2 pl-5">
            <input
              value={vendorName}
              onChange={(e) => setVendorName(e.target.value)}
              placeholder="Vendor name"
              className={`font-body text-[12px] ${tk.body} bg-fq-card border border-fq-border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-fq-accent/30`}
            />
            <input
              value={vendorEmail}
              onChange={(e) => setVendorEmail(e.target.value)}
              placeholder="Email address"
              type="email"
              className={`font-body text-[12px] ${tk.body} bg-fq-card border border-fq-border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-fq-accent/30`}
            />
          </div>
        )}

        <button
          onClick={async () => {
            setSaving(true);
            await onTriageSave({
              emailId: email.id,
              projectId: projectId || null,
              needsFollowup,
              followupDate: followupDate || null,
              addVendor,
              vendorName,
              vendorEmail,
            });
            setSaving(false);
            setSaved(true);
          }}
          disabled={saving}
          className="px-4 py-2 rounded-lg bg-fq-dark text-white font-body text-[12.5px] font-medium hover:bg-fq-dark/85 transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save Triage'}
        </button>
      </div>
    </div>
  );
}

/* ── AI Draft Card (shown above email body when draft_message_id is set) ── */
function DraftCard({
  email,
  onPatch,
  showToast,
}: {
  email: Email;
  onPatch: (id: string, updates: Record<string, unknown>) => void;
  showToast: (msg: string) => void;
}) {
  const [loading, setLoading]               = useState(true);
  const [fetchedBody, setFetchedBody]       = useState<string | null>(null);
  const [saveStatus, setSaveStatus]         = useState<'idle' | 'saving' | 'saved'>('idle');
  const [sending, setSending]               = useState(false);
  const [sent, setSent]                     = useState(false);
  const [aiAssistOpen, setAiAssistOpen]     = useState(false);
  const [aiInstruction, setAiInstruction]   = useState('');
  const [aiRegenerating, setAiRegenerating] = useState(false);
  const [deleting, setDeleting]             = useState(false);
  const [colorOpen, setColorOpen]           = useState(false);
  const [activeColor, setActiveColor]       = useState('#2C2C2C');
  const [showCcBcc, setShowCcBcc]           = useState(false);
  const [ccChips,   setCcChips]             = useState<ContactChip[]>([]);
  const [bccChips,  setBccChips]            = useState<ContactChip[]>([]);
  const contacts = useContacts();
  const bodyRef     = useRef<HTMLDivElement>(null);
  const colorBtnRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const COLORS = [
    { label: 'Black',      value: '#2C2C2C' },
    { label: 'Dark Red',   value: '#6B2737' },
    { label: 'Warm Brown', value: '#8B6F4E' },
    { label: 'Gray',       value: '#9B8E82' },
    { label: 'White',      value: '#FFFFFF' },
  ];

  // Fetch draft body from Graph on mount — store in state so the second
  // effect can write to bodyRef once the contentEditable div has mounted.
  useEffect(() => {
    if (!email.draft_message_id) { setLoading(false); return; }
    fetch(`/api/emails/draft-content?draft_message_id=${encodeURIComponent(email.draft_message_id)}`)
      .then((r) => r.json())
      .then((data) => { if (data.body) setFetchedBody(data.body); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [email.draft_message_id]);

  // Once loading is done and the contentEditable div is in the DOM, seed it.
  useEffect(() => {
    if (!loading && fetchedBody && bodyRef.current) {
      bodyRef.current.innerHTML = fetchedBody.replace(/\n/g, '<br>');
    }
  }, [loading, fetchedBody]);

  // Close color picker on outside click
  useEffect(() => {
    if (!colorOpen) return;
    const handler = (e: MouseEvent) => {
      if (colorBtnRef.current && !colorBtnRef.current.contains(e.target as Node)) setColorOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [colorOpen]);

  const execCmd   = (cmd: string) => { bodyRef.current?.focus(); document.execCommand(cmd, false, undefined); };
  const applyColor = (color: string) => {
    bodyRef.current?.focus();
    document.execCommand('foreColor', false, color);
    setActiveColor(color);
    setColorOpen(false);
  };

  const toolBtn = (title: string, cmd: string, icon: ReactNode) => (
    <button
      key={cmd}
      type="button"
      title={title}
      onMouseDown={(e) => { e.preventDefault(); execCmd(cmd); }}
      className={`p-1.5 rounded transition-colors ${tk.icon} hover:bg-fq-border/60 hover:text-fq-dark/70 select-none`}
    >
      {icon}
    </button>
  );

  // Debounced auto-save (sends innerHTML to Outlook)
  const triggerSave = () => {
    const html = bodyRef.current?.innerHTML ?? '';
    setSaveStatus('saving');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        await fetch('/api/emails/update-draft', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update',
            draft_message_id: email.draft_message_id,
            body: html,
            body_is_html: true,
          }),
        });
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } catch {
        setSaveStatus('idle');
      }
    }, 300);
  };

  const handleSend = async () => {
    if (!email.draft_message_id) return;
    const html = bodyRef.current?.innerHTML ?? '';
    if (!bodyRef.current?.innerText?.trim()) return;
    setSending(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    try {
      const res = await fetch('/api/emails/update-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send',
          draft_message_id: email.draft_message_id,
          body: html,
          body_is_html: true,
          email_id: email.id,
          cc:  chipsToRecipients(ccChips),
          bcc: chipsToRecipients(bccChips),
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        showToast(d.error ?? 'Failed to send draft');
        return;
      }
      setSent(true);
      onPatch(email.id, { resolved: true, draft_message_id: null });
      showToast('Draft sent ✓');
    } finally {
      setSending(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(bodyRef.current?.innerText ?? '').catch(() => {});
    showToast('Copied to clipboard');
  };

  const handleAiAssist = () => {
    setAiAssistOpen((v) => !v);
    if (aiAssistOpen) setAiInstruction('');
  };

  const handleRegenerate = async () => {
    if (!aiInstruction.trim()) return;
    setAiRegenerating(true);
    try {
      const res = await fetch('/api/emails/draft-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email_id: email.id,
          instruction: aiInstruction.trim(),
          current_draft: bodyRef.current?.innerText ?? '',
        }),
      });
      const data = await res.json();
      if (data.draft && bodyRef.current) {
        bodyRef.current.innerHTML = data.draft.replace(/\n/g, '<br>');
        triggerSave();
        setAiAssistOpen(false);
        setAiInstruction('');
        showToast('Draft updated ✓');
      }
    } finally {
      setAiRegenerating(false);
    }
  };

  const handleDeleteDraft = async () => {
    if (!email.draft_message_id || deleting) return;
    setDeleting(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    try {
      await fetch('/api/emails/update-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          draft_message_id: email.draft_message_id,
          email_id: email.id,
        }),
      });
      onPatch(email.id, { draft_message_id: null });
      showToast('Draft deleted');
    } finally {
      setDeleting(false);
    }
  };

  if (sent) return null;

  return (
    <div
      className="rounded-xl border border-fq-border bg-fq-card"
      style={{ borderLeftWidth: '3px', borderLeftColor: 'rgb(196 155 64 / 0.45)' }}
    >
      {/* ── Header ── */}
      <div className="px-4 py-2.5 border-b border-fq-border bg-fq-amber-light/25 flex items-center justify-between">
        <span className={`font-heading text-[13.5px] font-semibold ${tk.heading}`}>
          ✉ AI Draft Response
        </span>
        <div className="flex items-center gap-2">
          {saveStatus === 'saving' && (
            <span className={`font-body text-[11px] ${tk.light}`}>Saving…</span>
          )}
          {saveStatus === 'saved' && (
            <span className="font-body text-[11px] text-fq-sage">Saved</span>
          )}
          <button
            onClick={handleAiAssist}
            disabled={aiRegenerating}
            className={`flex items-center gap-1 font-body text-[11px] font-medium px-2.5 py-1 rounded-md border transition-colors disabled:opacity-40 ${
              aiAssistOpen
                ? 'border-fq-blue bg-fq-blue-light text-fq-blue'
                : 'border-fq-blue/25 bg-fq-blue-light/50 text-fq-blue hover:bg-fq-blue-light'
            }`}
          >
            <svg width="10" height="10" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 2l2 5h5l-4 3 1.5 5L10 12l-4.5 3L7 10 3 7h5z" />
            </svg>
            AI Assist
          </button>
          <button
            onClick={handleDeleteDraft}
            disabled={deleting}
            title="Delete draft"
            className={`flex items-center justify-center w-6 h-6 rounded-md border border-fq-border ${tk.light} hover:border-red-200 hover:bg-red-50 hover:text-red-500 transition-colors disabled:opacity-40`}
          >
            <Trash2 size={11} />
          </button>
        </div>
      </div>

      {/* ── Recipient / CC / BCC subheader ── */}
      <div className="px-4 py-2 border-b border-fq-border bg-fq-light-accent/40 flex items-center gap-2 min-w-0">
        <span className={`font-body text-[11.5px] ${tk.light} shrink-0`}>
          Replying to {email.from_name || email.from_email}
        </span>
        {!showCcBcc && (
          <button
            type="button"
            onClick={() => setShowCcBcc(true)}
            className={`font-body text-[11px] font-medium ${tk.light} hover:text-fq-dark transition-colors shrink-0`}
          >
            + CC / BCC
          </button>
        )}
      </div>

      {/* ── CC / BCC fields (expanded) ── */}
      {showCcBcc && (
        <div className="divide-y divide-fq-border border-b border-fq-border">
          <div className="px-4 py-2">
            <AddressField label="CC" chips={ccChips} onChipsChange={setCcChips} contacts={contacts} />
          </div>
          <div className="px-4 py-2">
            <AddressField label="BCC" chips={bccChips} onChipsChange={setBccChips} contacts={contacts} />
          </div>
        </div>
      )}

      {/* ── AI Assist inline instruction panel ── */}
      {aiAssistOpen && (
        <div className="px-4 py-3 border-b border-fq-border bg-fq-blue-light/15">
          <textarea
            value={aiInstruction}
            onChange={(e) => setAiInstruction(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleRegenerate(); }}
            placeholder="e.g. make this shorter, more formal, add that we'll follow up by Friday..."
            rows={2}
            className={`w-full px-3 py-2 rounded-lg border border-fq-border font-body text-[12.5px] text-fq-dark/85 placeholder:text-fq-muted/45 focus:outline-none focus:ring-1 focus:ring-fq-blue/30 bg-fq-card resize-none`}
            autoFocus
          />
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={handleRegenerate}
              disabled={aiRegenerating || !aiInstruction.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-fq-dark text-white font-body text-[12px] font-medium hover:bg-fq-dark/85 transition-colors disabled:opacity-40"
            >
              {aiRegenerating ? (
                <>
                  <span className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />
                  Regenerating…
                </>
              ) : 'Regenerate'}
            </button>
            <button
              onClick={() => { setAiAssistOpen(false); setAiInstruction(''); }}
              className={`font-body text-[12px] ${tk.light} hover:text-fq-dark transition-colors`}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Rich text toolbar ── */}
      {!loading && (
        <div className="flex items-center gap-0.5 px-3 py-1.5 border-b border-fq-border bg-fq-bg/60">
          {toolBtn('Bold',          'bold',                <Bold size={13} />)}
          {toolBtn('Italic',        'italic',              <Italic size={13} />)}
          {toolBtn('Underline',     'underline',           <Underline size={13} />)}
          <div className="w-px h-4 bg-fq-border mx-1" />
          {toolBtn('Bullet list',   'insertUnorderedList', <List size={13} />)}
          {toolBtn('Numbered list', 'insertOrderedList',   <ListOrdered size={13} />)}
          <div className="w-px h-4 bg-fq-border mx-1" />
          <div ref={colorBtnRef} className="relative">
            <button
              type="button"
              title="Font color"
              onMouseDown={(e) => { e.preventDefault(); setColorOpen((v) => !v); }}
              className={`p-1.5 rounded transition-colors ${tk.icon} hover:bg-fq-border/60 hover:text-fq-dark/70 select-none`}
            >
              <span className="flex flex-col items-center gap-[1.5px]">
                <span className="font-bold text-[12px] leading-none">A</span>
                <span className="w-[11px] h-[2.5px] rounded-full" style={{ backgroundColor: activeColor }} />
              </span>
            </button>
            {colorOpen && (
              <div className="absolute left-0 top-full mt-1 z-50 bg-fq-card border border-fq-border rounded-lg shadow-md p-2 flex gap-1.5">
                {COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    title={c.label}
                    onMouseDown={(e) => { e.preventDefault(); applyColor(c.value); }}
                    className="w-5 h-5 rounded-full border border-fq-border/60 hover:scale-110 transition-transform flex-shrink-0"
                    style={{
                      backgroundColor: c.value,
                      outline: activeColor === c.value ? '2px solid #8B6F4E' : undefined,
                      outlineOffset: '2px',
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Editable body ── */}
      {loading ? (
        <div className={`px-4 py-4 font-body text-[12.5px] ${tk.light}`}>Loading draft…</div>
      ) : (
        <div
          ref={bodyRef}
          contentEditable
          suppressContentEditableWarning
          data-placeholder="Draft content…"
          onInput={triggerSave}
          style={{ color: '#2C2C2C' }}
          className={`min-h-[140px] px-4 py-3 font-body text-[13px] focus:outline-none leading-relaxed
            empty:before:content-[attr(data-placeholder)] empty:before:text-fq-muted/45`}
        />
      )}

      {/* ── Signature preview ── */}
      {!loading && (
        <div className="px-4 pb-3">
          <div dangerouslySetInnerHTML={{ __html: emailSignatureHtml }} />
        </div>
      )}

      {/* ── Actions ── */}
      <div className="px-4 py-2.5 border-t border-fq-border flex items-center gap-2">
        <button
          onClick={handleSend}
          disabled={sending}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-fq-dark text-white font-body text-[12.5px] font-medium hover:bg-fq-dark/85 transition-colors disabled:opacity-40"
        >
          <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 10l14-7-7 14V10H3z" />
          </svg>
          {sending ? 'Sending…' : 'Send Reply'}
        </button>
        <button
          type="button"
          title="Google Drive attachments coming soon"
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border border-fq-border font-body text-[12px] ${tk.light} hover:bg-fq-light-accent transition-colors cursor-not-allowed opacity-60`}
        >
          <Paperclip size={12} />
          Attach
        </button>
        <button
          onClick={handleCopy}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border border-fq-border font-body text-[12px] ${tk.body} hover:bg-fq-light-accent transition-colors`}
        >
          Copy
        </button>
      </div>
    </div>
  );
}

/* ── Reply compose panel ── */
function ReplyPanel({
  email,
  onClose,
  initialText = '',
}: {
  email: Email;
  onClose: () => void;
  initialText?: string;
}) {
  const [sending, setSending]           = useState(false);
  const [sent, setSent]                 = useState(false);
  const [draftLoading, setDraftLoading] = useState(false);
  const [isEmpty, setIsEmpty]           = useState(true);
  const [colorOpen,   setColorOpen]     = useState(false);
  const [activeColor, setActiveColor]   = useState('#2C2C2C');
  const [showCcBcc, setShowCcBcc]       = useState(false);
  const [ccChips,   setCcChips]         = useState<ContactChip[]>([]);
  const [bccChips,  setBccChips]        = useState<ContactChip[]>([]);
  const contacts = useContacts();
  const bodyRef     = useRef<HTMLDivElement>(null);
  const sigRef      = useRef<HTMLDivElement>(null);
  const colorBtnRef = useRef<HTMLDivElement>(null);

  // Focus on mount
  useEffect(() => { bodyRef.current?.focus(); }, []);

  // Inject AI draft text when it arrives asynchronously (e.g. from Add to Sprint)
  useEffect(() => {
    if (initialText && bodyRef.current) {
      bodyRef.current.innerHTML = `<span style="color:#2C2C2C">${initialText.replace(/\n/g, '<br>')}</span>`;
      setIsEmpty(false);
    }
  }, [initialText]);

  // Close color picker on outside click
  useEffect(() => {
    if (!colorOpen) return;
    const handler = (e: MouseEvent) => {
      if (colorBtnRef.current && !colorBtnRef.current.contains(e.target as Node)) {
        setColorOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [colorOpen]);

  const execCmd = (cmd: string) => {
    bodyRef.current?.focus();
    document.execCommand(cmd, false, undefined);
  };

  const applyColor = (color: string) => {
    bodyRef.current?.focus();
    document.execCommand('foreColor', false, color);
    setActiveColor(color);
    setColorOpen(false);
  };

  const COLORS = [
    { label: 'Black',      value: '#2C2C2C' },
    { label: 'Dark Red',   value: '#6B2737' },
    { label: 'Warm Brown', value: '#8B6F4E' },
    { label: 'Gray',       value: '#9B8E82' },
    { label: 'White',      value: '#FFFFFF' },
  ];

  const toolBtn = (title: string, cmd: string, icon: ReactNode) => (
    <button
      type="button"
      key={cmd}
      title={title}
      onMouseDown={(e) => { e.preventDefault(); execCmd(cmd); }}
      className={`p-1.5 rounded transition-colors ${tk.icon} hover:bg-fq-border/60 hover:text-fq-dark/70 select-none`}
    >
      {icon}
    </button>
  );

  const handleSend = async () => {
    const bodyHtml = bodyRef.current?.innerHTML ?? '';
    if (!bodyHtml.trim() || bodyHtml === '<br>') return;
    setSending(true);
    try {
      const originalDate   = fmtFull(email.received_at);
      const originalSender = email.from_name ?? email.from_email ?? 'Unknown';
      const originalBody   = email.body || (email.body_preview ?? '').replace(/\n/g, '<br>');
      const sigHtml        = sigRef.current?.innerHTML ?? emailSignatureHtml;
      const replyHtml      = buildReplyHtml(
        `${bodyHtml}<br><br>${sigHtml}`,
        originalDate,
        originalSender,
        originalBody,
      );
      await fetch('/api/emails/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message_id: email.message_id,
          reply_html: replyHtml,
          cc:  chipsToRecipients(ccChips),
          bcc: chipsToRecipients(bccChips),
        }),
      });
      setSent(true);
    } finally {
      setSending(false);
    }
  };

  const handleAIDraft = async () => {
    setDraftLoading(true);
    try {
      const res  = await fetch('/api/emails/draft-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email_id: email.id }),
      });
      const data = await res.json();
      if (data.draft && bodyRef.current) {
        bodyRef.current.innerHTML = `<span style="color:#2C2C2C">${data.draft.replace(/\n/g, '<br>')}</span>`;
        setIsEmpty(false);
        bodyRef.current.focus();
      }
    } finally {
      setDraftLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="px-4 py-3 rounded-xl bg-fq-sage-light border border-fq-sage/20">
        <p className="font-body text-[12.5px] text-fq-sage">✓ Reply sent.</p>
      </div>
    );
  }

  return (
    <div className="border border-fq-border rounded-xl overflow-hidden bg-fq-card">
      {/* Panel header */}
      <div className="px-4 py-2 border-b border-fq-border bg-fq-light-accent/40 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`font-body text-[11.5px] ${tk.light} shrink-0`}>
            Replying to {email.from_name || email.from_email}
          </span>
          {!showCcBcc && (
            <button
              type="button"
              onClick={() => setShowCcBcc(true)}
              className={`font-body text-[11px] font-medium ${tk.light} hover:text-fq-dark transition-colors shrink-0`}
            >
              + CC / BCC
            </button>
          )}
        </div>
        <button
          onClick={handleAIDraft}
          disabled={draftLoading}
          className="flex items-center gap-1 font-body text-[11px] font-medium px-2.5 py-1 rounded-md border border-fq-blue/25 bg-fq-blue-light/50 text-fq-blue hover:bg-fq-blue-light transition-colors disabled:opacity-40"
        >
          {draftLoading ? (
            <span className="w-3 h-3 border border-fq-blue/40 border-t-fq-blue rounded-full animate-spin" />
          ) : (
            <svg width="10" height="10" viewBox="0 0 20 20" fill="currentColor"><path d="M10 2l2 5h5l-4 3 1.5 5L10 12l-4.5 3L7 10 3 7h5z"/></svg>
          )}
          {draftLoading ? 'Drafting…' : 'AI Draft'}
        </button>
      </div>

      {/* CC / BCC fields (expanded) */}
      {showCcBcc && (
        <div className="divide-y divide-fq-border border-b border-fq-border">
          <div className="px-4 py-2">
            <AddressField label="CC" chips={ccChips} onChipsChange={setCcChips} contacts={contacts} />
          </div>
          <div className="px-4 py-2">
            <AddressField label="BCC" chips={bccChips} onChipsChange={setBccChips} contacts={contacts} />
          </div>
        </div>
      )}

      {/* Rich text toolbar */}
      <div className="flex items-center gap-0.5 px-3 py-1.5 border-b border-fq-border bg-fq-bg/60">
        {toolBtn('Bold', 'bold', <Bold size={13} />)}
        {toolBtn('Italic', 'italic', <Italic size={13} />)}
        {toolBtn('Underline', 'underline', <Underline size={13} />)}
        <div className="w-px h-4 bg-fq-border mx-1" />
        {toolBtn('Bullet list', 'insertUnorderedList', <List size={13} />)}
        {toolBtn('Numbered list', 'insertOrderedList', <ListOrdered size={13} />)}
        <div className="w-px h-4 bg-fq-border mx-1" />
        <div ref={colorBtnRef} className="relative">
          <button
            type="button"
            title="Font color"
            onMouseDown={(e) => { e.preventDefault(); setColorOpen((v) => !v); }}
            className={`p-1.5 rounded transition-colors ${tk.icon} hover:bg-fq-border/60 hover:text-fq-dark/70 select-none`}
          >
            <span className="flex flex-col items-center gap-[1.5px]">
              <span className="font-bold text-[12px] leading-none">A</span>
              <span className="w-[11px] h-[2.5px] rounded-full" style={{ backgroundColor: activeColor }} />
            </span>
          </button>
          {colorOpen && (
            <div className="absolute left-0 top-full mt-1 z-50 bg-fq-card border border-fq-border rounded-lg shadow-md p-2 flex gap-1.5">
              {COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  title={c.label}
                  onMouseDown={(e) => { e.preventDefault(); applyColor(c.value); }}
                  className="w-5 h-5 rounded-full border border-fq-border/60 hover:scale-110 transition-transform flex-shrink-0"
                  style={{
                    backgroundColor: c.value,
                    outline: activeColor === c.value ? '2px solid #8B6F4E' : undefined,
                    outlineOffset: '2px',
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Editable body */}
      <div
        ref={bodyRef}
        contentEditable
        suppressContentEditableWarning
        data-placeholder="Write your reply…"
        onInput={() => setIsEmpty(!(bodyRef.current?.innerText ?? '').trim())}
        style={{ color: '#2C2C2C' }}
        className={`min-h-[150px] px-4 py-3 font-body text-[13px] focus:outline-none leading-relaxed
          empty:before:content-[attr(data-placeholder)] empty:before:text-fq-muted/45`}
      />

      {/* Editable signature preview */}
      <div className="px-4 pb-2">
        <div
          ref={sigRef}
          contentEditable
          suppressContentEditableWarning
          className="focus:outline-none"
          dangerouslySetInnerHTML={{ __html: emailSignatureHtml }}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-t border-fq-border">
        <button
          onClick={handleSend}
          disabled={sending || isEmpty}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-fq-accent text-white font-body text-[12.5px] font-medium hover:bg-fq-accent/90 transition-colors disabled:opacity-40"
        >
          <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 10l14-7-7 14V10H3z" />
          </svg>
          {sending ? 'Sending…' : 'Send Reply'}
        </button>
        <button
          type="button"
          title="Google Drive attachments coming soon"
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border border-fq-border font-body text-[12px] ${tk.light} hover:bg-fq-light-accent transition-colors cursor-not-allowed opacity-60`}
        >
          <Paperclip size={12} />
          Attach
        </button>
        <button
          onClick={onClose}
          className={`px-3 py-2 rounded-lg font-body text-[12px] ${tk.light} hover:bg-fq-light-accent transition-colors`}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

/* ── Create task panel ── */
function CreateTaskPanel({
  email,
  projects,
  onClose,
}: {
  email: Email;
  projects: Project[];
  onClose: () => void;
}) {
  const [taskText, setTaskText]   = useState(email.subject ?? '');
  const [projectId, setProjectId] = useState(email.project_id ?? '');
  const [dueDate, setDueDate]     = useState('');
  const [priority, setPriority]   = useState<'low' | 'medium' | 'high'>('medium');
  const [category, setCategory]   = useState('Communication');
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);

  const handleSave = async () => {
    if (!taskText.trim() || !projectId) return;
    setSaving(true);
    try {
      await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          text: taskText,
          completed: false,
          due_date: dueDate || null,
          category,
          priority,
          sort_order: 0,
        }),
      });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  if (saved) {
    return (
      <div className="px-4 py-3 rounded-xl bg-fq-sage-light border border-fq-sage/20 flex items-center justify-between">
        <p className="font-body text-[12.5px] text-fq-sage">✓ Task created.</p>
        <button onClick={onClose} className={`font-body text-[11px] ${tk.light} hover:text-fq-dark`}>Close</button>
      </div>
    );
  }

  return (
    <div className="border border-fq-border rounded-xl overflow-hidden bg-fq-card">
      <div className="px-4 py-2.5 border-b border-fq-border bg-fq-light-accent/40 flex items-center justify-between">
        <span className={`font-body text-[12px] font-medium ${tk.heading}`}>Create task from email</span>
        <button onClick={onClose} className={`font-body text-[11px] ${tk.light} hover:text-fq-dark`}>Cancel</button>
      </div>

      <div className="px-4 py-3.5 space-y-3">
        <div>
          <label className={`font-body text-[11px] ${tk.light} block mb-1`}>Task name</label>
          <input
            value={taskText}
            onChange={(e) => setTaskText(e.target.value)}
            className={`w-full font-body text-[13px] ${tk.body} bg-fq-bg border border-fq-border rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-fq-accent/30`}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={`font-body text-[11px] ${tk.light} block mb-1`}>Project</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className={`w-full font-body text-[12px] ${tk.body} bg-fq-bg border border-fq-border rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-fq-accent/30`}
            >
              <option value="">Select project…</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={`font-body text-[11px] ${tk.light} block mb-1`}>Due date</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={`w-full font-body text-[12px] ${tk.body} bg-fq-bg border border-fq-border rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-fq-accent/30`}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={`font-body text-[11px] ${tk.light} block mb-1`}>Priority</label>
            <div className="flex gap-1.5">
              {(['low', 'medium', 'high'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPriority(p)}
                  className={`flex-1 px-2 py-1.5 rounded-lg border font-body text-[11px] font-medium capitalize transition-colors ${
                    priority === p
                      ? p === 'high'   ? 'border-red-300 bg-red-50 text-red-600'
                      : p === 'medium' ? 'border-fq-amber/35 bg-fq-amber-light text-fq-amber'
                      :                  'border-fq-sage/30 bg-fq-sage-light text-fq-sage'
                      : `border-fq-border ${tk.light} hover:bg-fq-light-accent`
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className={`font-body text-[11px] ${tk.light} block mb-1`}>Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={`w-full font-body text-[12px] ${tk.body} bg-fq-bg border border-fq-border rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-fq-accent/30`}
            >
              {['Communication', 'Planning', 'Vendor', 'Client', 'Administrative', 'Creative'].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="px-4 py-2.5 border-t border-fq-border">
        <button
          onClick={handleSave}
          disabled={saving || !taskText.trim() || !projectId}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-fq-dark text-white font-body text-[12.5px] font-medium hover:bg-fq-dark/85 transition-colors disabled:opacity-40"
        >
          <CheckSquare size={12} />
          {saving ? 'Saving…' : 'Create Task'}
        </button>
      </div>
    </div>
  );
}

/* ── Add to existing task panel ── */
function AddToTaskPanel({
  email,
  onClose,
}: {
  email: Email;
  onClose: () => void;
}) {
  const [tasks, setTasks]       = useState<Array<{ id: string; text: string }>>([]);
  const [loading, setLoading]   = useState(true);
  const [selectedId, setSelectedId] = useState('');
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);

  useEffect(() => {
    if (!email.project_id) { setLoading(false); return; }
    fetch(`/api/tasks?project_id=${email.project_id}`)
      .then((r) => r.json())
      .then((data: Array<{ id: string; text: string; completed: boolean }>) => {
        setTasks((data ?? []).filter((t) => !t.completed));
      })
      .finally(() => setLoading(false));
  }, [email.project_id]);

  const handleSave = async () => {
    if (!selectedId) return;
    setSaving(true);
    try {
      await fetch('/api/subtasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_id: selectedId,
          text: `Email: ${email.subject ?? '(no subject)'}`,
          completed: false,
          sort_order: 0,
        }),
      });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  if (saved) {
    return (
      <div className="px-4 py-3 rounded-xl bg-fq-sage-light border border-fq-sage/20 flex items-center justify-between">
        <p className="font-body text-[12.5px] text-fq-sage">✓ Added to task.</p>
        <button onClick={onClose} className={`font-body text-[11px] ${tk.light} hover:text-fq-dark`}>Close</button>
      </div>
    );
  }

  if (!email.project_id) {
    return (
      <div className="border border-fq-border rounded-xl px-5 py-4 bg-fq-card">
        <p className={`font-body text-[12.5px] ${tk.light}`}>
          Assign this email to a project first to add it to an existing task.
        </p>
        <button onClick={onClose} className={`mt-2 font-body text-[11px] ${tk.light} hover:text-fq-dark`}>Close</button>
      </div>
    );
  }

  return (
    <div className="border border-fq-border rounded-xl overflow-hidden bg-fq-card">
      <div className="px-4 py-2.5 border-b border-fq-border bg-fq-light-accent/40 flex items-center justify-between">
        <span className={`font-body text-[12px] font-medium ${tk.heading}`}>Add email to existing task</span>
        <button onClick={onClose} className={`font-body text-[11px] ${tk.light} hover:text-fq-dark`}>Cancel</button>
      </div>

      <div className="px-4 py-3.5">
        {loading ? (
          <p className={`font-body text-[12px] ${tk.light}`}>Loading tasks…</p>
        ) : tasks.length === 0 ? (
          <p className={`font-body text-[12px] ${tk.light}`}>No open tasks found for this project.</p>
        ) : (
          <div className="space-y-2">
            <div>
              <label className={`font-body text-[11px] ${tk.light} block mb-1`}>Select task</label>
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className={`w-full font-body text-[12.5px] ${tk.body} bg-fq-bg border border-fq-border rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-fq-accent/30`}
              >
                <option value="">Choose a task…</option>
                {tasks.map((t) => (
                  <option key={t.id} value={t.id}>{t.text}</option>
                ))}
              </select>
            </div>
            <p className={`font-body text-[11px] ${tk.light}`}>
              Will add subtask: &ldquo;Email: {email.subject ?? '(no subject)'}&rdquo;
            </p>
          </div>
        )}
      </div>

      {!loading && tasks.length > 0 && (
        <div className="px-4 py-2.5 border-t border-fq-border">
          <button
            onClick={handleSave}
            disabled={saving || !selectedId}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-fq-dark text-white font-body text-[12.5px] font-medium hover:bg-fq-dark/85 transition-colors disabled:opacity-40"
          >
            <ListPlus size={12} />
            {saving ? 'Adding…' : 'Add to Task'}
          </button>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   ForwardPanel — inline forward composer (lives inside the detail panel)
───────────────────────────────────────────────────────────────────────────── */
function ForwardPanel({ email, onClose }: { email: Email; onClose: () => void }) {
  const [toChips,   setToChips]   = useState<ContactChip[]>([]);
  const [ccChips,   setCcChips]   = useState<ContactChip[]>([]);
  const [bccChips,  setBccChips]  = useState<ContactChip[]>([]);
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [sending,   setSending]   = useState(false);
  const [sent,      setSent]      = useState(false);
  const [colorOpen,   setColorOpen]   = useState(false);
  const [activeColor, setActiveColor] = useState('#2C2C2C');
  const contacts    = useContacts();
  const bodyRef     = useRef<HTMLDivElement>(null);
  const sigRef      = useRef<HTMLDivElement>(null);
  const colorBtnRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bodyRef.current?.focus(); }, []);

  useEffect(() => {
    if (!colorOpen) return;
    const handler = (e: MouseEvent) => {
      if (colorBtnRef.current && !colorBtnRef.current.contains(e.target as Node)) setColorOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [colorOpen]);

  const execCmd   = (cmd: string) => { bodyRef.current?.focus(); document.execCommand(cmd, false, undefined); };
  const applyColor = (color: string) => {
    bodyRef.current?.focus();
    document.execCommand('foreColor', false, color);
    setActiveColor(color);
    setColorOpen(false);
  };

  const COLORS = [
    { label: 'Black',      value: '#2C2C2C' },
    { label: 'Dark Red',   value: '#6B2737' },
    { label: 'Warm Brown', value: '#8B6F4E' },
    { label: 'Gray',       value: '#9B8E82' },
    { label: 'White',      value: '#FFFFFF' },
  ];

  const toolBtn = (title: string, cmd: string, icon: ReactNode) => (
    <button
      type="button"
      key={cmd}
      title={title}
      onMouseDown={(e) => { e.preventDefault(); execCmd(cmd); }}
      className={`p-1.5 rounded transition-colors ${tk.icon} hover:bg-fq-border/60 hover:text-fq-dark/70 select-none`}
    >
      {icon}
    </button>
  );

  const buildForwardHtml = (): string => {
    const userHtml = bodyRef.current?.innerHTML ?? '';
    const sigHtml  = sigRef.current?.innerHTML ?? emailSignatureHtml;
    const originalDate = fmtFull(email.received_at);
    const from = [email.from_name, email.from_email ? `&lt;${email.from_email}&gt;` : ''].filter(Boolean).join(' ');
    const originalBody = email.body || (email.body_preview ?? '').replace(/\n/g, '<br>');
    const fwdBlock = [
      `<div style="border-top:1px solid #E8E4DF;margin-top:16px;padding-top:12px;`,
      `font-family:Optima,'Palatino Linotype',Georgia,serif;font-size:13px;color:#6B6B6B;line-height:1.7;">`,
      `<p style="margin:0 0 8px 0;color:#9B8E82;font-size:10.5px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;">`,
      `Forwarded Message</p>`,
      `<p style="margin:0 0 3px 0"><strong style="color:#5a5a5a">From:</strong> ${from}</p>`,
      `<p style="margin:0 0 3px 0"><strong style="color:#5a5a5a">Date:</strong> ${originalDate}</p>`,
      `<p style="margin:0 0 3px 0"><strong style="color:#5a5a5a">Subject:</strong> ${email.subject ?? '(no subject)'}</p>`,
      `<p style="margin:0 0 12px 0"><strong style="color:#5a5a5a">To:</strong> Mikaela Hall &lt;Mikaela@foxandquinn.co&gt;</p>`,
      `<div>${originalBody}</div></div>`,
    ].join('');
    return wrapHtmlEmail(`${userHtml}<br><br>${sigHtml}${fwdBlock}`);
  };

  const handleSend = async () => {
    if (toChips.length === 0) return;
    setSending(true);
    try {
      const res = await fetch('/api/emails/compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action:     'send',
          to:         chipsToRecipients(toChips),
          cc:         chipsToRecipients(ccChips),
          bcc:        chipsToRecipients(bccChips),
          subject:    `FW: ${email.subject ?? '(no subject)'}`,
          body:       buildForwardHtml(),
          project_id: email.project_id ?? null,
        }),
      });
      if (res.ok) setSent(true);
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div className="px-4 py-3 rounded-xl bg-fq-sage-light border border-fq-sage/20">
        <p className="font-body text-[12.5px] text-fq-sage">✓ Forwarded.</p>
      </div>
    );
  }

  return (
    <div className="border border-fq-border rounded-xl overflow-hidden bg-fq-card">

      {/* ── Header rows: label + To/CC/BCC/Subject ── */}
      <div className="divide-y divide-fq-border border-b border-fq-border">
        {/* Header */}
        <div className="px-4 py-2 bg-fq-light-accent/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CornerUpRight size={12} className="text-fq-accent" />
            <span className={`font-body text-[11.5px] font-medium ${tk.light}`}>Forward</span>
          </div>
          {!showCcBcc && (
            <button
              type="button"
              onClick={() => setShowCcBcc(true)}
              className={`font-body text-[11px] font-medium ${tk.light} hover:text-fq-dark transition-colors`}
            >
              + CC / BCC
            </button>
          )}
        </div>

        {/* To */}
        <div className="px-4 py-2">
          <AddressField label="To" chips={toChips} onChipsChange={setToChips} contacts={contacts} />
        </div>

        {/* CC + BCC (expanded) */}
        {showCcBcc && (
          <>
            <div className="px-4 py-2">
              <AddressField label="CC" chips={ccChips} onChipsChange={setCcChips} contacts={contacts} />
            </div>
            <div className="px-4 py-2">
              <AddressField label="BCC" chips={bccChips} onChipsChange={setBccChips} contacts={contacts} />
            </div>
          </>
        )}

        {/* Subject (display-only) */}
        <div className="px-4 py-2 flex items-center gap-2">
          <span className={`font-body text-[11.5px] font-medium ${tk.light} w-14 shrink-0`}>Subject</span>
          <span className="font-body text-[13px] text-fq-dark/85 truncate">
            FW: {email.subject ?? '(no subject)'}
          </span>
        </div>
      </div>

      {/* ── Rich text toolbar ── */}
      <div className="flex items-center gap-0.5 px-3 py-1.5 border-b border-fq-border bg-fq-bg/60">
        {toolBtn('Bold',           'bold',                <Bold size={13} />)}
        {toolBtn('Italic',         'italic',              <Italic size={13} />)}
        {toolBtn('Underline',      'underline',           <Underline size={13} />)}
        <div className="w-px h-4 bg-fq-border mx-1" />
        {toolBtn('Bullet list',    'insertUnorderedList', <List size={13} />)}
        {toolBtn('Numbered list',  'insertOrderedList',   <ListOrdered size={13} />)}
        <div className="w-px h-4 bg-fq-border mx-1" />
        <div ref={colorBtnRef} className="relative">
          <button
            type="button"
            title="Font color"
            onMouseDown={(e) => { e.preventDefault(); setColorOpen((v) => !v); }}
            className={`p-1.5 rounded transition-colors ${tk.icon} hover:bg-fq-border/60 hover:text-fq-dark/70 select-none`}
          >
            <span className="flex flex-col items-center gap-[1.5px]">
              <span className="font-bold text-[12px] leading-none">A</span>
              <span className="w-[11px] h-[2.5px] rounded-full" style={{ backgroundColor: activeColor }} />
            </span>
          </button>
          {colorOpen && (
            <div className="absolute left-0 top-full mt-1 z-50 bg-fq-card border border-fq-border rounded-lg shadow-md p-2 flex gap-1.5">
              {COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  title={c.label}
                  onMouseDown={(e) => { e.preventDefault(); applyColor(c.value); }}
                  className="w-5 h-5 rounded-full border border-fq-border/60 hover:scale-110 transition-transform flex-shrink-0"
                  style={{
                    backgroundColor: c.value,
                    outline: activeColor === c.value ? '2px solid #8B6F4E' : undefined,
                    outlineOffset: '2px',
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Compose body ── */}
      <div
        ref={bodyRef}
        contentEditable
        suppressContentEditableWarning
        data-placeholder="Add a message…"
        style={{ color: '#2C2C2C' }}
        className={`min-h-[100px] px-4 py-3 font-body text-[13px] focus:outline-none leading-relaxed
          empty:before:content-[attr(data-placeholder)] empty:before:text-fq-muted/45`}
      />

      {/* ── Editable signature ── */}
      <div className="px-4 pb-2">
        <div
          ref={sigRef}
          contentEditable
          suppressContentEditableWarning
          className="focus:outline-none"
          dangerouslySetInnerHTML={{ __html: emailSignatureHtml }}
        />
      </div>

      {/* ── Forwarded message preview (decorative; actual HTML built on send) ── */}
      <div className="px-4 pb-4">
        <div style={{
          borderTop: '1px solid #E8E4DF',
          paddingTop: '12px',
          marginTop: '4px',
          fontFamily: "Optima, 'Palatino Linotype', Georgia, serif",
          fontSize: '12.5px',
          color: '#9B8E82',
          lineHeight: '1.7',
        }}>
          <p style={{ margin: '0 0 6px 0', fontSize: '10.5px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#B0A89E' }}>
            Forwarded Message
          </p>
          <p style={{ margin: '0 0 2px 0' }}>
            <strong style={{ color: '#6B6B6B' }}>From:</strong>{' '}
            {email.from_name ? `${email.from_name} <${email.from_email}>` : email.from_email}
          </p>
          <p style={{ margin: '0 0 2px 0' }}>
            <strong style={{ color: '#6B6B6B' }}>Date:</strong> {fmtFull(email.received_at)}
          </p>
          <p style={{ margin: '0 0 2px 0' }}>
            <strong style={{ color: '#6B6B6B' }}>Subject:</strong> {email.subject ?? '(no subject)'}
          </p>
          <p style={{ margin: '0 0 10px 0' }}>
            <strong style={{ color: '#6B6B6B' }}>To:</strong> Mikaela Hall &lt;Mikaela@foxandquinn.co&gt;
          </p>
          <div className="font-body text-[12px] line-clamp-4" style={{ color: '#9B8E82' }}>
            {email.body_preview ?? ''}
          </div>
        </div>
      </div>

      {/* ── Footer: send / attach / cancel ── */}
      <div className="px-4 py-2.5 border-t border-fq-border flex items-center gap-2 bg-fq-bg/40">
        <button
          onClick={handleSend}
          disabled={sending || toChips.length === 0}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-fq-accent text-white font-body text-[12.5px] font-medium hover:bg-fq-accent/90 transition-colors disabled:opacity-50"
        >
          <CornerUpRight size={12} />
          {sending ? 'Sending…' : 'Forward'}
        </button>

        <button
          type="button"
          title="Google Drive attachments coming soon"
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-fq-border font-body text-[12px] ${tk.light} hover:bg-fq-light-accent transition-colors cursor-not-allowed opacity-60`}
        >
          <Paperclip size={12} />
          Attach
        </button>

        <button
          onClick={onClose}
          className={`ml-auto font-body text-[12px] ${tk.light} hover:text-fq-dark transition-colors`}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   EmailDetail — main export
───────────────────────────────────────────────────────────────────────────── */
export default function EmailDetail({ email, projects, onClose, onPatch, onReassign, onTriageSave, generatingDraft = false, onGenerateDraft, draftFallbackText, onDraftFallbackConsumed }: Props) {
  const [replyOpen,    setReplyOpen]    = useState(false);
  const [forwardOpen,  setForwardOpen]  = useState(false);
  const [taskOpen,     setTaskOpen]     = useState(false);
  const [addToTaskOpen, setAddToTaskOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting]           = useState(false);
  const [badgeOpen, setBadgeOpen]         = useState(false);
  const [sprintAdding, setSprintAdding]   = useState(false);
  const [draftText, setDraftText]         = useState('');
  const [toast, setToast]                 = useState<string | null>(null);
  const badgeRef    = useRef<HTMLDivElement>(null);
  const toastTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollBodyRef = useRef<HTMLDivElement>(null);

  const showToast = (msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  };

  const openPanel = (panel: 'task' | 'addToTask' | 'reply' | 'forward' | 'none') => {
    setTaskOpen(panel === 'task');
    setAddToTaskOpen(panel === 'addToTask');
    setReplyOpen(panel === 'reply');
    setForwardOpen(panel === 'forward');
    // Scroll composer into view at top when opening reply or forward
    if (panel === 'reply' || panel === 'forward') {
      setTimeout(() => scrollBodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' }), 50);
    }
  };

  const handleAddToSprint = async () => {
    setSprintAdding(true);
    try {
      await fetch('/api/sprint-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `Follow up: ${email.subject ?? 'email'}`,
          bucket: email.projects?.name ?? 'Fox & Quinn — Operations',
          tag: 'action',
          sprint_week: getISOWeek(),
          done: false,
          sort_order: 0,
        }),
      });
      openPanel('reply');
      const draftRes = await fetch('/api/emails/draft-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email_id: email.id }),
      });
      const draftData = await draftRes.json();
      if (draftData.draft) setDraftText(draftData.draft);
      showToast('Added to Sprint + Draft Ready');
    } finally {
      setSprintAdding(false);
    }
  };

  // Reset panels when email changes
  useEffect(() => {
    setReplyOpen(false);
    setForwardOpen(false);
    setTaskOpen(false);
    setAddToTaskOpen(false);
    setDeleteConfirm(false);
    setBadgeOpen(false);
    setDraftText('');
    setToast(null);
    // Scroll to top when switching to an email that already has a draft
    if (email.draft_message_id) {
      setTimeout(() => scrollBodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' }), 50);
    }
  }, [email.id]);  // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll to top when draft generation starts (show the spinner / draft card)
  useEffect(() => {
    if (generatingDraft) {
      scrollBodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [generatingDraft]);

  // When Graph save failed but Claude produced text, open reply panel with that text
  useEffect(() => {
    if (!draftFallbackText) return;
    setDraftText(draftFallbackText);
    openPanel('reply');
    onDraftFallbackConsumed?.();
  }, [draftFallbackText]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close badge dropdown on outside click
  useEffect(() => {
    if (!badgeOpen) return;
    const handler = (e: MouseEvent) => {
      if (badgeRef.current && !badgeRef.current.contains(e.target as Node)) {
        setBadgeOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [badgeOpen]);

  const proj     = email.projects;
  const { bg, text: txt } = proj ? projectColors(proj.color) : { bg: '', text: '' };
  const isUntagged = !email.project_id;

  const handleDelete = async (fromOutlook: boolean) => {
    setDeleting(true);
    await fetch('/api/emails', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: email.id, delete_from_outlook: fromOutlook }),
    });
    onClose();
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-fq-bg min-w-0 relative">
      {/* ── Header ── */}
      <div className="px-7 pt-6 pb-4 border-b border-fq-border bg-fq-card shrink-0">
        <div className="flex items-start justify-between gap-4 mb-3">
          <h2 className={`font-heading text-[18px] font-semibold ${tk.heading} leading-snug flex-1 min-w-0`}>
            {email.subject || '(no subject)'}
          </h2>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg hover:bg-fq-light-accent transition-colors ${tk.icon} shrink-0`}
          >
            <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M5 5l10 10M15 5L5 15" />
            </svg>
          </button>
        </div>

        {/* From / date / project */}
        <div className={`font-body text-[12.5px] ${tk.body} space-y-1`}>
          <p>
            <span className={tk.light}>From </span>
            <span className="font-semibold text-fq-dark/80">{email.from_name}</span>
            {email.from_email && (
              <span className={tk.light}> &lt;{email.from_email}&gt;</span>
            )}
          </p>
          <p>
            <span className={tk.light}>Received </span>
            {fmtFull(email.received_at)}
          </p>

          {proj && (
            <div className="flex items-center gap-2 flex-wrap mt-1">

              {/* ── Clickable project badge with reassign dropdown ── */}
              <div ref={badgeRef} className="relative">
                <button
                  onClick={() => setBadgeOpen((v) => !v)}
                  className={`inline-flex items-center gap-1 font-body text-[11.5px] font-medium
                    px-2.5 py-0.5 rounded-full ${bg} ${txt}
                    hover:opacity-80 transition-opacity cursor-pointer`}
                >
                  {proj.name}
                  <ChevronDown size={10} className={`transition-transform ${badgeOpen ? 'rotate-180' : ''}`} />
                </button>

                {badgeOpen && (
                  <div className="absolute top-full left-0 mt-1.5 z-30 bg-fq-card border border-fq-border rounded-xl shadow-lg overflow-hidden min-w-[210px]">
                    {/* Project list */}
                    {projects.map((p) => {
                      return (
                        <button
                          key={p.id}
                          onClick={() => {
                            onReassign(email, p.id);
                            setBadgeOpen(false);
                          }}
                          className={`w-full text-left flex items-center gap-2.5 px-3 py-2
                            font-body text-[12.5px] ${tk.body} hover:bg-fq-bg transition-colors`}
                        >
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: p.color ?? '#E8E0D8' }}
                          />
                          <span className="flex-1 truncate">{p.name}</span>
                          {p.id === email.project_id && (
                            <Check size={11} className="text-fq-accent shrink-0" />
                          )}
                        </button>
                      );
                    })}

                    <div className="border-t border-fq-border" />

                    {/* None / General */}
                    <button
                      onClick={() => {
                        onReassign(email, null);
                        setBadgeOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 font-body text-[12.5px] ${tk.light}
                        hover:bg-fq-bg transition-colors`}
                    >
                      — None / General
                    </button>

                    <div className="border-t border-fq-border" />

                    {/* Mark as Receipt */}
                    <button
                      onClick={() => {
                        onPatch(email.id, {
                          project_id:       null,
                          match_confidence: null,
                          category:         'receipt',
                          dismissed:        true,
                        });
                        setBadgeOpen(false);
                        onClose();
                      }}
                      className={`w-full text-left px-3 py-2 font-body text-[12.5px] ${tk.light}
                        hover:bg-fq-bg transition-colors`}
                    >
                      🧾 Mark as Receipt
                    </button>
                  </div>
                )}
              </div>

              {/* Match confidence pill */}
              {email.match_confidence && email.match_confidence !== 'suggested' && (
                <span className={`font-body text-[10px] px-1.5 py-0.5 rounded-full ${
                  email.match_confidence === 'exact'  ? 'bg-fq-sage-light text-fq-sage' :
                  email.match_confidence === 'high'   ? 'bg-fq-blue-light text-fq-blue' :
                  'bg-fq-light-accent text-fq-muted'
                }`}>
                  {email.match_confidence}
                </span>
              )}

              {/* Link to project page */}
              <a
                href={`/projects/${email.project_id}`}
                onClick={(e) => e.stopPropagation()}
                className={`inline-flex items-center gap-1 font-body text-[11px] ${tk.light} hover:text-fq-accent transition-colors`}
              >
                <svg width="11" height="11" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v5H2V2h5M13 2h5v5M9 11L18 2" />
                </svg>
                Open project
              </a>
            </div>
          )}
        </div>
      </div>

      {/* ── Scrollable body ── */}
      <div ref={scrollBodyRef} className="flex-1 overflow-y-auto px-7 py-5 space-y-5">

        {/* Suggested match banner */}
        {email.match_confidence === 'suggested' && proj && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-fq-light-accent border border-fq-border">
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-fq-accent shrink-0">
              <circle cx="10" cy="10" r="8" /><path d="M10 7v4M10 13h.01" />
            </svg>
            <p className={`font-body text-[12.5px] ${tk.body} flex-1`}>
              Suggested match: <span className="font-semibold text-fq-dark/80">{proj.name}</span>
            </p>
            <button
              onClick={() => onPatch(email.id, { match_confidence: 'exact' })}
              className="font-body text-[11.5px] font-medium px-3 py-1.5 rounded-lg bg-fq-sage-light text-fq-sage hover:bg-fq-sage hover:text-white transition-colors"
            >
              Confirm
            </button>
            <button
              onClick={() => onPatch(email.id, { project_id: null, match_confidence: null })}
              className={`font-body text-[11.5px] font-medium px-3 py-1.5 rounded-lg border border-fq-border ${tk.light} hover:bg-fq-light-accent transition-colors`}
            >
              Not this
            </button>
          </div>
        )}

        {/* Inline triage panel for untagged emails */}
        {isUntagged && (
          <TriagePanel email={email} projects={projects} onTriageSave={onTriageSave} />
        )}

        {/* Composer zone — Draft card OR Reply panel (shared space, never both) */}
        {email.draft_message_id ? (
          <DraftCard email={email} onPatch={onPatch} showToast={showToast} />
        ) : generatingDraft ? (
          <div className="rounded-xl border border-fq-border bg-fq-card" style={{ borderLeftWidth: '3px', borderLeftColor: 'rgb(196 155 64 / 0.45)' }}>
            <div className="px-4 py-2.5 border-b border-fq-border bg-fq-amber-light/25 flex items-center gap-2">
              <span className="w-3.5 h-3.5 border border-fq-amber/40 border-t-fq-amber rounded-full animate-spin" />
              <span className={`font-heading text-[13.5px] font-semibold ${tk.heading}`}>Generating draft…</span>
            </div>
            <div className={`px-4 py-4 font-body text-[12.5px] ${tk.light}`}>Preparing your AI draft response…</div>
          </div>
        ) : replyOpen ? (
          <ReplyPanel email={email} onClose={() => setReplyOpen(false)} initialText={draftText} />
        ) : forwardOpen ? (
          <ForwardPanel email={email} onClose={() => setForwardOpen(false)} />
        ) : onGenerateDraft ? (
          /* ── Generate AI Draft button ── */
          <button
            onClick={onGenerateDraft}
            className="w-full flex items-center gap-2.5 px-4 py-3 rounded-xl border border-fq-accent/25 bg-fq-amber-light/20 font-body text-[13px] font-medium text-fq-accent/80 hover:bg-fq-amber-light/40 hover:border-fq-accent/40 hover:text-fq-accent transition-colors group"
          >
            <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" className="shrink-0 opacity-70 group-hover:opacity-100 transition-opacity">
              <path d="M9.5 2a.75.75 0 01.75.75v.5a.75.75 0 01-1.5 0v-.5A.75.75 0 019.5 2zm4.243 1.757a.75.75 0 010 1.06l-.354.354a.75.75 0 11-1.06-1.06l.353-.354a.75.75 0 011.061 0zm-8.486 0a.75.75 0 011.06 0l.354.354a.75.75 0 01-1.06 1.06l-.354-.353a.75.75 0 010-1.061zM9.5 5a4.5 4.5 0 100 9 4.5 4.5 0 000-9zm-6.75 4a.75.75 0 01.75-.75h.5a.75.75 0 010 1.5h-.5A.75.75 0 012.75 9zm12.5 0a.75.75 0 01.75-.75h.5a.75.75 0 010 1.5h-.5a.75.75 0 01-.75-.75zm-2.007 4.243a.75.75 0 011.06 0l.354.353a.75.75 0 01-1.06 1.061l-.354-.354a.75.75 0 010-1.06zm-9.486 0a.75.75 0 010 1.06l-.353.354a.75.75 0 01-1.061-1.06l.354-.354a.75.75 0 011.06 0zM9.5 14.25a.75.75 0 01.75.75v.5a.75.75 0 01-1.5 0v-.5a.75.75 0 01.75-.75z" />
            </svg>
            ✨ Generate AI Draft
          </button>
        ) : null}

        {/* Email body */}
        <EmailBody html={email.body} plaintext={email.body_preview} />

        {/* Create task form */}
        {taskOpen && (
          <CreateTaskPanel email={email} projects={projects} onClose={() => setTaskOpen(false)} />
        )}

        {/* Add to existing task */}
        {addToTaskOpen && (
          <AddToTaskPanel email={email} onClose={() => setAddToTaskOpen(false)} />
        )}

        <div className="h-2" /> {/* Bottom padding */}
      </div>

      {/* Delete confirmation — floating overlay centered in the panel */}
      {deleteConfirm && (
        <div
          className="absolute inset-0 z-30 flex items-center justify-center bg-fq-dark/20"
          onClick={() => setDeleteConfirm(false)}
        >
          <div
            className="bg-fq-card border border-fq-border rounded-2xl shadow-xl px-6 py-5 w-[340px] max-w-[90%]"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-body text-[13px] font-semibold text-fq-dark mb-1">
              Delete this email?
            </p>
            <p className="font-body text-[12px] text-fq-dark/50 mb-4">
              How would you like to remove it?
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => handleDelete(false)}
                disabled={deleting}
                className="w-full px-4 py-2.5 rounded-xl bg-red-50 text-red-700 border border-red-200 font-body text-[12px] font-medium hover:bg-red-100 transition-colors disabled:opacity-40 text-left"
              >
                Remove from inbox only
              </button>
              <button
                onClick={() => handleDelete(true)}
                disabled={deleting}
                className="w-full px-4 py-2.5 rounded-xl bg-red-600 text-white font-body text-[12px] font-medium hover:bg-red-700 transition-colors disabled:opacity-40 text-left"
              >
                {deleting ? 'Deleting…' : 'Also delete from Outlook'}
              </button>
              <button
                onClick={() => setDeleteConfirm(false)}
                className={`w-full px-4 py-2.5 rounded-xl border border-fq-border font-body text-[12px] ${tk.light} hover:text-fq-dark hover:bg-fq-light-accent transition-colors text-center`}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div className="px-7 py-2 bg-fq-sage-light border-t border-fq-sage/20 shrink-0">
          <p className="font-body text-[12.5px] text-fq-sage">{toast}</p>
        </div>
      )}

      {/* ── Action bar ── */}
      <div className="px-7 py-3 border-t border-fq-border bg-fq-card flex items-center gap-1.5 flex-wrap shrink-0">
        {/* Reply */}
        {/* Reply — if draft exists, scroll to draft card; else open composer at top */}
        {!replyOpen && !email.draft_message_id && (
          <button
            onClick={() => openPanel('reply')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-fq-border font-body text-[12px] font-medium ${tk.body} hover:bg-fq-light-accent hover:border-fq-accent/20 transition-colors`}
          >
            <Reply size={12} />
            Reply
          </button>
        )}
        {email.draft_message_id && (
          <button
            onClick={() => scrollBodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-fq-border font-body text-[12px] font-medium ${tk.body} hover:bg-fq-light-accent hover:border-fq-accent/20 transition-colors`}
          >
            <Reply size={12} />
            Reply
          </button>
        )}

        {/* Forward */}
        {!forwardOpen && (
          <button
            onClick={() => openPanel(forwardOpen ? 'none' : 'forward')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-fq-border font-body text-[12px] font-medium ${tk.body} hover:bg-fq-light-accent hover:border-fq-accent/20 transition-colors`}
          >
            <CornerUpRight size={12} />
            Forward
          </button>
        )}

        {/* Mark as read */}
        {!email.is_read && (
          <button
            onClick={() => onPatch(email.id, { is_read: true })}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-fq-sage/30 bg-fq-sage-light/30 font-body text-[12px] font-medium text-fq-sage hover:bg-fq-sage-light/60 transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 10l3 3 7-7" />
            </svg>
            Mark Read
          </button>
        )}

        {/* Divider */}
        <div className="w-px h-5 bg-fq-border mx-0.5 shrink-0" />

        {/* Create Task */}
        <button
          onClick={() => openPanel(taskOpen ? 'none' : 'task')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-body text-[12px] font-medium transition-colors ${
            taskOpen
              ? 'border-fq-accent/30 bg-fq-light-accent text-fq-dark/80'
              : `border-fq-border ${tk.body} hover:bg-fq-light-accent`
          }`}
        >
          <CheckSquare size={12} />
          Create Task
        </button>

        {/* Add to Task */}
        <button
          onClick={() => openPanel(addToTaskOpen ? 'none' : 'addToTask')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-body text-[12px] font-medium transition-colors ${
            addToTaskOpen
              ? 'border-fq-accent/30 bg-fq-light-accent text-fq-dark/80'
              : `border-fq-border ${tk.body} hover:bg-fq-light-accent`
          }`}
        >
          <ListPlus size={12} />
          Add to Task
        </button>

        {/* Add to Sprint */}
        <button
          onClick={handleAddToSprint}
          disabled={sprintAdding}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-body text-[12px] font-medium transition-colors border-fq-border ${tk.body} hover:bg-fq-light-accent disabled:opacity-50`}
        >
          <Calendar size={12} />
          {sprintAdding ? 'Adding…' : 'Add to Sprint'}
        </button>

        {/* Delete — pushed to right */}
        <button
          onClick={() => setDeleteConfirm((v) => !v)}
          className={`ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-body text-[12px] transition-colors ${
            deleteConfirm
              ? 'border-red-200 bg-red-50 text-red-600'
              : `border-fq-border ${tk.light} hover:border-red-200 hover:text-red-500 hover:bg-red-50`
          }`}
        >
          <Trash2 size={12} />
          Delete
        </button>
      </div>
    </div>
  );
}
