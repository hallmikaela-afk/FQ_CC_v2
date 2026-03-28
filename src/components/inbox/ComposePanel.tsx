'use client';

/**
 * ComposePanel — slide-up compose/new-email modal.
 * Features: To/CC/BCC with chip autocomplete, Subject, Project tag,
 * basic rich-text body (bold/italic/list/color), auto-appended signature.
 */

import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react';
import { Send, X, Mail, Paperclip, Bold, Italic, Underline, List, ListOrdered } from 'lucide-react';
import { emailSignatureHtml, wrapHtmlEmail } from '@/lib/emailSignature';
import type { Project } from './EmailCard';
import { AddressField, useContacts, chipsToRecipients, type ContactChip } from './AddressField';
import DriveFilePicker, { type DrivePickerFile } from '@/components/drive/DriveFilePicker';

/* ── Design tokens ── */
const tk = {
  heading: 'text-fq-dark/90',
  body:    'text-fq-muted/85',
  light:   'text-fq-muted/65',
  icon:    'text-fq-muted/55',
};

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
  const [colorOpen,   setColorOpen]   = useState(false);
  const [activeColor, setActiveColor] = useState('#2C2C2C');
  const colorBtnRef = useRef<HTMLDivElement>(null);

  const exec = (cmd: string) => {
    containerRef.current?.focus();
    document.execCommand(cmd, false, undefined);
  };

  const applyColor = (color: string) => {
    containerRef.current?.focus();
    document.execCommand('foreColor', false, color);
    setActiveColor(color);
    setColorOpen(false);
  };

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

  const btn = (title: string, cmd: string, icon: ReactNode) => (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => { e.preventDefault(); exec(cmd); }}
      className={`p-1.5 rounded transition-colors ${tk.icon} hover:bg-fq-border/60 hover:text-fq-dark/70 select-none`}
    >
      {icon}
    </button>
  );

  const COLORS = [
    { label: 'Black',      value: '#2C2C2C' },
    { label: 'Dark Red',   value: '#6B2737' },
    { label: 'Warm Brown', value: '#8B6F4E' },
    { label: 'Gray',       value: '#9B8E82' },
    { label: 'White',      value: '#FFFFFF' },
  ];

  return (
    <div className="flex items-center gap-0.5 px-3 py-1.5 border-b border-fq-border bg-fq-bg/60">
      {btn('Bold', 'bold', <Bold size={13} />)}
      {btn('Italic', 'italic', <Italic size={13} />)}
      {btn('Underline', 'underline', <Underline size={13} />)}
      <div className="w-px h-4 bg-fq-border mx-1" />
      {btn('Bullet list', 'insertUnorderedList', <List size={13} />)}
      {btn('Numbered list', 'insertOrderedList', <ListOrdered size={13} />)}
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
  const [toChips,    setToChips]    = useState<ContactChip[]>(() =>
    initialTo ? [{ name: initialTo, email: initialTo }] : [],
  );
  const [ccChips,    setCcChips]    = useState<ContactChip[]>([]);
  const [bccChips,   setBccChips]   = useState<ContactChip[]>([]);
  const [showCcBcc,  setShowCcBcc]  = useState(false);
  const [subject,    setSubject]    = useState('');
  const [projectId,  setProjectId]  = useState(initialProjectId ?? '');

  /* ── Contacts for autocomplete ── */
  const contacts = useContacts();

  /* ── UI state ── */
  const [sending,     setSending]     = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [sent,        setSent]        = useState(false);
  const [toast,       setToast]       = useState<string | null>(null);
  const [discardAsk,  setDiscardAsk]  = useState(false);
  const [drivePickerOpen, setDrivePickerOpen] = useState(false);

  /* ── Refs ── */
  const bodyRef    = useRef<HTMLDivElement>(null);
  const sigRef     = useRef<HTMLDivElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Show toast ── */
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  /* ── Has content? (for discard confirmation) ── */
  const hasContent = useCallback(() => {
    return (
      toChips.length > 0 ||
      subject.trim().length > 0 ||
      (bodyRef.current?.innerText ?? '').trim().length > 0
    );
  }, [toChips, subject]);

  /* ── Build email body HTML ── */
  const buildBodyHtml = (): string => {
    const bodyHtml = bodyRef.current?.innerHTML ?? '';
    const sigHtml  = sigRef.current?.innerHTML ?? emailSignatureHtml;
    return wrapHtmlEmail(`${bodyHtml}<br><br>${sigHtml}`);
  };

  /* ── Send ── */
  const handleSend = async () => {
    if (toChips.length === 0 || !subject.trim()) {
      showToast('Please fill in To and Subject');
      return;
    }
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
          subject,
          body:       buildBodyHtml(),
          project_id: projectId || null,
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
          action:     'draft',
          to:         chipsToRecipients(toChips),
          cc:         chipsToRecipients(ccChips),
          bcc:        chipsToRecipients(bccChips),
          subject:    subject || '(no subject)',
          body:       buildBodyHtml(),
          project_id: projectId || null,
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
          {/* To row */}
          <div className="px-5 py-2.5 flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <AddressField label="To" chips={toChips} onChipsChange={setToChips} contacts={contacts} />
            </div>
            {/* + CC / BCC toggle */}
            {!showCcBcc && (
              <button
                type="button"
                onClick={() => setShowCcBcc(true)}
                className={`shrink-0 font-body text-[11px] font-medium ${tk.light} hover:text-fq-dark transition-colors pt-0.5`}
              >
                + CC / BCC
              </button>
            )}
          </div>

          {/* CC + BCC (expanded) */}
          {showCcBcc && (
            <>
              <div className="px-5 py-2.5">
                <AddressField label="CC" chips={ccChips} onChipsChange={setCcChips} contacts={contacts} />
              </div>
              <div className="px-5 py-2.5">
                <AddressField label="BCC" chips={bccChips} onChipsChange={setBccChips} contacts={contacts} />
              </div>
            </>
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
            style={{ color: '#2C2C2C' }}
            className={`flex-1 overflow-y-auto px-5 py-3 font-body text-[13px] leading-relaxed focus:outline-none min-h-[140px]
              empty:before:content-[attr(data-placeholder)] empty:before:text-fq-muted/45`}
          />

          {/* Editable signature */}
          <div className="px-5 pb-3 shrink-0">
            <div
              ref={sigRef}
              contentEditable
              suppressContentEditableWarning
              className="focus:outline-none"
              dangerouslySetInnerHTML={{ __html: emailSignatureHtml }}
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
            onClick={() => setDrivePickerOpen(true)}
            title="Attach a file from Google Drive"
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border border-fq-border font-body text-[12px] ${tk.light} hover:bg-fq-light-accent transition-colors`}
          >
            <Paperclip size={13} />
            From Drive
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

      {/* ── Drive file picker ── */}
      {drivePickerOpen && (
        <DriveFilePicker
          projectId={projectId || null}
          title="Attach from Drive"
          onClose={() => setDrivePickerOpen(false)}
          onSelect={(file: DrivePickerFile) => {
            setDrivePickerOpen(false);
            // Insert a Drive link into the email body
            if (bodyRef.current) {
              bodyRef.current.focus();
              document.execCommand(
                'insertHTML',
                false,
                `<a href="${file.webViewLink}" target="_blank" rel="noopener noreferrer">${file.name}</a>`,
              );
            }
            showToast(`Attached: ${file.name}`);
          }}
        />
      )}
    </div>
  );
}
