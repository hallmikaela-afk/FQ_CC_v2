'use client';

import { useState, useEffect, useRef, useMemo, type ReactNode } from 'react';
import DOMPurify from 'dompurify';
import { ChevronDown, Check, CheckSquare, ListPlus, Calendar, Reply, Trash2, Paperclip, Bold, Italic, Underline, List, ListOrdered } from 'lucide-react';
import type { Email, Project } from './EmailCard';
import { getISOWeek } from '@/lib/week';
import { buildReplyHtml, emailSignatureHtml } from '@/lib/emailSignature';

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
  const [draftBody, setDraftBody]       = useState('');
  const [loading, setLoading]           = useState(true);
  const [saveStatus, setSaveStatus]     = useState<'idle' | 'saving' | 'saved'>('idle');
  const [sending, setSending]           = useState(false);
  const [sent, setSent]                 = useState(false);
  const [aiLoading, setAiLoading]       = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch draft body from Graph on mount
  useEffect(() => {
    if (!email.draft_message_id) { setLoading(false); return; }
    fetch(`/api/emails/draft-content?draft_message_id=${encodeURIComponent(email.draft_message_id)}`)
      .then((r) => r.json())
      .then((data) => { if (data.body) setDraftBody(data.body); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [email.draft_message_id]);

  // Auto-save with 300ms debounce
  const handleChange = (val: string) => {
    setDraftBody(val);
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
            body: val,
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
    if (!draftBody.trim() || !email.draft_message_id) return;
    setSending(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    try {
      const res = await fetch('/api/emails/update-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send',
          draft_message_id: email.draft_message_id,
          body: draftBody,
          email_id: email.id,
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
    navigator.clipboard.writeText(draftBody).catch(() => {});
    showToast('Copied to clipboard');
  };

  const handleAiAssist = async () => {
    setAiLoading(true);
    try {
      const res = await fetch('/api/emails/draft-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email_id: email.id }),
      });
      const data = await res.json();
      if (data.draft) handleChange(data.draft);
    } finally {
      setAiLoading(false);
    }
  };

  if (sent) return null;

  return (
    <div
      className="rounded-xl border border-fq-border bg-fq-card"
      style={{ borderLeftWidth: '3px', borderLeftColor: 'rgb(196 155 64 / 0.45)' }}
    >
      {/* Header */}
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
            disabled={aiLoading}
            className="flex items-center gap-1 font-body text-[11px] font-medium px-2.5 py-1 rounded-md border border-fq-blue/25 bg-fq-blue-light/50 text-fq-blue hover:bg-fq-blue-light transition-colors disabled:opacity-40"
          >
            {aiLoading ? (
              <span className="w-3 h-3 border border-fq-blue/40 border-t-fq-blue rounded-full animate-spin" />
            ) : (
              <svg width="10" height="10" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 2l2 5h5l-4 3 1.5 5L10 12l-4.5 3L7 10 3 7h5z" />
              </svg>
            )}
            {aiLoading ? 'Thinking…' : 'AI Assist'}
          </button>
        </div>
      </div>

      {/* Editable draft body */}
      {loading ? (
        <div className={`px-4 py-4 font-body text-[12.5px] ${tk.light}`}>Loading draft…</div>
      ) : (
        <textarea
          value={draftBody}
          onChange={(e) => handleChange(e.target.value)}
          rows={8}
          placeholder="Draft content…"
          className={`w-full px-4 py-3 font-body text-[13px] ${tk.body} focus:outline-none resize-none leading-relaxed bg-transparent focus:ring-1 focus:ring-inset focus:ring-fq-accent/20`}
        />
      )}

      {/* Actions */}
      <div className="px-4 py-2.5 border-t border-fq-border flex items-center gap-2">
        <button
          onClick={handleSend}
          disabled={sending || !draftBody.trim()}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-fq-dark text-white font-body text-[12.5px] font-medium hover:bg-fq-dark/85 transition-colors disabled:opacity-40"
        >
          {sending ? 'Sending…' : 'Send'}
        </button>
        <button
          onClick={handleCopy}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg border border-fq-border font-body text-[12.5px] ${tk.body} hover:bg-fq-light-accent transition-colors`}
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
  const bodyRef = useRef<HTMLDivElement>(null);
  const sigRef  = useRef<HTMLDivElement>(null);

  // Focus on mount
  useEffect(() => { bodyRef.current?.focus(); }, []);

  // Inject AI draft text when it arrives asynchronously (e.g. from Add to Sprint)
  useEffect(() => {
    if (initialText && bodyRef.current) {
      bodyRef.current.innerHTML = initialText.replace(/\n/g, '<br>');
      setIsEmpty(false);
    }
  }, [initialText]);

  const execCmd = (cmd: string) => {
    bodyRef.current?.focus();
    document.execCommand(cmd, false, undefined);
  };

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
        body: JSON.stringify({ message_id: email.message_id, reply_html: replyHtml }),
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
        bodyRef.current.innerHTML = data.draft.replace(/\n/g, '<br>');
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
        <span className={`font-body text-[11.5px] ${tk.light}`}>
          Replying to {email.from_name || email.from_email}
        </span>
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

      {/* Rich text toolbar */}
      <div className="flex items-center gap-0.5 px-3 py-1.5 border-b border-fq-border bg-fq-bg/60">
        {toolBtn('Bold', 'bold', <Bold size={13} />)}
        {toolBtn('Italic', 'italic', <Italic size={13} />)}
        {toolBtn('Underline', 'underline', <Underline size={13} />)}
        <div className="w-px h-4 bg-fq-border mx-1" />
        {toolBtn('Bullet list', 'insertUnorderedList', <List size={13} />)}
        {toolBtn('Numbered list', 'insertOrderedList', <ListOrdered size={13} />)}
      </div>

      {/* Editable body */}
      <div
        ref={bodyRef}
        contentEditable
        suppressContentEditableWarning
        data-placeholder="Write your reply…"
        onInput={() => setIsEmpty(!(bodyRef.current?.innerText ?? '').trim())}
        className={`min-h-[150px] px-4 py-3 font-body text-[13px] ${tk.body} focus:outline-none leading-relaxed
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
   EmailDetail — main export
───────────────────────────────────────────────────────────────────────────── */
export default function EmailDetail({ email, projects, onClose, onPatch, onReassign, onTriageSave }: Props) {
  const [replyOpen, setReplyOpen]         = useState(false);
  const [taskOpen, setTaskOpen]           = useState(false);
  const [addToTaskOpen, setAddToTaskOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting]           = useState(false);
  const [badgeOpen, setBadgeOpen]         = useState(false);
  const [sprintAdding, setSprintAdding]   = useState(false);
  const [draftText, setDraftText]         = useState('');
  const [toast, setToast]                 = useState<string | null>(null);
  const badgeRef    = useRef<HTMLDivElement>(null);
  const toastTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  };

  const openPanel = (panel: 'task' | 'addToTask' | 'reply' | 'none') => {
    setTaskOpen(panel === 'task');
    setAddToTaskOpen(panel === 'addToTask');
    setReplyOpen(panel === 'reply');
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
    setTaskOpen(false);
    setAddToTaskOpen(false);
    setDeleteConfirm(false);
    setBadgeOpen(false);
    setDraftText('');
    setToast(null);
  }, [email.id]);

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
    <div className="flex-1 flex flex-col overflow-hidden bg-fq-bg min-w-0">
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
      <div className="flex-1 overflow-y-auto px-7 py-5 space-y-5">

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

        {/* AI Draft card — shown above email body when a draft exists */}
        {email.draft_message_id && (
          <DraftCard email={email} onPatch={onPatch} showToast={showToast} />
        )}

        {/* Email body */}
        <EmailBody html={email.body} plaintext={email.body_preview} />

        {/* Reply compose */}
        {replyOpen && (
          <ReplyPanel email={email} onClose={() => setReplyOpen(false)} initialText={draftText} />
        )}

        {/* Create task form */}
        {taskOpen && (
          <CreateTaskPanel email={email} projects={projects} onClose={() => setTaskOpen(false)} />
        )}

        {/* Add to existing task */}
        {addToTaskOpen && (
          <AddToTaskPanel email={email} onClose={() => setAddToTaskOpen(false)} />
        )}

        {/* Delete confirmation */}
        {deleteConfirm && (
          <div className="border border-red-200 bg-red-50 rounded-xl px-5 py-4">
            <p className="font-body text-[12.5px] text-red-700 mb-3">
              How would you like to delete this email?
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => handleDelete(false)}
                disabled={deleting}
                className="px-4 py-2 rounded-lg bg-red-100 text-red-700 font-body text-[12px] font-medium hover:bg-red-200 transition-colors disabled:opacity-40"
              >
                Remove from inbox only
              </button>
              <button
                onClick={() => handleDelete(true)}
                disabled={deleting}
                className="px-4 py-2 rounded-lg bg-red-600 text-white font-body text-[12px] font-medium hover:bg-red-700 transition-colors disabled:opacity-40"
              >
                {deleting ? 'Deleting…' : 'Also delete from Outlook'}
              </button>
              <button
                onClick={() => setDeleteConfirm(false)}
                className={`px-3 py-2 font-body text-[12px] ${tk.light} hover:text-fq-dark transition-colors`}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="h-2" /> {/* Bottom padding */}
      </div>

      {/* ── Toast ── */}
      {toast && (
        <div className="px-7 py-2 bg-fq-sage-light border-t border-fq-sage/20 shrink-0">
          <p className="font-body text-[12.5px] text-fq-sage">{toast}</p>
        </div>
      )}

      {/* ── Action bar ── */}
      <div className="px-7 py-3 border-t border-fq-border bg-fq-card flex items-center gap-1.5 flex-wrap shrink-0">
        {/* Reply */}
        {!replyOpen && (
          <button
            onClick={() => openPanel('reply')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-fq-border font-body text-[12px] font-medium ${tk.body} hover:bg-fq-light-accent hover:border-fq-accent/20 transition-colors`}
          >
            <Reply size={12} />
            Reply
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
