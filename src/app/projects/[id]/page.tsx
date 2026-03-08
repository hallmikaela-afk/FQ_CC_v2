'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { projects, getTeamMember, formatCountdown, formatDate } from '@/data/seed';
import type { Project, Vendor, CallNote, Task } from '@/data/seed';

/* ─────────────── Inline Editable Field ─────────────── */
function EditableField({
  value,
  onChange,
  className = '',
  placeholder = 'Click to edit...',
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { onChange(draft); setEditing(false); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { onChange(draft); setEditing(false); }
          if (e.key === 'Escape') { setDraft(value); setEditing(false); }
        }}
        className={`bg-transparent border-b border-fq-accent/40 outline-none w-full py-0 ${className}`}
        placeholder={placeholder}
      />
    );
  }

  return (
    <span
      onClick={() => { setDraft(value); setEditing(true); }}
      className={`cursor-text hover:border-b hover:border-fq-border/60 transition-colors ${className}`}
    >
      {value || <span className="text-fq-border italic">{placeholder}</span>}
    </span>
  );
}

/* ─────────────── Header Card ─────────────── */
function HeaderCard({ project }: { project: Project }) {
  const countdown = formatCountdown(project.event_date);
  const progressPct = project.tasks_total > 0
    ? (project.tasks_completed / project.tasks_total) * 100
    : 0;

  const [concept, setConcept] = useState(project.concept || '');
  const [venueName, setVenueName] = useState(
    (project.venue_name || project.location || '') +
    (project.venue_location ? `, ${project.venue_location}` : '')
  );
  const [guestCount, setGuestCount] = useState(project.guest_count?.toString() || '');
  const [budget, setBudget] = useState(project.estimated_budget || '');
  const [serviceTier, setServiceTier] = useState(project.service_tier || '');

  const t = {
    heading: 'text-fq-dark/90',
    body: 'text-fq-muted/90',
    light: 'text-fq-muted/70',
    icon: 'text-fq-muted/60',
  };

  return (
    <div className="bg-fq-card rounded-xl border border-fq-border shadow-sm p-6">
      <div className="flex items-start justify-between mb-1">
        <div className="flex items-center gap-3">
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: project.color }} />
          <h1 className={`font-heading text-[28px] font-bold ${t.heading}`}>
            {project.name}
          </h1>
          <span className="text-[11px] font-body font-medium text-fq-accent bg-fq-light-accent px-2.5 py-0.5 rounded-full">
            {project.status}
          </span>
        </div>
        <div className="flex items-center gap-3 text-right">
          <span className={`font-body text-[14px] ${t.body} flex items-center gap-1.5`}>
            📅 {formatDate(project.event_date)}
          </span>
          <span className={`font-heading text-[16px] font-bold ${countdown.isUrgent ? 'text-fq-alert' : 'text-fq-accent'}`}>
            {countdown.text} away
          </span>
        </div>
      </div>

      <div className="ml-6 mb-4">
        <EditableField
          value={concept}
          onChange={setConcept}
          className={`font-body text-[13px] ${t.light} italic`}
          placeholder="Click to add concept..."
        />
      </div>

      <div className="border-t border-fq-border my-4" />

      <div className="flex items-center gap-6 mb-4 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className={`${t.icon} text-[13px]`}>◉</span>
          <EditableField value={venueName} onChange={setVenueName} className={`font-body text-[13px] ${t.body}`} placeholder="Venue name..." />
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`${t.icon} text-[13px]`}>♗</span>
          <EditableField value={guestCount ? `${guestCount} guests` : ''} onChange={(v) => setGuestCount(v.replace(/[^0-9]/g, ''))} className={`font-body text-[13px] ${t.body}`} placeholder="Guest count..." />
        </div>
        <EditableField value={budget ? `${budget} budget` : ''} onChange={(v) => setBudget(v.replace(' budget', ''))} className={`font-body text-[13px] ${t.body}`} placeholder="Budget..." />
        <EditableField value={serviceTier} onChange={setServiceTier} className="text-[11px] font-body font-medium text-fq-accent bg-fq-light-accent px-2.5 py-0.5 rounded-full" placeholder="Service tier..." />
      </div>

      <div className="flex items-center gap-4">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className={`font-body text-[12px] ${t.light}`}>Task progress</span>
            <span className={`font-body text-[12px] ${t.light}`}>{project.tasks_completed}/{project.tasks_total} completed</span>
          </div>
          <div className="h-[6px] bg-fq-border rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${progressPct}%`, backgroundColor: project.color }} />
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {project.assigned_to.map((id) => {
            const member = getTeamMember(id);
            if (!member) return null;
            return (
              <div key={id} className="w-8 h-8 rounded-full bg-fq-light-accent flex items-center justify-center" title={member.name}>
                <span className="font-body text-[11px] font-semibold text-fq-accent">{member.initials}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ─────────────── Editable Agenda Item ─────────────── */
function AgendaItem({ value, onChange, onDelete }: { value: string; onChange: (v: string) => void; onDelete: () => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);
  const t = { body: 'text-fq-muted/90' };

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <span className={`font-body text-[13px] ${t.body} shrink-0`}>-</span>
        <input ref={inputRef} value={draft} onChange={(e) => setDraft(e.target.value)}
          onBlur={() => { onChange(draft); setEditing(false); }}
          onKeyDown={(e) => { if (e.key === 'Enter') { onChange(draft); setEditing(false); } if (e.key === 'Escape') { setDraft(value); setEditing(false); } }}
          className={`flex-1 bg-transparent border-b border-fq-accent/40 outline-none font-body text-[13px] ${t.body} py-0`}
        />
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2 group">
      <p onClick={() => { setDraft(value); setEditing(true); }} className={`font-body text-[13px] ${t.body} flex-1 cursor-text hover:text-fq-dark transition-colors`}>- {value}</p>
      <button onClick={onDelete} className="text-fq-muted/40 hover:text-fq-alert text-[11px] opacity-0 group-hover:opacity-100 transition-opacity shrink-0">✕</button>
    </div>
  );
}

/* ─────────────── Next Call Agenda ─────────────── */
function NextCallAgenda({ items }: { items: string[] }) {
  const [agenda, setAgenda] = useState(items);
  const [draft, setDraft] = useState('');
  const [copied, setCopied] = useState(false);
  const addItem = () => { if (draft.trim()) { setAgenda([...agenda, draft.trim()]); setDraft(''); } };
  const updateItem = (index: number, value: string) => {
    if (!value.trim()) setAgenda(agenda.filter((_, i) => i !== index));
    else setAgenda(agenda.map((item, i) => i === index ? value : item));
  };
  const removeItem = (index: number) => setAgenda(agenda.filter((_, i) => i !== index));

  const copyAsEmail = () => {
    const text = 'Next Call Agenda:\n' + agenda.map((item, i) => `${i + 1}. ${item}`).join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const t = { heading: 'text-fq-dark/90', light: 'text-fq-muted/70', icon: 'text-fq-muted/60' };

  return (
    <div className="bg-fq-card rounded-xl border border-fq-border shadow-sm p-5 h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className={`${t.icon} text-[14px]`}>📋</span>
          <h3 className={`font-heading text-[16px] font-semibold ${t.heading}`}>Next Call Agenda</h3>
        </div>
        {agenda.length > 0 && (
          <button onClick={copyAsEmail} className={`font-body text-[11px] ${copied ? 'text-fq-accent' : t.light} hover:text-fq-dark transition-colors`}>
            {copied ? '✓ Copied!' : '📋 Copy for email'}
          </button>
        )}
      </div>
      <div className="mb-3">
        <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addItem()}
          placeholder="Add items to discuss on the next call..."
          className={`w-full font-body text-[13px] ${t.light} bg-transparent border-none outline-none placeholder:text-fq-muted/40`}
        />
      </div>
      {agenda.length > 0 && (
        <div className="space-y-2 mt-4">
          {agenda.map((item, i) => (
            <AgendaItem key={i} value={item} onChange={(v) => updateItem(i, v)} onDelete={() => removeItem(i)} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────── Vendor Tile ─────────────── */
function VendorTile({ vendor, onRemove }: { vendor: Vendor; onRemove: () => void }) {
  const [name, setName] = useState(vendor.vendor_name);
  const [contact, setContact] = useState(vendor.contact_name || '');
  const [email, setEmail] = useState(vendor.email || '');
  const [phone, setPhone] = useState(vendor.phone || '');
  const [website, setWebsite] = useState(vendor.website || '');
  const [instagram, setInstagram] = useState(vendor.instagram || '');
  const [category, setCategory] = useState(vendor.category);
  const t = { heading: 'text-fq-dark/90', light: 'text-fq-muted/70', icon: 'text-fq-muted/60' };

  return (
    <div className="bg-fq-card rounded-xl border border-fq-border shadow-sm p-4 flex flex-col group/tile">
      <div className="flex items-center justify-between mb-2">
        <EditableField value={category} onChange={setCategory} className="text-[11px] font-body font-medium text-fq-accent bg-fq-light-accent px-2 py-0.5 rounded-full" placeholder="Category..." />
        <button onClick={onRemove} className="text-fq-muted/30 hover:text-fq-alert transition-colors opacity-0 group-hover/tile:opacity-100" title="Remove vendor">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 4h10M5.5 4V3a1 1 0 011-1h3a1 1 0 011 1v1M6.5 7v4M9.5 7v4M4.5 4l.5 8a1 1 0 001 1h4a1 1 0 001-1l.5-8" />
          </svg>
        </button>
      </div>
      <EditableField value={name} onChange={setName} className={`font-body text-[15px] font-medium ${t.heading} mb-2`} placeholder="Vendor name..." />
      <div className="space-y-1 flex-1">
        <div className="flex items-center gap-1.5"><span className={`${t.icon} text-[10px] w-3 shrink-0`}>♗</span><EditableField value={contact} onChange={setContact} className={`font-body text-[12px] ${t.light}`} placeholder="Contact name..." /></div>
        <div className="flex items-center gap-1.5"><span className={`${t.icon} text-[10px] w-3 shrink-0`}>✉</span><EditableField value={email} onChange={setEmail} className={`font-body text-[12px] ${t.light}`} placeholder="Email..." /></div>
        <div className="flex items-center gap-1.5"><span className={`${t.icon} text-[10px] w-3 shrink-0`}>☏</span><EditableField value={phone} onChange={setPhone} className={`font-body text-[12px] ${t.light}`} placeholder="Phone..." /></div>
        <div className="flex items-center gap-1.5"><span className={`${t.icon} text-[10px] w-3 shrink-0`}>⊕</span><EditableField value={website} onChange={setWebsite} className={`font-body text-[12px] ${t.light}`} placeholder="Website..." /></div>
        <div className="flex items-center gap-1.5"><span className={`${t.icon} text-[10px] w-3 shrink-0`}>📷</span><EditableField value={instagram} onChange={setInstagram} className={`font-body text-[12px] ${t.light}`} placeholder="@instagram..." /></div>
      </div>
    </div>
  );
}

/* ─────────────── Add Vendor Modal ─────────────── */
function AddVendorModal({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (vendor: Vendor) => void }) {
  const [category, setCategory] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [instagram, setInstagram] = useState('');
  if (!open) return null;

  const handleSubmit = () => {
    if (!vendorName.trim() || !category.trim()) return;
    onAdd({ id: `v-${Date.now()}`, category: category.trim(), vendor_name: vendorName.trim(), contact_name: contactName.trim() || undefined, email: email.trim() || undefined, phone: phone.trim() || undefined, website: website.trim() || undefined, instagram: instagram.trim() || undefined });
    setCategory(''); setVendorName(''); setContactName(''); setEmail(''); setPhone(''); setWebsite(''); setInstagram('');
    onClose();
  };
  const t = { heading: 'text-fq-dark/90', light: 'text-fq-muted/70' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-fq-card rounded-2xl border border-fq-border shadow-2xl w-[480px] p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className={`font-heading text-[18px] font-semibold ${t.heading}`}>Add Vendor</h3>
          <button onClick={onClose} className="text-fq-muted/40 hover:text-fq-dark text-[18px]">✕</button>
        </div>
        <div className="space-y-3">
          {[
            { label: 'Category *', value: category, set: setCategory, placeholder: 'e.g. Florist, Photographer...' },
            { label: 'Vendor Name *', value: vendorName, set: setVendorName, placeholder: 'Business name' },
            { label: 'Contact Name', value: contactName, set: setContactName, placeholder: 'Primary contact' },
            { label: 'Email', value: email, set: setEmail, placeholder: 'email@example.com' },
            { label: 'Phone', value: phone, set: setPhone, placeholder: '(555) 555-5555' },
            { label: 'Website', value: website, set: setWebsite, placeholder: 'https://...' },
            { label: 'Instagram', value: instagram, set: setInstagram, placeholder: '@handle' },
          ].map(({ label, value, set, placeholder }) => (
            <div key={label}>
              <label className={`font-body text-[12px] font-medium ${t.heading} block mb-1`}>{label}</label>
              <input value={value} onChange={(e) => set(e.target.value)} placeholder={placeholder}
                className={`w-full font-body text-[13px] ${t.light} bg-fq-bg border border-fq-border rounded-lg px-3 py-2 outline-none focus:border-fq-accent/50 placeholder:text-fq-muted/40`}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className={`font-body text-[13px] ${t.light} px-4 py-2 rounded-lg border border-fq-border hover:border-fq-dark/20 transition-colors`}>Cancel</button>
          <button onClick={handleSubmit} disabled={!vendorName.trim() || !category.trim()} className="font-body text-[13px] font-medium bg-fq-dark text-white px-4 py-2 rounded-lg hover:bg-fq-dark/90 transition-colors disabled:opacity-40">Add Vendor</button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────── Vendor Contacts ─────────────── */
function VendorContacts({ vendors: initialVendors }: { vendors: Vendor[] }) {
  const [vendors, setVendors] = useState(initialVendors);
  const [collapsed, setCollapsed] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [copiedCredits, setCopiedCredits] = useState(false);
  const removeVendor = (id: string) => setVendors(vendors.filter(v => v.id !== id));
  const addVendor = (vendor: Vendor) => setVendors([...vendors, vendor]);

  const downloadCSV = () => {
    const headers = ['Category', 'Vendor Name', 'Contact Name', 'Email', 'Phone', 'Website', 'Instagram'];
    const rows = vendors.map(v => [v.category, v.vendor_name, v.contact_name || '', v.email || '', v.phone || '', v.website || '', v.instagram || '']);
    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'vendor-contacts.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const copyVendorCredits = () => {
    const credits = vendors.filter(v => v.instagram).map(v => `${v.category}: ${v.instagram}`).join('\n');
    navigator.clipboard.writeText(credits);
    setCopiedCredits(true);
    setTimeout(() => setCopiedCredits(false), 2000);
  };
  const t = { heading: 'text-fq-dark/90', light: 'text-fq-muted/70', icon: 'text-fq-muted/60' };

  return (
    <div className="bg-fq-card rounded-xl border border-fq-border shadow-sm p-6">
      <div className="flex items-center justify-between mb-5">
        <button onClick={() => setCollapsed(!collapsed)} className="flex items-center gap-3 group">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={`${t.light} transition-transform duration-200 ${collapsed ? '-rotate-90' : ''}`}><path d="M3 5l3 3 3-3" /></svg>
          <span className={`${t.icon} text-[16px]`}>◇</span>
          <h2 className={`font-heading text-[20px] font-semibold ${t.heading} group-hover:text-fq-accent transition-colors`}>Vendor Contacts</h2>
          <span className="text-[12px] font-body text-fq-muted bg-fq-bg px-2 py-0.5 rounded-full">{vendors.length}</span>
        </button>
        <div className="flex items-center gap-2">
          <button onClick={copyVendorCredits} className={`flex items-center gap-1.5 font-body text-[13px] ${copiedCredits ? 'text-fq-accent' : t.light} hover:text-fq-dark px-3 py-2 rounded-lg border border-fq-border hover:border-fq-dark/20 transition-colors`}>
            {copiedCredits ? '✓ Copied!' : '📋 Copy Credits'}
          </button>
          <button onClick={downloadCSV} className={`flex items-center gap-1.5 font-body text-[13px] ${t.light} hover:text-fq-dark px-3 py-2 rounded-lg border border-fq-border hover:border-fq-dark/20 transition-colors`}>↓ Download CSV</button>
          <button onClick={() => setShowAddModal(true)} className="flex items-center gap-1.5 bg-fq-dark text-white font-body text-[13px] font-medium px-4 py-2 rounded-lg hover:bg-fq-dark/90 transition-colors">+ Add Vendor</button>
        </div>
      </div>
      {!collapsed && (
        <div className="grid grid-cols-3 gap-4">
          {vendors.map((vendor) => (<VendorTile key={vendor.id} vendor={vendor} onRemove={() => removeVendor(vendor.id)} />))}
        </div>
      )}
      <AddVendorModal open={showAddModal} onClose={() => setShowAddModal(false)} onAdd={addVendor} />
    </div>
  );
}

/* ─────────────── Rich Text Editor ─────────────── */
function RichTextEditor({
  initialContent,
  onChange,
  placeholder,
}: {
  initialContent?: string;
  onChange?: (html: string) => void;
  placeholder?: string;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [activeFormats, setActiveFormats] = useState<Set<string>>(new Set());
  const [isEmpty, setIsEmpty] = useState(!initialContent);

  // Only set innerHTML once on mount — never again (prevents cursor reset / backward typing)
  useEffect(() => {
    if (editorRef.current && initialContent) {
      editorRef.current.innerHTML = initialContent;
      setIsEmpty(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateActiveFormats = useCallback(() => {
    const formats = new Set<string>();
    try {
      if (document.queryCommandState('bold')) formats.add('bold');
      if (document.queryCommandState('italic')) formats.add('italic');
      if (document.queryCommandState('underline')) formats.add('underline');
      if (document.queryCommandState('insertUnorderedList')) formats.add('insertUnorderedList');
      if (document.queryCommandState('insertOrderedList')) formats.add('insertOrderedList');
    } catch { /* ignore */ }
    setActiveFormats(formats);
  }, []);

  const exec = useCallback((command: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false);
    const html = editorRef.current?.innerHTML || '';
    onChangeRef.current?.(html);
    setIsEmpty(!editorRef.current?.textContent?.trim());
    updateActiveFormats();
  }, [updateActiveFormats]);

  const handleInput = useCallback(() => {
    const html = editorRef.current?.innerHTML || '';
    onChangeRef.current?.(html);
    setIsEmpty(!editorRef.current?.textContent?.trim());
    updateActiveFormats();
  }, [updateActiveFormats]);

  const t = { light: 'text-fq-muted/70', icon: 'text-fq-muted/60' };

  const ToolBtn = ({ cmd, label, title, style }: { cmd: string; label: string; title: string; style?: string }) => (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        exec(cmd);
      }}
      title={title}
      className={`w-7 h-7 rounded flex items-center justify-center hover:text-fq-dark hover:bg-fq-bg transition-colors text-[13px] ${
        activeFormats.has(cmd) ? 'text-fq-accent bg-fq-light-accent' : t.icon
      } ${style || ''}`}
    >
      {label}
    </button>
  );

  return (
    <div className="border border-fq-border rounded-lg overflow-hidden">
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-fq-border bg-fq-bg/50">
        <ToolBtn cmd="bold" label="B" title="Bold (Ctrl+B)" style="font-bold" />
        <ToolBtn cmd="italic" label="I" title="Italic (Ctrl+I)" style="italic" />
        <ToolBtn cmd="underline" label="U" title="Underline (Ctrl+U)" style="underline" />
        <div className="w-px h-4 bg-fq-border mx-1" />
        <ToolBtn cmd="insertUnorderedList" label="•" title="Bullet list" />
        <ToolBtn cmd="insertOrderedList" label="1." title="Numbered list" />
      </div>
      <div className="relative">
        {isEmpty && placeholder && (
          <div className="absolute top-3 left-3 font-body text-[13px] text-fq-muted/40 pointer-events-none">{placeholder}</div>
        )}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          onKeyUp={updateActiveFormats}
          onMouseUp={updateActiveFormats}
          onFocus={updateActiveFormats}
          className="min-h-[120px] max-h-[300px] overflow-y-auto p-3 font-body text-[13px] text-fq-muted/90 leading-relaxed outline-none [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-1 [&_li]:my-0.5"
        />
      </div>
    </div>
  );
}

/* ─────────────── File Parsing Utilities ─────────────── */
async function parseDocxFile(file: File): Promise<string> {
  const mammoth = await import('mammoth');
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.convertToHtml({ arrayBuffer });
  return result.value;
}

async function parsePdfFile(file: File): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = '';

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer, useWorkerFetch: false, isEvalSupported: false, useSystemFonts: true }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const text = content.items.map((item: any) => item.str || '').join(' ');
    pages.push(text);
  }
  return pages.join('\n\n');
}

/* ─────────────── HTML Entity Decoder ─────────────── */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

/* ─────────────── Summary Generation (returns bullet array) ─────────────── */
function generateSummaryBullets(text: string): string[] {
  const clean = decodeHtmlEntities(text.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
  const sentences = clean.split(/(?<=[.!?])\s+/).filter(s => s.length > 10);
  if (sentences.length === 0) return [clean].filter(Boolean);
  if (sentences.length <= 4) return sentences;

  const keywords = ['discussed', 'confirmed', 'decided', 'agreed', 'reviewed', 'covered', 'updated', 'finalized', 'scheduled', 'addressed', 'focused', 'meeting', 'call', 'follow up', 'timeline', 'budget', 'venue', 'vendor'];
  const scored = sentences.map((s, i) => {
    let score = 0;
    if (i === 0) score += 3;
    keywords.forEach(kw => { if (s.toLowerCase().includes(kw)) score += 2; });
    if (s.length > 30 && s.length < 200) score += 1;
    return { s, score, i };
  });
  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, 5);
  // Return in original order
  top.sort((a, b) => a.i - b.i);
  return top.map(x => x.s);
}

/* ─────────────── AI Action Item Extraction ─────────────── */
function extractActionItems(text: string): string[] {
  const patterns = [
    /(?:need to|should|must|will|going to|has to|have to|action:?\s*)\s*(.{10,80})/gi,
    /(?:follow up|reach out|schedule|confirm|send|check|book|finalize|coordinate|review|update|arrange|source|draft|collect|ask|look into)\s+(.{5,80})/gi,
    /(?:^|\n)\s*[-•]\s*(.{10,80})/g,
  ];
  const items = new Set<string>();
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const item = (match[1] || match[0]).replace(/^[-•]\s*/, '').trim();
      if (item.length > 10 && item.length < 120) items.add(item.charAt(0).toUpperCase() + item.slice(1));
    }
  }
  return Array.from(items).slice(0, 10);
}

function findMatchingTask(actionText: string, tasks: Task[]): Task | null {
  const actionWords = actionText.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  let best: Task | null = null;
  let bestScore = 0;
  for (const task of tasks) {
    const taskWords = task.text.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const overlap = actionWords.filter(w => taskWords.some(tw => tw.includes(w) || w.includes(tw))).length;
    const score = overlap / Math.max(actionWords.length, 1);
    if (score > bestScore && score >= 0.3) { bestScore = score; best = task; }
  }
  return best;
}

/* ─────────────── Action Items Panel ─────────────── */
function ActionItemsPanel({ noteContent, tasks, onAccept }: { noteContent: string; tasks: Task[]; onAccept: (item: string, parentTaskId?: string) => void }) {
  const [items, setItems] = useState<string[]>([]);
  const [accepted, setAccepted] = useState<Set<string>>(new Set());
  const [analyzing, setAnalyzing] = useState(false);

  const analyze = () => {
    setAnalyzing(true);
    setTimeout(() => {
      const plainText = noteContent.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ');
      setItems(extractActionItems(plainText));
      setAnalyzing(false);
    }, 600);
  };
  const t = { heading: 'text-fq-dark/90', body: 'text-fq-muted/90', light: 'text-fq-muted/70', icon: 'text-fq-muted/60' };

  if (items.length === 0) {
    return (
      <button onClick={analyze} disabled={analyzing || !noteContent.replace(/<[^>]+>/g, '').trim()} className={`flex items-center gap-1.5 font-body text-[12px] ${t.light} hover:text-fq-accent transition-colors disabled:opacity-40`}>
        <span className="text-[10px]">{analyzing ? '⟳' : '✦'}</span>
        {analyzing ? 'Analyzing...' : 'Extract Action Items'}
      </button>
    );
  }

  return (
    <div className="mt-3 bg-fq-bg/50 rounded-lg p-3 border border-fq-border/60">
      <div className="flex items-center justify-between mb-2">
        <p className={`font-body text-[12px] font-medium ${t.heading}`}>Suggested Actions ({items.length})</p>
        <button onClick={() => setItems([])} className={`font-body text-[11px] ${t.light} hover:text-fq-dark`}>Clear</button>
      </div>
      <div className="space-y-2">
        {items.map((item, i) => {
          const matchedTask = findMatchingTask(item, tasks);
          const isAccepted = accepted.has(item);
          return (
            <div key={i} className="flex items-start gap-2">
              <button onClick={() => { if (!isAccepted) { onAccept(item, matchedTask?.id); setAccepted(new Set([...accepted, item])); } }}
                className={`w-5 h-5 rounded flex items-center justify-center shrink-0 mt-0.5 transition-colors ${isAccepted ? 'bg-fq-accent text-white' : 'border border-fq-border hover:border-fq-accent'}`}>
                {isAccepted && (<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 5l2.5 2.5L8 3" /></svg>)}
              </button>
              <div className="flex-1 min-w-0">
                <span className={`font-body text-[12px] ${isAccepted ? 'text-fq-muted/50' : t.body}`}>{item}</span>
                {matchedTask && <span className={`font-body text-[11px] ${t.light} block mt-0.5`}>↳ Sub-task of: {matchedTask.text}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─────────────── Note Detail Modal ─────────────── */
function NoteDetailModal({
  note,
  onClose,
  tasks,
  onAcceptAction,
  onDelete,
  onUpdate,
}: {
  note: CallNote;
  onClose: () => void;
  tasks: Task[];
  onAcceptAction: (noteId: string, actionText: string, parentTaskId?: string) => void;
  onDelete: (noteId: string) => void;
  onUpdate: (noteId: string, updates: Partial<CallNote>) => void;
}) {
  const [editingContent, setEditingContent] = useState(false);
  const [editingSummary, setEditingSummary] = useState(false);
  const [summaryDraft, setSummaryDraft] = useState(note.summary || '');
  const t = { heading: 'text-fq-dark/90', body: 'text-fq-muted/90', light: 'text-fq-muted/70', icon: 'text-fq-muted/60' };
  const autoSummaryBullets = !note.summary ? generateSummaryBullets(note.raw_text) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-fq-card rounded-2xl border border-fq-border shadow-2xl w-[720px] max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4 border-b border-fq-border">
          <div className="flex-1 min-w-0 mr-4">
            <div className="flex items-center gap-3 mb-1">
              <span className={`${t.icon} text-[16px]`}>📄</span>
              <EditableField
                value={note.title || ''}
                onChange={(v) => onUpdate(note.id, { title: v })}
                className={`font-heading text-[18px] font-semibold ${t.heading}`}
                placeholder="Add a title..."
              />
            </div>
            <div className="ml-8">
              <EditableField
                value={note.date}
                onChange={(v) => onUpdate(note.id, { date: v })}
                className={`font-body text-[13px] ${t.light}`}
                placeholder="YYYY-MM-DD"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => navigator.clipboard.writeText(note.summary || decodeHtmlEntities(note.raw_text.replace(/<[^>]+>/g, ' ')))} className={`font-body text-[12px] ${t.light} hover:text-fq-dark px-3 py-1.5 rounded-lg border border-fq-border hover:border-fq-dark/20 transition-colors`}>📋 Copy</button>
            <button onClick={() => { onDelete(note.id); onClose(); }} className="font-body text-[12px] text-fq-muted/50 hover:text-fq-alert px-3 py-1.5 rounded-lg border border-fq-border hover:border-fq-alert/30 transition-colors">🗑 Delete</button>
            <button onClick={onClose} className="text-fq-muted/40 hover:text-fq-dark text-[18px] ml-2">✕</button>
          </div>
        </div>

        {/* Content (scrollable) */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Summary — double-click to edit */}
          {(note.summary || (autoSummaryBullets && autoSummaryBullets.length > 0)) && (
            <div className="mb-5 bg-fq-light-accent/30 rounded-lg p-4 border border-fq-accent/20">
              <div className="flex items-center justify-between mb-2">
                <p className={`font-body text-[11px] font-medium ${t.light} uppercase tracking-wider`}>
                  {note.summary ? 'Summary' : 'Auto-Generated Summary'}
                </p>
                {editingSummary ? (
                  <button onClick={() => { onUpdate(note.id, { summary: summaryDraft }); setEditingSummary(false); }} className={`font-body text-[11px] text-fq-accent hover:text-fq-dark transition-colors`}>✓ Done</button>
                ) : (
                  <span className={`font-body text-[10px] ${t.light}`}>Double-click to edit</span>
                )}
              </div>
              {editingSummary ? (
                <textarea
                  value={summaryDraft || (autoSummaryBullets ? autoSummaryBullets.join('\n') : '')}
                  onChange={(e) => setSummaryDraft(e.target.value)}
                  className={`w-full font-body text-[13px] ${t.body} leading-relaxed bg-transparent border border-fq-accent/30 rounded-lg p-2 outline-none resize-none min-h-[100px]`}
                  autoFocus
                />
              ) : (
                <div onDoubleClick={() => { setSummaryDraft(note.summary || (autoSummaryBullets ? autoSummaryBullets.join('\n') : '')); setEditingSummary(true); }} className="cursor-default hover:bg-fq-light-accent/30 rounded p-1 -m-1 transition-colors">
                  {note.summary ? (
                    <p className={`font-body text-[13px] ${t.body} leading-relaxed`}>{note.summary}</p>
                  ) : (
                    <ul className="space-y-1">
                      {autoSummaryBullets!.map((bullet, i) => (
                        <li key={i} className={`font-body text-[13px] ${t.body} leading-relaxed flex gap-2`}>
                          <span className="text-fq-accent shrink-0">•</span>
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Full Notes — double-click to edit */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-2">
              <p className={`font-body text-[11px] font-medium ${t.light} uppercase tracking-wider`}>Full Notes</p>
              {editingContent ? (
                <button
                  onClick={() => setEditingContent(false)}
                  className={`font-body text-[11px] text-fq-accent hover:text-fq-dark transition-colors`}
                >
                  ✓ Done editing
                </button>
              ) : (
                <span className={`font-body text-[10px] ${t.light}`}>Double-click to edit</span>
              )}
            </div>
            {editingContent ? (
              <RichTextEditor
                initialContent={note.raw_text}
                onChange={(html) => onUpdate(note.id, { raw_text: html })}
              />
            ) : (
              <div
                onDoubleClick={() => setEditingContent(true)}
                className={`font-body text-[13px] ${t.body} leading-relaxed whitespace-pre-wrap cursor-default hover:bg-fq-bg/30 rounded-lg p-2 -m-2 transition-colors [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5`}
                dangerouslySetInnerHTML={{ __html: note.raw_text }}
              />
            )}
          </div>

          {/* Extracted Actions */}
          {note.extracted_actions.length > 0 && (
            <div className="mb-5">
              <p className={`font-body text-[11px] font-medium ${t.light} uppercase tracking-wider mb-2`}>
                Extracted Actions ({note.extracted_actions.filter(a => a.accepted).length} accepted)
              </p>
              <div className="space-y-1.5">
                {note.extracted_actions.map((action) => (
                  <div key={action.id} className="flex items-center gap-2">
                    <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${action.accepted ? 'bg-fq-accent text-white' : action.dismissed ? 'bg-fq-border' : 'border border-fq-border'}`}>
                      {action.accepted && (<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 5l2.5 2.5L8 3" /></svg>)}
                    </div>
                    <span className={`font-body text-[12px] ${action.dismissed ? 'line-through text-fq-muted/50' : t.body}`}>{action.text}</span>
                    <span className={`font-body text-[11px] ${t.light} ml-1`}>— due {formatDate(action.due_date)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <ActionItemsPanel noteContent={note.raw_text} tasks={tasks} onAccept={(item, parentId) => onAcceptAction(note.id, item, parentId)} />
        </div>
      </div>
    </div>
  );
}

/* ─────────────── Editable Summary (click to edit) ─────────────── */
function EditableSummary({ value, onChange, bullets, textClass }: { value: string; onChange: (v: string) => void; bullets?: string[]; textClass: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const t = { light: 'text-fq-muted/70' };

  if (editing) {
    return (
      <div className="mt-1" onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => { onChange(draft); setEditing(false); }}
          onKeyDown={(e) => { if (e.key === 'Escape') { setDraft(value); setEditing(false); } }}
          className={`w-full ${textClass} bg-transparent border border-fq-accent/30 rounded-lg p-2 outline-none resize-none min-h-[80px]`}
          autoFocus
        />
      </div>
    );
  }

  if (bullets && bullets.length > 0) {
    return (
      <ul className="mt-1 space-y-0.5 cursor-text hover:bg-fq-bg/30 rounded p-1 -m-1 transition-colors" onClick={(e) => { e.stopPropagation(); setDraft(value); setEditing(true); }}>
        {bullets.map((bullet, i) => (
          <li key={i} className={`${textClass} flex gap-2`}>
            <span className="text-fq-accent shrink-0">•</span>
            <span>{bullet}</span>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <p className={`${textClass} cursor-text hover:bg-fq-bg/30 rounded p-1 -m-1 transition-colors`} onClick={(e) => { e.stopPropagation(); setDraft(value); setEditing(true); }}>
      {value}
    </p>
  );
}

/* ─────────────── Call Notes ─────────────── */
function CallNotesSection({ notes: initialNotes, tasks }: { notes: CallNote[]; tasks: Task[] }) {
  const [notes, setNotes] = useState(initialNotes);
  const [collapsed, setCollapsed] = useState(true);
  const [showNewNote, setShowNewNote] = useState(false);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [collapsedNotes, setCollapsedNotes] = useState<Set<string>>(new Set());
  const [expandedNote, setExpandedNote] = useState<CallNote | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleNoteCollapse = (id: string) => {
    const next = new Set(collapsedNotes);
    if (next.has(id)) next.delete(id); else next.add(id);
    setCollapsedNotes(next);
  };

  const deleteNote = (id: string) => setNotes(notes.filter(n => n.id !== id));

  const updateNote = (id: string, updates: Partial<CallNote>) => {
    setNotes(notes.map(n => n.id === id ? { ...n, ...updates } : n));
    // Also update the expanded note if it's the same one
    if (expandedNote && expandedNote.id === id) {
      setExpandedNote({ ...expandedNote, ...updates });
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);

    try {
      let text = '';
      const ext = file.name.split('.').pop()?.toLowerCase();

      if (ext === 'docx' || ext === 'doc') {
        text = await parseDocxFile(file);
      } else if (ext === 'pdf') {
        text = await parsePdfFile(file);
      } else {
        // Plain text files (.txt, .md, .rtf)
        text = await file.text();
      }

      const newNote: CallNote = {
        id: `cn-${Date.now()}`,
        date: new Date().toISOString().split('T')[0],
        raw_text: text,
        extracted_actions: [],
      };
      setNotes([newNote, ...notes]);
    } catch (err) {
      console.error('Upload parse error:', err);
      alert('Could not parse file. Please try a different format.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const addNewNote = () => {
    if (!newNoteContent.replace(/<[^>]+>/g, '').trim()) return;
    const newNote: CallNote = {
      id: `cn-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      raw_text: newNoteContent,
      extracted_actions: [],
    };
    setNotes([newNote, ...notes]);
    setNewNoteContent('');
    setShowNewNote(false);
  };

  const handleAcceptAction = (noteId: string, actionText: string, parentTaskId?: string) => {
    setNotes(notes.map(n => {
      if (n.id !== noteId) return n;
      const twoWeeks = new Date();
      twoWeeks.setDate(twoWeeks.getDate() + 14);
      return { ...n, extracted_actions: [...n.extracted_actions, {
        id: `ea-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        text: actionText + (parentTaskId ? ' (sub-task)' : ''),
        due_date: twoWeeks.toISOString().split('T')[0],
        accepted: true,
        dismissed: false,
      }] };
    }));
  };

  const t = { heading: 'text-fq-dark/90', body: 'text-fq-muted/90', light: 'text-fq-muted/70', icon: 'text-fq-muted/60' };

  return (
    <div className="bg-fq-card rounded-xl border border-fq-border shadow-sm p-6">
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => setCollapsed(!collapsed)} className="flex items-center gap-3 group">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={`${t.light} transition-transform duration-200 ${collapsed ? '-rotate-90' : ''}`}><path d="M3 5l3 3 3-3" /></svg>
          <span className={`${t.icon} text-[16px]`}>📄</span>
          <h2 className={`font-heading text-[20px] font-semibold ${t.heading} group-hover:text-fq-accent transition-colors`}>Call Notes</h2>
          <span className="text-[12px] font-body text-fq-muted bg-fq-bg px-2 py-0.5 rounded-full">{notes.length}</span>
        </button>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowNewNote(!showNewNote)} className={`flex items-center gap-1.5 font-body text-[13px] ${t.light} hover:text-fq-dark px-3 py-2 rounded-lg border border-fq-border hover:border-fq-dark/20 transition-colors`}>+ New Note</button>
          <input ref={fileInputRef} type="file" accept=".txt,.md,.doc,.docx,.pdf,.rtf" className="hidden" onChange={handleUpload} />
          <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="flex items-center gap-1.5 bg-fq-dark text-white font-body text-[13px] font-medium px-4 py-2 rounded-lg hover:bg-fq-dark/90 transition-colors disabled:opacity-60">
            {uploading ? '⟳ Parsing...' : '↑ Upload Notes'}
          </button>
        </div>
      </div>

      {!collapsed && (
        <>
          {showNewNote && (
            <div className="mb-6 border border-fq-accent/30 rounded-xl p-4 bg-fq-bg/30">
              <div className="flex items-center justify-between mb-3">
                <h4 className={`font-body text-[14px] font-semibold ${t.heading}`}>New Note</h4>
                <div className="flex items-center gap-2">
                  <button onClick={() => setShowNewNote(false)} className={`font-body text-[12px] ${t.light} hover:text-fq-dark`}>Cancel</button>
                  <button onClick={addNewNote} className="font-body text-[12px] font-medium bg-fq-dark text-white px-3 py-1.5 rounded-lg hover:bg-fq-dark/90 transition-colors">Save Note</button>
                </div>
              </div>
              <RichTextEditor initialContent={newNoteContent} onChange={setNewNoteContent} placeholder="Paste or type your call notes here..." />
              <div className="mt-3">
                <ActionItemsPanel noteContent={newNoteContent} tasks={tasks} onAccept={() => {}} />
              </div>
            </div>
          )}

          <div className="space-y-0">
            {notes.map((note) => {
              const isNoteCollapsed = collapsedNotes.has(note.id);
              const autoSummaryBullets = !note.summary ? generateSummaryBullets(note.raw_text.replace(/<[^>]+>/g, ' ')) : null;

              return (
                <div key={note.id} className="border-l-[3px] border-fq-accent/40 pl-5 py-5 first:pt-0">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <button onClick={() => toggleNoteCollapse(note.id)} className="shrink-0">
                        <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={`${t.light} transition-transform duration-200 ${isNoteCollapsed ? '-rotate-90' : ''}`}><path d="M3 5l3 3 3-3" /></svg>
                      </button>
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <EditableField
                          value={note.date}
                          onChange={(v) => updateNote(note.id, { date: v })}
                          className={`font-body text-[14px] font-semibold ${t.heading} shrink-0`}
                          placeholder="YYYY-MM-DD"
                        />
                        {note.title && (
                          <>
                            <span className={`${t.light} text-[12px]`}>—</span>
                            <EditableField
                              value={note.title}
                              onChange={(v) => updateNote(note.id, { title: v })}
                              className={`font-body text-[13px] ${t.light} truncate`}
                              placeholder="Add title..."
                            />
                          </>
                        )}
                        {!note.title && (
                          <EditableField
                            value=""
                            onChange={(v) => updateNote(note.id, { title: v })}
                            className={`font-body text-[12px] ${t.light}`}
                            placeholder="Add title..."
                          />
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => navigator.clipboard.writeText(note.summary || decodeHtmlEntities(note.raw_text.replace(/<[^>]+>/g, ' ')))} className={`font-body text-[12px] ${t.light} hover:text-fq-dark transition-colors flex items-center gap-1`}>📋 Copy</button>
                      <button onClick={() => deleteNote(note.id)} className={`font-body text-[12px] text-fq-muted/40 hover:text-fq-alert transition-colors flex items-center gap-1`}>🗑</button>
                      <ActionItemsPanel noteContent={note.raw_text} tasks={tasks} onAccept={(item, parentId) => handleAcceptAction(note.id, item, parentId)} />
                    </div>
                  </div>

                  {!isNoteCollapsed && (
                    <div onDoubleClick={() => setExpandedNote(note)} className="cursor-default" title="Double-click to expand">
                      {/* Summary — click to edit inline */}
                      {note.summary ? (
                        <div className="mb-3">
                          <EditableSummary
                            value={note.summary}
                            onChange={(v) => updateNote(note.id, { summary: v })}
                            textClass={`font-body text-[13px] ${t.body} leading-relaxed`}
                          />
                        </div>
                      ) : autoSummaryBullets && autoSummaryBullets.length > 0 && (
                        <div className="mb-3">
                          <span className={`font-body text-[10px] ${t.light} uppercase tracking-wider`}>Auto-summary</span>
                          <EditableSummary
                            value={autoSummaryBullets.join('\n')}
                            onChange={(v) => updateNote(note.id, { summary: v })}
                            bullets={autoSummaryBullets}
                            textClass={`font-body text-[13px] ${t.body} leading-relaxed`}
                          />
                        </div>
                      )}

                      {/* Show raw text preview (truncated) for notes with summary */}
                      {note.summary && (
                        <div
                          className={`font-body text-[12px] ${t.light} leading-relaxed line-clamp-3 mb-4 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5`}
                          dangerouslySetInnerHTML={{ __html: note.raw_text }}
                        />
                      )}

                      {note.extracted_actions.length > 0 && (
                        <div className="mt-3">
                          <p className={`font-body text-[12px] font-medium ${t.heading} mb-2`}>
                            Extracted Actions ({note.extracted_actions.filter(a => a.accepted).length} accepted)
                          </p>
                          <div className="space-y-1.5">
                            {note.extracted_actions.map((action) => (
                              <div key={action.id} className="flex items-center gap-2">
                                <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${action.accepted ? 'bg-fq-accent text-white' : action.dismissed ? 'bg-fq-border' : 'border border-fq-border'}`}>
                                  {action.accepted && (<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 5l2.5 2.5L8 3" /></svg>)}
                                </div>
                                <span className={`font-body text-[12px] ${action.dismissed ? 'line-through text-fq-muted/50' : t.body}`}>{action.text}</span>
                                <span className={`font-body text-[11px] ${t.light} ml-1`}>— due {formatDate(action.due_date)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Note Detail Modal */}
      {expandedNote && (
        <NoteDetailModal
          note={expandedNote}
          onClose={() => setExpandedNote(null)}
          tasks={tasks}
          onAcceptAction={handleAcceptAction}
          onDelete={(id) => { deleteNote(id); setExpandedNote(null); }}
          onUpdate={updateNote}
        />
      )}
    </div>
  );
}

/* ─────────────── Main Page ─────────────── */
export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const project = projects.find(p => p.id === projectId);
  const activeProjects = projects.filter(p => p.status === 'active' && (p.type === 'client' || p.type === 'shoot'));

  if (!project) {
    return (
      <div className="px-10 py-10">
        <p className="font-body text-fq-muted">Project not found.</p>
      </div>
    );
  }

  const t = { light: 'text-fq-muted/70' };

  return (
    <div className="px-10 py-8">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/" className={`font-body text-[13px] ${t.light} hover:text-fq-dark transition-colors flex items-center gap-1`}>← Back</Link>
        <span className="text-fq-border">|</span>
        <select value={projectId} onChange={(e) => router.push(`/projects/${e.target.value}`)} className="font-body text-[14px] text-fq-dark bg-fq-bg border border-fq-border rounded-lg px-3 py-1.5 outline-none cursor-pointer">
          {activeProjects.map(p => (<option key={p.id} value={p.id}>{p.name}</option>))}
        </select>
      </div>

      <div className="grid grid-cols-[1fr_340px] gap-5 mb-8">
        <HeaderCard project={project} />
        <NextCallAgenda items={project.next_call_agenda || []} />
      </div>

      {project.vendors && project.vendors.length > 0 && (
        <div className="mb-8"><VendorContacts vendors={project.vendors} /></div>
      )}

      {project.call_notes && project.call_notes.length > 0 && (
        <div className="mb-8"><CallNotesSection notes={project.call_notes} tasks={project.tasks || []} /></div>
      )}
    </div>
  );
}
