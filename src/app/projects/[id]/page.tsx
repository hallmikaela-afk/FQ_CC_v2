'use client';
/* Task table v2 — inline filters, status system, subtasks */
import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Mail } from 'lucide-react';
import { useFullProjects } from '@/lib/hooks';
import ProjectFileUpload from '@/components/ProjectFileUpload';
import UploadModal from '@/components/UploadModal';
import ComposePanel from '@/components/inbox/ComposePanel';
import { formatCountdown, formatDate, formatMonthYear } from '@/data/seed';
import type { Project, Vendor, CallNote, Task, SubTask, TeamMember, EventDay } from '@/data/seed';
import ProjectDriveTab from '@/components/drive/ProjectDriveTab';

// Module-level team lookup — set by the main component after data loads
let getTeamMember: (id: string) => TeamMember | undefined = () => undefined;

/* ─────────────── Inline Editable Field ─────────────── */
function EditableField({
  value,
  onChange,
  onPaste,
  className = '',
  placeholder = 'Click to edit...',
}: {
  value: string;
  onChange: (v: string) => void;
  onPaste?: (e: React.ClipboardEvent<HTMLInputElement>) => void;
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
        onPaste={onPaste}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { onChange(draft); setEditing(false); }
          if (e.key === 'Escape') { setDraft(value); setEditing(false); }
        }}
        className={`bg-transparent border-b border-fq-accent/40 outline-none w-full py-0 text-fq-dark ${className}`}
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
  const [venueName, setVenueName] = useState(project.venue_name || project.location || '');
  const [venueLocation, setVenueLocation] = useState(project.venue_location || '');
  const [venueStreet, setVenueStreet] = useState(project.venue_street || '');
  const [venueCityStateZip, setVenueCityStateZip] = useState(project.venue_city_state_zip || '');
  const [guestCount, setGuestCount] = useState(project.guest_count?.toString() || '');
  const [budget, setBudget] = useState(project.estimated_budget || '');
  const [serviceTier, setServiceTier] = useState(project.service_tier || '');
  const [status, setStatus] = useState(project.status);
  const [client1Name, setClient1Name] = useState(project.client1_name || '');
  const [client2Name, setClient2Name] = useState(project.client2_name || '');
  const [client1Email, setClient1Email] = useState(project.client1_email || '');
  const [client2Email, setClient2Email] = useState(project.client2_email || '');
  const [client1Phone, setClient1Phone] = useState(project.client1_phone || '');
  const [client2Phone, setClient2Phone] = useState(project.client2_phone || '');
  const [clientStreet, setClientStreet] = useState(project.client_street || '');
  const [clientCityStateZip, setClientCityStateZip] = useState(project.client_city_state_zip || '');

  const patchProject = (updates: Record<string, unknown>) => {
    fetch('/api/projects', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: project.id, ...updates }) });
  };

  const t = {
    heading: 'text-fq-dark/90',
    body: 'text-fq-muted/90',
    light: 'text-fq-muted/70',
    icon: 'text-fq-muted/60',
    label: 'font-body text-[11px] text-fq-muted/60 uppercase tracking-wide',
  };

  return (
    <div className="bg-fq-card rounded-xl border border-fq-border shadow-sm p-6">
      <div className="flex items-start justify-between mb-1">
        <div className="flex items-center gap-3">
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: project.color }} />
          <h1 className={`font-heading text-[28px] font-bold ${t.heading}`}>
            {project.name}
          </h1>
          <select
            value={status}
            onChange={(e) => { const s = e.target.value as typeof status; setStatus(s); patchProject({ status: s }); }}
            className="text-[11px] font-body font-medium text-fq-accent bg-fq-light-accent px-2.5 py-0.5 rounded-full border-0 outline-none cursor-pointer appearance-none"
          >
            <option value="active">active</option>
            <option value="completed">completed</option>
            <option value="archived">archived</option>
          </select>
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
          onChange={(v) => { setConcept(v); patchProject({ concept: v }); }}
          className={`font-body text-[13px] ${t.light} italic`}
          placeholder="Click to add concept..."
        />
      </div>

      <div className="border-t border-fq-border my-4" />

      {/* Quick stats row */}
      <div className="flex items-center gap-6 mb-4 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className={`${t.icon} text-[13px]`}>♗</span>
          <EditableField value={guestCount ? `${guestCount} guests` : ''} onChange={(v) => { const n = v.replace(/[^0-9]/g, ''); setGuestCount(n); patchProject({ guest_count: n ? parseInt(n) : null }); }} className={`font-body text-[13px] ${t.body}`} placeholder="Guest count..." />
        </div>
        <EditableField value={budget ? `${budget} budget` : ''} onChange={(v) => { const b = v.replace(' budget', ''); setBudget(b); patchProject({ estimated_budget: b }); }} className={`font-body text-[13px] ${t.body}`} placeholder="Budget..." />
        <EditableField value={serviceTier} onChange={(v) => { setServiceTier(v); patchProject({ service_tier: v }); }} className="text-[11px] font-body font-medium text-fq-accent bg-fq-light-accent px-2.5 py-0.5 rounded-full" placeholder="Service tier..." />
      </div>

      {/* Venue + Client details */}
      <div className="grid grid-cols-2 gap-6 mb-4">
        {/* Venue */}
        <div>
          <p className={`${t.label} mb-2`}>Venue</p>
          <div className="space-y-1.5">
            <EditableField value={venueName} onChange={(v) => { setVenueName(v); patchProject({ venue_name: v }); }} className={`font-body text-[13px] font-medium ${t.body} block w-full`} placeholder="Venue name..." />
            <EditableField value={venueLocation} onChange={(v) => { setVenueLocation(v); patchProject({ venue_location: v }); }} className={`font-body text-[13px] ${t.light} block w-full`} placeholder="City, State..." />
            <EditableField
              value={venueStreet}
              onChange={(v) => { setVenueStreet(v); patchProject({ venue_street: v }); }}
              onPaste={(e) => {
                const text = e.clipboardData.getData('text');
                const lines = text.split('\n').map((l: string) => l.trim()).filter(Boolean);
                if (lines.length > 1) {
                  e.preventDefault();
                  setVenueStreet(lines[0]);
                  setVenueCityStateZip(lines.slice(1).join(', '));
                  patchProject({ venue_street: lines[0], venue_city_state_zip: lines.slice(1).join(', ') });
                }
              }}
              className={`font-body text-[13px] ${t.light} block w-full`}
              placeholder="Street address (paste full address here)..."
            />
            <EditableField value={venueCityStateZip} onChange={(v) => { setVenueCityStateZip(v); patchProject({ venue_city_state_zip: v }); }} className={`font-body text-[13px] ${t.light} block w-full`} placeholder="City, State ZIP..." />
            {(venueStreet || venueCityStateZip) && (
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent([venueStreet, venueCityStateZip].filter(Boolean).join(', '))}`}
                target="_blank"
                rel="noopener noreferrer"
                className={`font-body text-[11px] ${t.light} hover:text-fq-accent transition-colors`}
              >
                Open in Maps ↗
              </a>
            )}
          </div>
        </div>

        {/* Clients */}
        <div>
          <p className={`${t.label} mb-2`}>Clients</p>
          <div className="space-y-2">
            <div className="space-y-1">
              <EditableField value={client1Name} onChange={(v) => { setClient1Name(v); patchProject({ client1_name: v }); }} className={`font-body text-[13px] font-medium ${t.body} block w-full`} placeholder="Client 1 name..." />
              <div className="flex gap-3">
                <EditableField value={client1Email} onChange={(v) => { setClient1Email(v); patchProject({ client1_email: v }); }} className={`font-body text-[12px] ${t.light} flex-1`} placeholder="Email..." />
                <EditableField value={client1Phone} onChange={(v) => { setClient1Phone(v); patchProject({ client1_phone: v }); }} className={`font-body text-[12px] ${t.light} flex-1`} placeholder="Phone..." />
              </div>
            </div>
            <div className="space-y-1">
              <EditableField value={client2Name} onChange={(v) => { setClient2Name(v); patchProject({ client2_name: v }); }} className={`font-body text-[13px] font-medium ${t.body} block w-full`} placeholder="Client 2 name..." />
              <div className="flex gap-3">
                <EditableField value={client2Email} onChange={(v) => { setClient2Email(v); patchProject({ client2_email: v }); }} className={`font-body text-[12px] ${t.light} flex-1`} placeholder="Email..." />
                <EditableField value={client2Phone} onChange={(v) => { setClient2Phone(v); patchProject({ client2_phone: v }); }} className={`font-body text-[12px] ${t.light} flex-1`} placeholder="Phone..." />
              </div>
            </div>
            <div className="space-y-1 pt-1 border-t border-fq-border">
              <EditableField value={clientStreet} onChange={(v) => { setClientStreet(v); patchProject({ client_street: v }); }} className={`font-body text-[12px] ${t.light} block w-full`} placeholder="Client street address..." />
              <EditableField value={clientCityStateZip} onChange={(v) => { setClientCityStateZip(v); patchProject({ client_city_state_zip: v }); }} className={`font-body text-[12px] ${t.light} block w-full`} placeholder="City, State ZIP..." />
            </div>
          </div>
        </div>
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
          className={`flex-1 bg-transparent border-b border-fq-accent/40 outline-none font-body text-[13px] text-fq-dark py-0`}
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
function NextCallAgenda({ items, projectId }: { items: string[]; projectId: string }) {
  const [agenda, setAgenda] = useState(items);
  const [draft, setDraft] = useState('');
  const [copied, setCopied] = useState(false);

  const saveAgenda = (next: string[]) => {
    fetch('/api/projects', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: projectId, next_call_agenda: next }) });
  };

  const addItem = () => { if (draft.trim()) { const next = [...agenda, draft.trim()]; setAgenda(next); setDraft(''); saveAgenda(next); } };
  const updateItem = (index: number, value: string) => {
    const next = !value.trim() ? agenda.filter((_, i) => i !== index) : agenda.map((item, i) => i === index ? value : item);
    setAgenda(next); saveAgenda(next);
  };
  const removeItem = (index: number) => { const next = agenda.filter((_, i) => i !== index); setAgenda(next); saveAgenda(next); };

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
function VendorTile({
  vendor,
  onRemove,
  copyTargets,
  onCopyToDay,
}: {
  vendor: Vendor;
  onRemove: () => void;
  copyTargets?: { id: string | null; label: string }[];
  onCopyToDay?: (targetDayId: string | null) => void;
}) {
  const [name, setName] = useState(vendor.vendor_name);
  const [contact, setContact] = useState(vendor.contact_name || '');
  const [email, setEmail] = useState(vendor.email || '');
  const [phone, setPhone] = useState(vendor.phone || '');
  const [website, setWebsite] = useState(vendor.website || '');
  const [instagram, setInstagram] = useState(vendor.instagram || '');
  const [category, setCategory] = useState(vendor.category);
  const [showCopyMenu, setShowCopyMenu] = useState(false);
  const t = { heading: 'text-fq-dark/90', light: 'text-fq-muted/70', icon: 'text-fq-muted/60' };

  const patchVendor = (updates: Record<string, unknown>) => {
    fetch('/api/vendors', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: vendor.id, ...updates }) });
  };

  return (
    <div className="bg-fq-card rounded-xl border border-fq-border shadow-sm p-4 flex flex-col group/tile relative">
      <div className="flex items-center justify-between mb-2">
        <EditableField value={category} onChange={(v) => { setCategory(v); patchVendor({ category: v }); }} className="text-[11px] font-body font-medium text-fq-accent bg-fq-light-accent px-2 py-0.5 rounded-full" placeholder="Category..." />
        <div className="flex items-center gap-1 opacity-0 group-hover/tile:opacity-100 transition-opacity">
          {copyTargets && copyTargets.length > 0 && onCopyToDay && (
            <div className="relative">
              <button
                onClick={() => setShowCopyMenu(v => !v)}
                className="text-fq-muted/40 hover:text-fq-accent transition-colors"
                title="Copy to another day"
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="5" y="5" width="9" height="9" rx="1.5" />
                  <path d="M2 11V3a1 1 0 011-1h8" />
                </svg>
              </button>
              {showCopyMenu && (
                <div className="absolute right-0 top-full mt-1 z-20 bg-fq-card border border-fq-border rounded-lg shadow-lg py-1 min-w-[140px]">
                  <p className="font-body text-[10px] text-fq-muted/60 px-3 py-1 uppercase tracking-wide">Copy to</p>
                  {copyTargets.map(t => (
                    <button
                      key={String(t.id)}
                      onClick={() => { onCopyToDay(t.id); setShowCopyMenu(false); }}
                      className="w-full text-left font-body text-[12px] text-fq-dark/80 hover:bg-fq-bg px-3 py-1.5 transition-colors"
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <button onClick={onRemove} className="text-fq-muted/30 hover:text-fq-alert transition-colors" title="Remove vendor">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 4h10M5.5 4V3a1 1 0 011-1h3a1 1 0 011 1v1M6.5 7v4M9.5 7v4M4.5 4l.5 8a1 1 0 001 1h4a1 1 0 001-1l.5-8" />
            </svg>
          </button>
        </div>
      </div>
      <EditableField value={name} onChange={(v) => { setName(v); patchVendor({ vendor_name: v }); }} className={`font-body text-[15px] font-medium ${t.heading} mb-2`} placeholder="Vendor name..." />
      <div className="space-y-1 flex-1">
        <div className="flex items-center gap-1.5"><span className={`${t.icon} text-[10px] w-3 shrink-0`}>♗</span><EditableField value={contact} onChange={(v) => { setContact(v); patchVendor({ contact_name: v }); }} className={`font-body text-[12px] ${t.light}`} placeholder="Contact name..." /></div>
        <div className="flex items-center gap-1.5"><span className={`${t.icon} text-[10px] w-3 shrink-0`}>✉</span><EditableField value={email} onChange={(v) => { setEmail(v); patchVendor({ email: v }); }} className={`font-body text-[12px] ${t.light}`} placeholder="Email..." /></div>
        <div className="flex items-center gap-1.5"><span className={`${t.icon} text-[10px] w-3 shrink-0`}>☏</span><EditableField value={phone} onChange={(v) => { setPhone(v); patchVendor({ phone: v }); }} className={`font-body text-[12px] ${t.light}`} placeholder="Phone..." /></div>
        <div className="flex items-center gap-1.5"><span className={`${t.icon} text-[10px] w-3 shrink-0`}>⊕</span><EditableField value={website} onChange={(v) => { setWebsite(v); patchVendor({ website: v }); }} className={`font-body text-[12px] ${t.light}`} placeholder="Website..." /></div>
        <div className="flex items-center gap-1.5"><span className={`${t.icon} text-[10px] w-3 shrink-0`}>📷</span><EditableField value={instagram} onChange={(v) => { setInstagram(v); patchVendor({ instagram: v }); }} className={`font-body text-[12px] ${t.light}`} placeholder="@instagram..." /></div>
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

/* ─────────────── Vendor Day Section ─────────────── */
function VendorDaySection({
  dayLabel,
  venueName,
  eventDate,
  vendors,
  copyTargets,
  onAddVendor,
  onRemoveVendor,
  onCopyVendorToDay,
  onPatchDay,
  onDeleteDay,
  isMainDay,
}: {
  dayLabel: string;
  venueName: string;
  eventDate: string;
  vendors: Vendor[];
  copyTargets: { id: string | null; label: string }[];
  onAddVendor: () => void;
  onRemoveVendor: (id: string) => void;
  onCopyVendorToDay: (vendor: Vendor, targetDayId: string | null) => void;
  onPatchDay?: (updates: Record<string, string>) => void;
  onDeleteDay?: () => void;
  isMainDay: boolean;
}) {
  const [label, setLabel] = useState(dayLabel);
  const [venue, setVenue] = useState(venueName);
  const [date, setDate] = useState(eventDate);
  const t = { heading: 'text-fq-dark/90', light: 'text-fq-muted/70', muted: 'text-fq-muted/60' };

  return (
    <div className="border border-fq-border rounded-xl overflow-hidden">
      {/* Day header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-fq-bg/60 border-b border-fq-border">
        <div className="flex-1 flex items-center gap-3 min-w-0">
          {isMainDay ? (
            <span className={`font-heading text-[14px] font-semibold ${t.heading}`}>{label}</span>
          ) : (
            <EditableField
              value={label}
              onChange={(v) => { setLabel(v); onPatchDay?.({ day_name: v }); }}
              className={`font-heading text-[14px] font-semibold ${t.heading}`}
              placeholder="Day name..."
            />
          )}
          <span className={`${t.muted} text-[11px]`}>·</span>
          {isMainDay ? (
            <span className={`font-body text-[12px] ${t.light}`}>{venue || <span className="italic text-fq-border">no venue</span>}</span>
          ) : (
            <EditableField
              value={venue}
              onChange={(v) => { setVenue(v); onPatchDay?.({ venue_name: v }); }}
              className={`font-body text-[12px] ${t.light}`}
              placeholder="Venue name..."
            />
          )}
          {date && (
            <>
              <span className={`${t.muted} text-[11px]`}>·</span>
              {isMainDay ? (
                <span className={`font-body text-[11px] ${t.muted}`}>{formatDate(date)}</span>
              ) : (
                <input
                  type="date"
                  value={date}
                  onChange={(e) => { setDate(e.target.value); onPatchDay?.({ event_date: e.target.value }); }}
                  className={`font-body text-[11px] ${t.muted} bg-transparent border-none outline-none cursor-pointer`}
                />
              )}
            </>
          )}
          {!isMainDay && !date && (
            <>
              <span className={`${t.muted} text-[11px]`}>·</span>
              <input
                type="date"
                value={date}
                onChange={(e) => { setDate(e.target.value); onPatchDay?.({ event_date: e.target.value }); }}
                className={`font-body text-[11px] text-fq-border bg-transparent border-none outline-none cursor-pointer`}
                placeholder="Date..."
              />
            </>
          )}
          <span className={`font-body text-[11px] ${t.muted} bg-fq-card border border-fq-border px-1.5 py-0.5 rounded-full ml-1`}>{vendors.length}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onAddVendor}
            className={`font-body text-[12px] font-medium ${t.light} hover:text-fq-dark border border-fq-border hover:border-fq-dark/20 px-3 py-1.5 rounded-lg transition-colors`}
          >
            + Add Vendor
          </button>
          {!isMainDay && onDeleteDay && (
            <button onClick={onDeleteDay} className={`${t.muted} hover:text-fq-alert transition-colors`} title="Remove event day">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 4h10M5.5 4V3a1 1 0 011-1h3a1 1 0 011 1v1M6.5 7v4M9.5 7v4M4.5 4l.5 8a1 1 0 001 1h4a1 1 0 001-1l.5-8" />
              </svg>
            </button>
          )}
        </div>
      </div>
      {/* Vendors grid */}
      {vendors.length > 0 ? (
        <div className="grid grid-cols-3 gap-4 p-4">
          {vendors.map((vendor) => (
            <VendorTile
              key={vendor.id}
              vendor={vendor}
              onRemove={() => onRemoveVendor(vendor.id)}
              copyTargets={copyTargets}
              onCopyToDay={(targetDayId) => onCopyVendorToDay(vendor, targetDayId)}
            />
          ))}
        </div>
      ) : (
        <p className={`font-body text-[12px] ${t.muted} italic px-4 py-4`}>No vendors added yet.</p>
      )}
    </div>
  );
}

/* ─────────────── Vendor Contacts ─────────────── */
function VendorContacts({
  vendors: initialVendors,
  projectId,
  supabaseProjectId,
  eventDays: initialEventDays,
  projectVenueName,
  projectEventDate,
}: {
  vendors: Vendor[];
  projectId: string;
  supabaseProjectId: string;
  eventDays: EventDay[];
  projectVenueName: string;
  projectEventDate: string;
}) {
  const [vendors, setVendors] = useState(initialVendors);
  const [eventDays, setEventDays] = useState(initialEventDays);
  const [collapsed, setCollapsed] = useState(true);
  // addModal: null = closed, 'main' = day 1, or event_day id string
  const [addModalFor, setAddModalFor] = useState<string | null>(null);
  const [copiedCredits, setCopiedCredits] = useState(false);

  const removeVendor = (id: string) => {
    setVendors(prev => prev.filter(v => v.id !== id));
    fetch(`/api/vendors?id=${id}`, { method: 'DELETE' });
  };

  const addVendor = async (vendor: Vendor, eventDayId: string | null) => {
    const payload = { ...vendor, project_id: supabaseProjectId, event_day_id: eventDayId };
    const res = await fetch('/api/vendors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const [saved] = await res.json();
    setVendors(prev => [...prev, saved]);
  };

  const copyVendorToDay = async (vendor: Vendor, targetDayId: string | null) => {
    const payload = {
      project_id: supabaseProjectId,
      event_day_id: targetDayId,
      category: vendor.category,
      vendor_name: vendor.vendor_name,
      contact_name: vendor.contact_name,
      email: vendor.email,
      phone: vendor.phone,
      website: vendor.website,
      instagram: vendor.instagram,
    };
    const res = await fetch('/api/vendors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const [saved] = await res.json();
    setVendors(prev => [...prev, saved]);
  };

  const addEventDay = async () => {
    const res = await fetch('/api/event-days', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: supabaseProjectId, day_name: `Day ${eventDays.length + 2}`, sort_order: eventDays.length }),
    });
    const day = await res.json();
    setEventDays(prev => [...prev, day]);
    setCollapsed(false);
  };

  const patchEventDay = (id: string, updates: Record<string, string>) => {
    setEventDays(prev => prev.map(d => d.id === id ? { ...d, ...updates } : d));
    fetch('/api/event-days', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...updates }) });
  };

  const deleteEventDay = async (id: string) => {
    setEventDays(prev => prev.filter(d => d.id !== id));
    setVendors(prev => prev.filter(v => v.event_day_id !== id));
    fetch(`/api/event-days?id=${id}`, { method: 'DELETE' });
  };

  const downloadCSV = () => {
    const headers = ['Category', 'Vendor Name', 'Contact Name', 'Email', 'Phone', 'Website', 'Instagram', 'Event Day'];
    const dayName = (id: string | null | undefined) => {
      if (!id) return 'Day 1';
      return eventDays.find(d => d.id === id)?.day_name || id;
    };
    const rows = vendors.map(v => [v.category, v.vendor_name, v.contact_name || '', v.email || '', v.phone || '', v.website || '', v.instagram || '', dayName(v.event_day_id)]);
    const csv = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
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

  // Build copy targets for each day slot
  const allDaySlots = [
    { id: null, label: 'Day 1' + (projectVenueName ? ` — ${projectVenueName}` : '') },
    ...eventDays.map(d => ({ id: d.id, label: d.day_name + (d.venue_name ? ` — ${d.venue_name}` : '') })),
  ];

  const copyTargetsFor = (currentDayId: string | null) =>
    allDaySlots.filter(s => s.id !== currentDayId);

  const hasMultipleDays = eventDays.length > 0;

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
          <button
            onClick={addEventDay}
            className={`flex items-center gap-1.5 font-body text-[13px] ${t.light} hover:text-fq-dark px-3 py-2 rounded-lg border border-fq-border hover:border-fq-dark/20 transition-colors`}
          >
            + Add Event Day
          </button>
          <button onClick={copyVendorCredits} className={`flex items-center gap-1.5 font-body text-[13px] ${copiedCredits ? 'text-fq-accent' : t.light} hover:text-fq-dark px-3 py-2 rounded-lg border border-fq-border hover:border-fq-dark/20 transition-colors`}>
            {copiedCredits ? '✓ Copied!' : '📋 Copy Credits'}
          </button>
          <button onClick={downloadCSV} className={`flex items-center gap-1.5 font-body text-[13px] ${t.light} hover:text-fq-dark px-3 py-2 rounded-lg border border-fq-border hover:border-fq-dark/20 transition-colors`}>↓ Download CSV</button>
          {!hasMultipleDays && (
            <button onClick={() => setAddModalFor('main')} className="flex items-center gap-1.5 bg-fq-dark text-white font-body text-[13px] font-medium px-4 py-2 rounded-lg hover:bg-fq-dark/90 transition-colors">+ Add Vendor</button>
          )}
        </div>
      </div>

      {!collapsed && (
        hasMultipleDays ? (
          <div className="space-y-4">
            {/* Day 1 — project-level venue */}
            <VendorDaySection
              dayLabel="Day 1"
              venueName={projectVenueName}
              eventDate={projectEventDate}
              vendors={vendors.filter(v => !v.event_day_id)}
              copyTargets={copyTargetsFor(null)}
              onAddVendor={() => setAddModalFor('main')}
              onRemoveVendor={removeVendor}
              onCopyVendorToDay={(vendor, targetDayId) => copyVendorToDay(vendor, targetDayId)}
              isMainDay={true}
            />
            {/* Additional event days */}
            {eventDays.map((day) => (
              <VendorDaySection
                key={day.id}
                dayLabel={day.day_name}
                venueName={day.venue_name || ''}
                eventDate={day.event_date || ''}
                vendors={vendors.filter(v => v.event_day_id === day.id)}
                copyTargets={copyTargetsFor(day.id)}
                onAddVendor={() => setAddModalFor(day.id)}
                onRemoveVendor={removeVendor}
                onCopyVendorToDay={(vendor, targetDayId) => copyVendorToDay(vendor, targetDayId)}
                onPatchDay={(updates) => patchEventDay(day.id, updates)}
                onDeleteDay={() => deleteEventDay(day.id)}
                isMainDay={false}
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {vendors.map((vendor) => (
              <VendorTile key={vendor.id} vendor={vendor} onRemove={() => removeVendor(vendor.id)} />
            ))}
          </div>
        )
      )}

      <AddVendorModal
        open={addModalFor !== null}
        onClose={() => setAddModalFor(null)}
        onAdd={(vendor) => {
          const dayId = addModalFor === 'main' ? null : addModalFor;
          addVendor(vendor, dayId);
          setAddModalFor(null);
        }}
      />
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
  const [analyzing, setAnalyzing] = useState(false);

  const analyze = () => {
    setAnalyzing(true);
    setTimeout(() => {
      const plainText = noteContent.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ');
      setItems(extractActionItems(plainText));
      setAnalyzing(false);
    }, 600);
  };

  const acceptItem = (item: string) => {
    const matchedTask = findMatchingTask(item, tasks);
    onAccept(item, matchedTask?.id);
    setItems(items.filter(i => i !== item));
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
          return (
            <div key={i} className="flex items-start gap-2 group/action">
              <button onClick={() => acceptItem(item)}
                className="w-5 h-5 rounded flex items-center justify-center shrink-0 mt-0.5 transition-colors border border-fq-border hover:border-fq-accent hover:bg-fq-accent hover:text-white"
                title="Add to task list"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-0 group-hover/action:opacity-100"><path d="M2 5h6M5 2v6" /></svg>
              </button>
              <div className="flex-1 min-w-0">
                <span className={`font-body text-[12px] ${t.body}`}>{item}</span>
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
                value={formatDate(note.date)}
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

/* ─────────────── Editable Summary (click to edit, rich text) ─────────────── */
function EditableSummary({ value, onChange, bullets, textClass }: { value: string; onChange: (v: string) => void; bullets?: string[]; textClass: string }) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <div className="mt-1" onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
        <RichTextEditor
          initialContent={value || (bullets ? bullets.map(b => `<p>${b}</p>`).join('') : '')}
          onChange={onChange}
          placeholder="Add summary..."
        />
        <button
          onClick={() => setEditing(false)}
          className="mt-1 font-body text-[11px] text-fq-accent hover:text-fq-dark transition-colors"
        >
          Done editing
        </button>
      </div>
    );
  }

  if (bullets && bullets.length > 0) {
    return (
      <ul className="mt-1 space-y-0.5 cursor-text hover:bg-fq-bg/30 rounded p-1 -m-1 transition-colors" onClick={(e) => { e.stopPropagation(); setEditing(true); }}>
        {bullets.map((bullet, i) => (
          <li key={i} className={`${textClass} flex gap-2`}>
            <span className="text-fq-accent shrink-0">•</span>
            <span>{bullet}</span>
          </li>
        ))}
      </ul>
    );
  }

  if (value) {
    return (
      <div
        className={`${textClass} cursor-text hover:bg-fq-bg/30 rounded p-1 -m-1 transition-colors [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5 [&_strong]:font-semibold [&_em]:italic [&_u]:underline`}
        onClick={(e) => { e.stopPropagation(); setEditing(true); }}
        dangerouslySetInnerHTML={{ __html: value }}
      />
    );
  }

  return (
    <p className={`${textClass} cursor-text hover:bg-fq-bg/30 rounded p-1 -m-1 transition-colors text-fq-border italic`} onClick={(e) => { e.stopPropagation(); setEditing(true); }}>
      Click to add summary...
    </p>
  );
}

/* ─────────────── Call Notes ─────────────── */
function CallNotesSection({ notes: initialNotes, tasks, projectId }: { notes: CallNote[]; tasks: Task[]; projectId: string }) {
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

  const deleteNote = (id: string) => {
    if (!confirm('Delete this call note?')) return;
    setNotes(notes.filter(n => n.id !== id));
    fetch(`/api/call-notes?id=${id}`, { method: 'DELETE' });
  };

  const updateNote = (id: string, updates: Partial<CallNote>) => {
    setNotes(notes.map(n => n.id === id ? { ...n, ...updates } : n));
    if (expandedNote && expandedNote.id === id) {
      setExpandedNote({ ...expandedNote, ...updates });
    }
    fetch('/api/call-notes', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...updates }) });
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

      const notePayload = { project_id: projectId, date: new Date().toISOString().split('T')[0], raw_text: text };
      const res = await fetch('/api/call-notes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(notePayload) });
      const newNote: CallNote = await res.json();
      setNotes([{ ...newNote, extracted_actions: newNote.extracted_actions || [] }, ...notes]);
    } catch (err) {
      console.error('Upload parse error:', err);
      alert('Could not parse file. Please try a different format.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const addNewNote = async () => {
    if (!newNoteContent.replace(/<[^>]+>/g, '').trim()) return;
    const notePayload = { project_id: projectId, date: new Date().toISOString().split('T')[0], raw_text: newNoteContent };
    const res = await fetch('/api/call-notes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(notePayload) });
    const newNote: CallNote = await res.json();
    setNotes([{ ...newNote, extracted_actions: [] }, ...notes]);
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
                          value={formatDate(note.date)}
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

/* ─────────────── Inline Cell Editor ─────────────── */
function InlineCell({ value, onSave, className = '', type = 'text', options, placeholder, displayValue }: {
  value: string;
  onSave: (v: string) => void;
  className?: string;
  type?: 'text' | 'date' | 'select';
  options?: { value: string; label: string }[];
  placeholder?: string;
  displayValue?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement | HTMLSelectElement>(null);
  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);

  if (!editing) {
    return (
      <span
        onClick={(e) => { e.stopPropagation(); setDraft(value); setEditing(true); }}
        className={`cursor-pointer select-none hover:ring-1 hover:ring-fq-accent/30 hover:rounded px-0.5 -mx-0.5 ${className}`}
      >
        {(displayValue || value) || <span className="text-fq-muted/30 italic">{placeholder || '—'}</span>}
      </span>
    );
  }

  const commit = () => { onSave(draft); setEditing(false); };
  const cancel = () => { setDraft(value); setEditing(false); };

  if (type === 'select' && options) {
    return (
      <select
        ref={ref as React.RefObject<HTMLSelectElement>}
        value={draft}
        onChange={(e) => { onSave(e.target.value); setEditing(false); }}
        onBlur={cancel}
        className="font-body text-[12px] bg-white border border-fq-accent/40 rounded px-1 py-0.5 outline-none w-full"
      >
        <option value="">—</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  }

  return (
    <input
      ref={ref as React.RefObject<HTMLInputElement>}
      type={type}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel(); }}
      className="font-body text-[12px] bg-white border border-fq-accent/40 rounded px-1 py-0.5 outline-none w-full"
      placeholder={placeholder}
    />
  );
}

/* ─────────────── Task Detail Panel ─────────────── */
function TaskDetailPanel({ task, onClose, onUpdate, categories, assignedTo }: {
  task: Task;
  onClose: () => void;
  onUpdate: (updated: Task) => void;
  categories: string[];
  assignedTo: string[];
}) {
  const t = { heading: 'text-fq-dark/90', body: 'text-fq-muted/90', light: 'text-fq-muted/70' };
  const [notes, setNotes] = useState(task.notes || '');
  const [newSubtask, setNewSubtask] = useState('');

  useEffect(() => { setNotes(task.notes || ''); }, [task.id, task.notes]);

  const update = (patch: Partial<Task>) => onUpdate({ ...task, ...patch });

  const statusColors: Record<string, string> = {
    in_progress: 'bg-[#F5C242] text-white',
    delayed: 'bg-[#E8746A] text-white',
    completed: 'bg-[#4CAF6A] text-white',
  };
  const statusLabels: Record<string, string> = {
    in_progress: 'In Progress',
    delayed: 'Delayed',
    completed: 'Completed',
  };
  const taskStatus = task.status || '';

  const addSubtask = () => {
    if (!newSubtask.trim()) return;
    const st: SubTask = { id: `st-${Date.now()}`, text: newSubtask.trim(), completed: false };
    update({ subtasks: [...(task.subtasks || []), st] });
    setNewSubtask('');
  };

  const toggleSubtask = (stId: string) => {
    update({ subtasks: (task.subtasks || []).map(s => s.id === stId ? { ...s, completed: !s.completed } : s) });
  };

  const removeSubtask = (stId: string) => {
    update({ subtasks: (task.subtasks || []).filter(s => s.id !== stId) });
  };

  const saveNotes = () => update({ notes });

  const subtasks = task.subtasks || [];
  const stDone = subtasks.filter(s => s.completed).length;

  return (
    <div className="w-[340px] border-l border-fq-border bg-white p-4 overflow-y-auto flex flex-col gap-4 shrink-0 sticky top-0 max-h-screen">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <InlineCell
          value={task.text}
          onSave={(v) => update({ text: v })}
          className={`font-body text-[15px] font-medium flex-1 ${task.status === 'completed' ? 'text-fq-muted/50 line-through' : t.heading}`}
          placeholder="Task name..."
        />
        <button onClick={onClose} className="text-fq-muted/40 hover:text-fq-dark text-[16px] shrink-0 mt-0.5">✕</button>
      </div>

      {/* Fields */}
      <div className="grid grid-cols-[90px_1fr] gap-y-3 gap-x-2 items-center">
        <span className={`font-body text-[11px] ${t.light} uppercase tracking-wide`}>Status</span>
        <InlineCell
          value={taskStatus}
          onSave={(v) => update({ status: (v as Task['status']) || undefined, completed: v === 'completed' })}
          type="select"
          options={[{ value: '', label: '—' }, { value: 'in_progress', label: 'In Progress' }, { value: 'delayed', label: 'Delayed' }, { value: 'completed', label: 'Completed' }]}
          displayValue={statusLabels[taskStatus] || '—'}
          className={`font-body text-[11px] ${statusColors[taskStatus] || `text-fq-muted/70 bg-fq-bg`} px-2.5 py-0.5 rounded-full inline-block`}
          placeholder="Set status..."
        />

        <span className={`font-body text-[11px] ${t.light} uppercase tracking-wide`}>Category</span>
        <InlineCell
          value={task.category || ''}
          onSave={(v) => update({ category: v || undefined })}
          type="select"
          options={categories.map(c => ({ value: c, label: c }))}
          className={`font-body text-[12px] ${t.body}`}
          placeholder="Select..."
        />

        <span className={`font-body text-[11px] ${t.light} uppercase tracking-wide`}>Due Date</span>
        <InlineCell
          value={task.due_date || ''}
          onSave={(v) => update({ due_date: v || undefined })}
          type="date"
          displayValue={task.due_date ? formatDate(task.due_date) : ''}
          className={`font-body text-[12px] ${t.body}`}
          placeholder="Set date..."
        />

        <span className={`font-body text-[11px] ${t.light} uppercase tracking-wide`}>Priority</span>
        <InlineCell
          value={task.priority || ''}
          onSave={(v) => update({ priority: (v as Task['priority']) || undefined })}
          type="select"
          options={[{ value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }]}
          className={`font-body text-[12px] ${t.body}`}
          placeholder="Set priority..."
        />

        <span className={`font-body text-[11px] ${t.light} uppercase tracking-wide`}>Assigned</span>
        <InlineCell
          value={task.assigned_to || ''}
          onSave={(v) => update({ assigned_to: v || undefined })}
          type="select"
          options={assignedTo.map(id => { const m = getTeamMember(id); return { value: id, label: m?.name || id }; })}
          displayValue={task.assigned_to ? (getTeamMember(task.assigned_to)?.name || task.assigned_to) : ''}
          className={`font-body text-[12px] ${t.body}`}
          placeholder="Assign..."
        />
      </div>

      {/* Subtasks */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className={`font-body text-[12px] font-semibold ${t.heading}`}>
            Subtasks {subtasks.length > 0 && <span className={`font-normal ${t.light}`}>{stDone}/{subtasks.length}</span>}
          </span>
        </div>
        {subtasks.length > 0 && (
          <div className="mb-2 space-y-1">
            {subtasks.map(st => (
              <div key={st.id} className="flex items-center gap-2 group/st py-1 px-1 rounded hover:bg-fq-bg/50">
                <button
                  onClick={() => toggleSubtask(st.id)}
                  className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                    st.completed ? 'bg-fq-accent border-fq-accent text-white' : 'border-fq-border hover:border-fq-accent'
                  }`}
                >
                  {st.completed && (
                    <svg width="8" height="8" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 5l2.5 2.5L8 3" /></svg>
                  )}
                </button>
                <span className={`font-body text-[12px] flex-1 ${st.completed ? 'text-fq-muted/50 line-through' : t.body}`}>{st.text}</span>
                <button onClick={() => removeSubtask(st.id)} className="text-fq-muted/30 hover:text-fq-alert text-[10px] opacity-0 group-hover/st:opacity-100 transition-opacity">✕</button>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <input
            value={newSubtask}
            onChange={(e) => setNewSubtask(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addSubtask(); }}
            placeholder="Add subtask..."
            className={`flex-1 font-body text-[12px] ${t.body} bg-fq-bg border border-fq-border rounded-lg px-2.5 py-1.5 outline-none focus:border-fq-accent/40 placeholder:text-fq-muted/40`}
          />
          <button onClick={addSubtask} disabled={!newSubtask.trim()} className="font-body text-[11px] text-fq-accent hover:text-fq-dark disabled:opacity-30 transition-colors">+ Add</button>
        </div>
      </div>

      {/* Notes */}
      <div>
        <span className={`font-body text-[12px] font-semibold ${t.heading} block mb-2`}>Notes</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={saveNotes}
          placeholder="Add notes..."
          rows={4}
          className={`w-full font-body text-[12px] ${t.body} bg-fq-bg border border-fq-border rounded-lg px-3 py-2 outline-none focus:border-fq-accent/40 resize-none placeholder:text-fq-muted/40`}
        />
      </div>
    </div>
  );
}

/* ─────────────── Task List Section ─────────────── */
function TaskListSection({ tasks: initialTasks, projectColor, assignedTo, projectId }: { tasks: Task[]; projectColor: string; assignedTo: string[]; projectId: string }) {
  const [tasks, setTasks] = useState(initialTasks);
  const [tab, setTab] = useState<'all' | 'open' | 'done'>('open');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [teamFilter, setTeamFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [groupBy, setGroupBy] = useState<'category' | 'date'>('date');
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const [kanbanGroupField, setKanbanGroupField] = useState<'category' | 'date' | 'assigned_to' | 'status'>('category');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [expandedSubtasks, setExpandedSubtasks] = useState<Set<string>>(new Set());
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTaskText, setNewTaskText] = useState('');
  const [newTaskDue, setNewTaskDue] = useState('');
  const [newTaskCategory, setNewTaskCategory] = useState('');
  const [newTaskAssigned, setNewTaskAssigned] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState('');
  const [newTaskNotes, setNewTaskNotes] = useState('');
  const [newTaskStatus, setNewTaskStatus] = useState('in_progress');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [addingSubtaskFor, setAddingSubtaskFor] = useState<string | null>(null);
  const [inlineSubtaskText, setInlineSubtaskText] = useState('');

  const t = {
    heading: 'text-fq-dark/90',
    body: 'text-fq-muted/90',
    light: 'text-fq-muted/70',
    icon: 'text-fq-muted/60',
  };

  const statusColors: Record<string, string> = {
    in_progress: 'bg-[#F5C242] text-white',
    delayed: 'bg-[#E8746A] text-white',
    completed: 'bg-[#4CAF6A] text-white',
  };
  const statusLabels: Record<string, string> = {
    in_progress: 'In Progress',
    delayed: 'Delayed',
    completed: 'Completed',
  };

  // Category color palette
  const categoryColorPalette = [
    { text: 'text-fq-sage', bg: 'bg-fq-sage-light', border: 'border-fq-sage/20' },
    { text: 'text-fq-rose', bg: 'bg-fq-rose-light', border: 'border-fq-rose/20' },
    { text: 'text-fq-blue', bg: 'bg-fq-blue-light', border: 'border-fq-blue/20' },
    { text: 'text-fq-plum', bg: 'bg-fq-plum-light', border: 'border-fq-plum/20' },
    { text: 'text-fq-amber', bg: 'bg-fq-amber-light', border: 'border-fq-amber/20' },
    { text: 'text-fq-teal', bg: 'bg-fq-teal-light', border: 'border-fq-teal/20' },
    { text: 'text-fq-accent', bg: 'bg-fq-light-accent', border: 'border-fq-accent/20' },
    { text: 'text-fq-alert', bg: 'bg-fq-alert/10', border: 'border-fq-alert/20' },
  ];
  const categoryColorMap = new Map<string, typeof categoryColorPalette[0]>();
  const getCategoryColor = (cat: string) => {
    if (!categoryColorMap.has(cat)) {
      categoryColorMap.set(cat, categoryColorPalette[categoryColorMap.size % categoryColorPalette.length]);
    }
    return categoryColorMap.get(cat)!;
  };

  const addTask = async () => {
    if (!newTaskText.trim()) return;
    const taskData = {
      text: newTaskText.trim(),
      project_id: projectId,
      completed: newTaskStatus === 'completed',
      status: (newTaskStatus as Task['status']) || undefined,
      due_date: newTaskDue || undefined,
      category: newTaskCategory || undefined,
      assigned_to: newTaskAssigned || undefined,
      priority: (newTaskPriority as Task['priority']) || undefined,
      notes: newTaskNotes || undefined,
    };
    const res = await fetch('/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(taskData) });
    const saved = await res.json();
    setTasks(prev => [...prev, { ...saved, subtasks: [] }]);
    setNewTaskText('');
    setNewTaskDue('');
    setNewTaskCategory('');
    setNewTaskAssigned('');
    setNewTaskPriority('');
    setNewTaskNotes('');
    setNewTaskStatus('in_progress');
    setShowAddTask(false);
  };

  const updateTask = (updated: Task) => {
    setTasks(prev => prev.map(tk => tk.id === updated.id ? updated : tk));
    fetch('/api/tasks', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) });
  };

  const updateTaskField = (taskId: string, field: keyof Task, value: unknown) => {
    const dbValue = value === '' ? null : value;
    setTasks(prev => prev.map(tk => {
      if (tk.id !== taskId) return tk;
      const updated = { ...tk, [field]: dbValue };
      if (field === 'status') {
        updated.completed = dbValue === 'completed';
      }
      return updated;
    }));
    // Persist to database
    const updates: Record<string, unknown> = { [field]: dbValue };
    if (field === 'status') updates.completed = dbValue === 'completed';
    fetch('/api/tasks', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: taskId, ...updates }) });
  };

  const toggleTaskComplete = (taskId: string) => {
    const task = tasks.find(tk => tk.id === taskId);
    if (!task) return;
    const newStatus = task.status === 'completed' ? '' : 'completed';
    updateTaskField(taskId, 'status', newStatus);
  };

  const toggleSubtaskInline = (taskId: string, stId: string) => {
    setTasks(prev => prev.map(tk => tk.id === taskId ? { ...tk, subtasks: (tk.subtasks || []).map(s => s.id === stId ? { ...s, completed: !s.completed } : s) } : tk));
  };

  const addInlineSubtask = (taskId: string) => {
    if (!inlineSubtaskText.trim()) return;
    const st: SubTask = { id: `st-${Date.now()}`, text: inlineSubtaskText.trim(), completed: false };
    setTasks(prev => prev.map(tk => tk.id === taskId ? { ...tk, subtasks: [...(tk.subtasks || []), st] } : tk));
    setInlineSubtaskText('');
    setAddingSubtaskFor(null);
  };

  const selectedTask = selectedTaskId ? tasks.find(tk => tk.id === selectedTaskId) : null;

  const allCount = tasks.length;
  const activeCount = tasks.filter(tk => (tk.status || '') !== 'completed').length;
  const completedCount = tasks.filter(tk => (tk.status || '') === 'completed').length;

  // Filter tasks
  let filtered = tasks;
  if (tab === 'open') filtered = filtered.filter(tk => (tk.status || '') !== 'completed');
  if (tab === 'done') filtered = filtered.filter(tk => (tk.status || '') === 'completed');
  if (search) filtered = filtered.filter(tk => tk.text.toLowerCase().includes(search.toLowerCase()));
  if (categoryFilter !== 'all') filtered = filtered.filter(tk => tk.category === categoryFilter);
  if (teamFilter !== 'all') filtered = filtered.filter(tk => tk.assigned_to === teamFilter);
  if (priorityFilter !== 'all') filtered = filtered.filter(tk => tk.priority === priorityFilter);
  if (statusFilter !== 'all') filtered = filtered.filter(tk => (tk.status || '') === statusFilter);

  // Get unique categories
  const categories = Array.from(new Set(tasks.map(tk => tk.category).filter(Boolean))) as string[];

  // Sort helper for date groups (chronological)
  const dateGroupSortKey = (key: string) => {
    if (key === 'No date') return '9999-99';
    const d = new Date(key + ' 1');
    return isNaN(d.getTime()) ? key : d.toISOString().slice(0, 7);
  };

  // Group tasks
  const grouped: Record<string, Task[]> = {};
  if (groupBy === 'category') {
    filtered.forEach(tk => {
      const key = tk.category || 'Uncategorized';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(tk);
    });
  } else {
    filtered.forEach(tk => {
      const key = tk.due_date ? formatMonthYear(tk.due_date) : 'No date';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(tk);
    });
  }

  // Sort grouped entries chronologically if grouping by date
  const sortedGroupEntries = Object.entries(grouped);
  if (groupBy === 'date') {
    sortedGroupEntries.sort((a, b) => dateGroupSortKey(a[0]).localeCompare(dateGroupSortKey(b[0])));
  }

  // Kanban grouping
  const kanbanGrouped: Record<string, Task[]> = {};
  if (kanbanGroupField === 'category') {
    filtered.forEach(tk => {
      const key = tk.category || 'Uncategorized';
      if (!kanbanGrouped[key]) kanbanGrouped[key] = [];
      kanbanGrouped[key].push(tk);
    });
  } else if (kanbanGroupField === 'date') {
    filtered.forEach(tk => {
      const key = tk.due_date ? formatMonthYear(tk.due_date) : 'No date';
      if (!kanbanGrouped[key]) kanbanGrouped[key] = [];
      kanbanGrouped[key].push(tk);
    });
  } else if (kanbanGroupField === 'assigned_to') {
    filtered.forEach(tk => {
      const member = tk.assigned_to ? getTeamMember(tk.assigned_to) : null;
      const key = member ? member.name : 'Unassigned';
      if (!kanbanGrouped[key]) kanbanGrouped[key] = [];
      kanbanGrouped[key].push(tk);
    });
  } else {
    // status
    filtered.forEach(tk => {
      const key = statusLabels[tk.status || ''] || 'No Status';
      if (!kanbanGrouped[key]) kanbanGrouped[key] = [];
      kanbanGrouped[key].push(tk);
    });
  }

  const hasActiveFilters = categoryFilter !== 'all' || teamFilter !== 'all' || priorityFilter !== 'all' || statusFilter !== 'all';
  const clearFilters = () => { setCategoryFilter('all'); setTeamFilter('all'); setPriorityFilter('all'); setStatusFilter('all'); };

  const gridCols = 'grid-cols-[24px_1fr_140px_110px_90px_100px_50px]';

  return (
    <div className="bg-fq-card rounded-xl border border-fq-border shadow-sm p-6">
      {/* Top bar: tabs + actions */}
      <div className="flex items-center justify-between mb-5 border-b border-fq-border pb-3">
        <div className="flex items-center gap-6">
          {([['all', allCount], ['open', activeCount], ['done', completedCount]] as const).map(([key, count]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`font-body text-[14px] pb-1 transition-colors capitalize ${
                tab === key
                  ? 'text-fq-dark font-semibold border-b-2 border-fq-dark -mb-[13px]'
                  : `${t.light} hover:text-fq-dark`
              }`}
            >
              {key === 'open' ? 'Active' : key === 'done' ? 'Completed' : key} <span className={`text-[12px] ${tab === key ? 'text-fq-dark' : t.light}`}>({count})</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fq-muted/40 text-[12px]">🔍</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className={`pl-8 pr-3 py-1.5 font-body text-[12px] ${t.body} bg-fq-bg border border-fq-border rounded-lg outline-none focus:border-fq-accent/40 w-[180px]`}
            />
          </div>
          <button
            onClick={() => setShowAddTask(true)}
            className="flex items-center gap-1.5 bg-fq-dark text-white font-body text-[12px] font-medium px-3.5 py-1.5 rounded-lg hover:bg-fq-dark/90 transition-colors"
          >
            + Add Task
          </button>
          <div className="flex items-center gap-1 ml-2">
            <button
              onClick={() => setViewMode('list')}
              className={`font-body text-[11px] px-2.5 py-1.5 rounded-lg transition-colors ${
                viewMode === 'list' ? 'bg-fq-dark text-white' : `${t.light} bg-fq-bg border border-fq-border hover:text-fq-dark`
              }`}
            >
              ☰ List
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`font-body text-[11px] px-2.5 py-1.5 rounded-lg transition-colors ${
                viewMode === 'kanban' ? 'bg-fq-dark text-white' : `${t.light} bg-fq-bg border border-fq-border hover:text-fq-dark`
              }`}
            >
              ▦ Board
            </button>
          </div>
          {viewMode === 'list' ? (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setGroupBy('category')}
                className={`font-body text-[11px] px-2.5 py-1.5 rounded-lg transition-colors ${
                  groupBy === 'category' ? 'bg-fq-dark text-white' : `${t.light} bg-fq-bg border border-fq-border hover:text-fq-dark`
                }`}
              >
                ⊞ Category
              </button>
              <button
                onClick={() => setGroupBy('date')}
                className={`font-body text-[11px] px-2.5 py-1.5 rounded-lg transition-colors ${
                  groupBy === 'date' ? 'bg-fq-dark text-white' : `${t.light} bg-fq-bg border border-fq-border hover:text-fq-dark`
                }`}
              >
                📅 Date
              </button>
            </div>
          ) : (
            <select
              value={kanbanGroupField}
              onChange={(e) => setKanbanGroupField(e.target.value as 'category' | 'date' | 'assigned_to' | 'status')}
              className={`font-body text-[11px] ${t.body} bg-fq-bg border border-fq-border rounded-lg px-2 py-1.5 outline-none cursor-pointer`}
            >
              <option value="category">Category</option>
              <option value="date">Date</option>
              <option value="assigned_to">Team Member</option>
              <option value="status">Status</option>
            </select>
          )}
        </div>
      </div>

      {/* Add Task Form */}
      {showAddTask && (
        <div className="mb-5 border border-fq-accent/30 rounded-xl p-4 bg-fq-bg/30">
          <div className="flex items-center justify-between mb-3">
            <h4 className={`font-body text-[14px] font-semibold ${t.heading}`}>New Task</h4>
            <button onClick={() => setShowAddTask(false)} className={`font-body text-[12px] ${t.light} hover:text-fq-dark`}>Cancel</button>
          </div>
          <div className="space-y-3">
            <div>
              <label className={`font-body text-[11px] ${t.light} block mb-1`}>Task</label>
              <input
                value={newTaskText}
                onChange={(e) => setNewTaskText(e.target.value)}
                placeholder="What needs to be done?"
                className={`w-full font-body text-[13px] ${t.body} bg-white border border-fq-border rounded-lg px-3 py-2 outline-none focus:border-fq-accent/40`}
                onKeyDown={(e) => { if (e.key === 'Enter') addTask(); }}
                autoFocus
              />
            </div>
            <div className="grid grid-cols-5 gap-3">
              <div>
                <label className={`font-body text-[11px] ${t.light} block mb-1`}>Due date</label>
                <input type="date" value={newTaskDue} onChange={(e) => setNewTaskDue(e.target.value)}
                  className={`w-full font-body text-[13px] ${t.body} bg-white border border-fq-border rounded-lg px-3 py-2 outline-none`} />
              </div>
              <div>
                <label className={`font-body text-[11px] ${t.light} block mb-1`}>Category</label>
                <input value={newTaskCategory} onChange={(e) => setNewTaskCategory(e.target.value)} placeholder="Category..." list="task-categories"
                  className={`w-full font-body text-[13px] ${t.body} bg-white border border-fq-border rounded-lg px-3 py-2 outline-none`} />
                <datalist id="task-categories">{categories.map(cat => <option key={cat} value={cat} />)}</datalist>
              </div>
              <div>
                <label className={`font-body text-[11px] ${t.light} block mb-1`}>Assigned to</label>
                <select value={newTaskAssigned} onChange={(e) => setNewTaskAssigned(e.target.value)}
                  className={`w-full font-body text-[13px] ${t.body} bg-white border border-fq-border rounded-lg px-3 py-2 outline-none cursor-pointer`}>
                  <option value="">Unassigned</option>
                  {assignedTo.map(id => { const m = getTeamMember(id); return m ? <option key={id} value={id}>{m.name}</option> : null; })}
                </select>
              </div>
              <div>
                <label className={`font-body text-[11px] ${t.light} block mb-1`}>Priority</label>
                <select value={newTaskPriority} onChange={(e) => setNewTaskPriority(e.target.value)}
                  className={`w-full font-body text-[13px] ${t.body} bg-white border border-fq-border rounded-lg px-3 py-2 outline-none cursor-pointer`}>
                  <option value="">None</option>
                  <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
                </select>
              </div>
              <div>
                <label className={`font-body text-[11px] ${t.light} block mb-1`}>Status</label>
                <select value={newTaskStatus} onChange={(e) => setNewTaskStatus(e.target.value)}
                  className={`w-full font-body text-[13px] ${t.body} bg-white border border-fq-border rounded-lg px-3 py-2 outline-none cursor-pointer`}>
                  <option value="in_progress">In Progress</option><option value="delayed">Delayed</option><option value="completed">Completed</option>
                </select>
              </div>
            </div>
            <div>
              <label className={`font-body text-[11px] ${t.light} block mb-1`}>Notes</label>
              <textarea value={newTaskNotes} onChange={(e) => setNewTaskNotes(e.target.value)} placeholder="Optional notes..." rows={2}
                className={`w-full font-body text-[13px] ${t.body} bg-white border border-fq-border rounded-lg px-3 py-2 outline-none focus:border-fq-accent/40 resize-none placeholder:text-fq-muted/40`} />
            </div>
            <div className="flex justify-end">
              <button onClick={addTask} disabled={!newTaskText.trim()}
                className="bg-fq-dark text-white font-body text-[13px] font-medium px-5 py-2 rounded-lg hover:bg-fq-dark/90 transition-colors disabled:opacity-40">
                Add Task
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main content with optional detail panel */}
      <div className="flex gap-0">
        <div className="flex-1 min-w-0">
      {filtered.length === 0 ? (
        <p className={`font-body text-[13px] ${t.light} text-center py-8`}>
          {search ? 'No tasks match your search.' : 'No tasks yet.'}
        </p>
      ) : viewMode === 'list' ? (
        /* ── List View (table-style) ── */
        <div>
          {/* Column headers with inline filters */}
          <div className={`grid ${gridCols} gap-1.5 px-2 pb-1.5 border-b border-fq-border mb-0.5`}>
            <span />
            <span className={`font-body text-[11px] font-medium ${t.light} uppercase tracking-wide`}>Task</span>
            <div>
              <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
                className={`font-body text-[11px] font-medium ${categoryFilter !== 'all' ? 'text-fq-accent' : t.light} uppercase tracking-wide bg-transparent outline-none cursor-pointer w-full appearance-none`}>
                <option value="all">Category ▾</option>
                {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>
            <div>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                className={`font-body text-[11px] font-medium ${statusFilter !== 'all' ? 'text-fq-accent' : t.light} uppercase tracking-wide bg-transparent outline-none cursor-pointer w-full appearance-none`}>
                <option value="all">Status ▾</option>
                <option value="in_progress">In Progress</option><option value="delayed">Delayed</option><option value="completed">Completed</option>
              </select>
            </div>
            <div>
              <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}
                className={`font-body text-[11px] font-medium ${priorityFilter !== 'all' ? 'text-fq-accent' : t.light} uppercase tracking-wide bg-transparent outline-none cursor-pointer w-full appearance-none`}>
                <option value="all">Priority ▾</option>
                <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
              </select>
            </div>
            <span className={`font-body text-[11px] font-medium ${t.light} uppercase tracking-wide`}>Due Date</span>
            <div>
              <select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)}
                className={`font-body text-[11px] font-medium ${teamFilter !== 'all' ? 'text-fq-accent' : t.light} uppercase tracking-wide bg-transparent outline-none cursor-pointer w-full appearance-none`}>
                <option value="all">Person ▾</option>
                {assignedTo.map(id => { const m = getTeamMember(id); return m ? <option key={id} value={id}>{m.initials}</option> : null; })}
              </select>
            </div>
          </div>

          {/* Active filters indicator */}
          {hasActiveFilters && (
            <div className="flex items-center gap-2 px-3 py-1.5">
              <span className={`font-body text-[11px] ${t.light}`}>Filtered</span>
              <button onClick={clearFilters} className="font-body text-[11px] text-fq-accent hover:text-fq-dark transition-colors">Clear all</button>
            </div>
          )}

          <div className="space-y-5 mt-3">
            {sortedGroupEntries.map(([group, groupTasks]) => {
              const groupDone = groupTasks.filter(tk => (tk.status || '') === 'completed').length;
              return (
                <div key={group}>
                  <button
                    onClick={() => setCollapsedGroups(prev => {
                      const next = new Set(prev);
                      next.has(group) ? next.delete(group) : next.add(group);
                      return next;
                    })}
                    className="flex items-center gap-2 mb-1.5 px-3 w-full text-left group/collapse"
                  >
                    <span className={`text-[10px] ${t.light} transition-transform ${collapsedGroups.has(group) ? '' : 'rotate-90'}`}>▶</span>
                    {(() => {
                      const gc = groupBy === 'category' ? getCategoryColor(group) : { text: 'text-fq-accent', bg: 'bg-fq-light-accent' };
                      return (
                        <span className={`font-body text-[12px] font-medium ${gc.text} ${gc.bg} px-2.5 py-0.5 rounded-full`}>
                          {group}
                        </span>
                      );
                    })()}
                    <span className={`font-body text-[11px] ${t.light}`}>
                      {groupDone}/{groupTasks.length}
                    </span>
                  </button>
                  {!collapsedGroups.has(group) && <div>
                    {groupTasks.map((task) => {
                      const member = task.assigned_to ? getTeamMember(task.assigned_to) : null;
                      const subtasks = task.subtasks || [];
                      const stCount = subtasks.length;
                      const stDone = subtasks.filter(s => s.completed).length;
                      const taskStatus = task.status || '';
                      const isExpanded = expandedSubtasks.has(task.id);
                      const priorityColors: Record<string, string> = {
                        high: 'text-fq-rose bg-fq-rose-light',
                        medium: 'text-fq-amber bg-fq-amber-light',
                        low: 'text-fq-sage bg-fq-sage-light',
                      };
                      return (
                        <div key={task.id} className="group/row">
                        {/* Main task row */}
                        <div
                          onDoubleClick={() => setSelectedTaskId(task.id)}
                          className={`grid ${gridCols} gap-1.5 items-center py-[3px] px-2 rounded hover:bg-fq-bg/50 transition-colors border-b border-fq-border/30 cursor-pointer ${
                            selectedTaskId === task.id ? 'bg-fq-blue-light/50 border-l-2 border-l-fq-blue' : ''
                          }`}
                        >
                          {/* Checkbox */}
                          <div className="flex items-center">
                            <button onClick={(e) => { e.stopPropagation(); toggleTaskComplete(task.id); }}
                              className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${taskStatus === 'completed' ? 'bg-[#4CAF6A] border-[#4CAF6A] text-white' : 'border-fq-border hover:border-fq-accent'}`}>
                              {taskStatus === 'completed' && <svg width="8" height="8" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 5l2.5 2.5L8 3" /></svg>}
                            </button>
                          </div>
                          {/* Task name */}
                          <div className="flex items-center gap-1 min-w-0">
                            {stCount > 0 && (
                              <button onClick={(e) => { e.stopPropagation(); setExpandedSubtasks(prev => { const n = new Set(prev); n.has(task.id) ? n.delete(task.id) : n.add(task.id); return n; }); }}
                                className={`text-[9px] text-fq-muted/40 hover:text-fq-dark shrink-0 transition-transform ${expandedSubtasks.has(task.id) ? 'rotate-90' : ''}`}>
                                ▶
                              </button>
                            )}
                            <InlineCell
                              value={task.text}
                              onSave={(v) => updateTaskField(task.id, 'text', v)}
                              className={`font-body text-[12px] truncate ${taskStatus === 'completed' ? 'text-fq-muted/50 line-through' : t.heading}`}
                            />
                            {stCount > 0 && (
                              <span className={`font-body text-[9px] ${t.light} shrink-0`}>{stDone}/{stCount}</span>
                            )}
                          </div>
                          {/* Category */}
                          <span className="truncate" onClick={(e) => e.stopPropagation()}>
                            <InlineCell
                              value={task.category || ''}
                              onSave={(v) => updateTaskField(task.id, 'category', v || undefined)}
                              type="select"
                              options={categories.map(c => ({ value: c, label: c }))}
                              className={`font-body text-[11px] ${task.category ? (() => { const cc = getCategoryColor(task.category!); return `${cc.text} ${cc.bg} px-2 py-0.5 rounded-full`; })() : t.light}`}
                              placeholder="—"
                            />
                          </span>
                          {/* Status */}
                          <span onClick={(e) => e.stopPropagation()}>
                            <InlineCell
                              value={taskStatus}
                              onSave={(v) => updateTaskField(task.id, 'status', v)}
                              type="select"
                              options={[{ value: '', label: '—' }, { value: 'in_progress', label: 'In Progress' }, { value: 'delayed', label: 'Delayed' }, { value: 'completed', label: 'Completed' }]}
                              displayValue={statusLabels[taskStatus] || '—'}
                              className={`font-body text-[11px] ${statusColors[taskStatus] || `text-fq-muted/70 bg-fq-bg`} px-2 py-0.5 rounded-full inline-block`}
                              placeholder="—"
                            />
                          </span>
                          {/* Priority */}
                          <span onClick={(e) => e.stopPropagation()}>
                            <InlineCell
                              value={task.priority || ''}
                              onSave={(v) => updateTaskField(task.id, 'priority', v || undefined)}
                              type="select"
                              options={[{ value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }]}
                              className={`font-body text-[11px] ${task.priority ? `${priorityColors[task.priority]} px-2 py-0.5 rounded-full` : t.light}`}
                              placeholder="—"
                            />
                          </span>
                          {/* Due date */}
                          <span onClick={(e) => e.stopPropagation()}>
                            <InlineCell
                              value={task.due_date || ''}
                              onSave={(v) => updateTaskField(task.id, 'due_date', v || undefined)}
                              type="date"
                              displayValue={task.due_date ? formatDate(task.due_date) : ''}
                              className={`font-body text-[12px] ${t.light}`}
                              placeholder="—"
                            />
                          </span>
                          {/* Person */}
                          <span onClick={(e) => e.stopPropagation()}>
                            <InlineCell
                              value={task.assigned_to || ''}
                              onSave={(v) => updateTaskField(task.id, 'assigned_to', v || undefined)}
                              type="select"
                              options={assignedTo.map(id => { const m = getTeamMember(id); return { value: id, label: m?.initials || id }; })}
                              displayValue={member?.initials || ''}
                              className={`font-body text-[10px] ${member ? 'font-semibold text-fq-accent' : t.light}`}
                              placeholder="—"
                            />
                          </span>
                        </div>

                        {/* Subtasks (collapsible) */}
                        {isExpanded && subtasks.length > 0 && (
                          <div className="ml-10 border-l-2 border-fq-border/40 pl-3 py-1">
                            {subtasks.map(st => (
                              <div key={st.id} className="flex items-center gap-2 py-1 group/st">
                                <button
                                  onClick={() => toggleSubtaskInline(task.id, st.id)}
                                  className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                                    st.completed ? 'bg-fq-accent border-fq-accent text-white' : 'border-fq-border hover:border-fq-accent'
                                  }`}
                                >
                                  {st.completed && <svg width="7" height="7" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 5l2.5 2.5L8 3" /></svg>}
                                </button>
                                <span className={`font-body text-[12px] ${st.completed ? 'text-fq-muted/50 line-through' : t.body}`}>{st.text}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Inline subtask add */}
                        {addingSubtaskFor === task.id && (
                          <div className="flex items-center gap-2 ml-10 py-1 px-3">
                            <input
                              value={inlineSubtaskText}
                              onChange={(e) => setInlineSubtaskText(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') addInlineSubtask(task.id); if (e.key === 'Escape') { setAddingSubtaskFor(null); setInlineSubtaskText(''); } }}
                              placeholder="Subtask name..."
                              autoFocus
                              className={`flex-1 font-body text-[12px] ${t.body} bg-white border border-fq-border rounded px-2 py-1 outline-none focus:border-fq-accent/40`}
                            />
                            <button onClick={() => addInlineSubtask(task.id)} className="font-body text-[11px] text-fq-accent hover:text-fq-dark">Add</button>
                            <button onClick={() => { setAddingSubtaskFor(null); setInlineSubtaskText(''); }} className={`font-body text-[11px] ${t.light}`}>Cancel</button>
                          </div>
                        )}
                        {addingSubtaskFor !== task.id && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setAddingSubtaskFor(task.id); setInlineSubtaskText(''); }}
                            className={`font-body text-[10px] ${t.light} hover:text-fq-accent ml-10 px-3 py-0.5 opacity-0 group-hover/row:opacity-100 transition-opacity`}
                          >
                            + subtask
                          </button>
                        )}
                        </div>
                      );
                    })}
                  </div>}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* ── Kanban / Board View ── */
        <div className="flex gap-4 overflow-x-auto pb-2 -mx-2 px-2">
          {Object.entries(kanbanGrouped).map(([column, columnTasks]) => {
            const colDone = columnTasks.filter(tk => (tk.status || '') === 'completed').length;
            return (
              <div key={column} className="flex-shrink-0 w-[260px]">
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-2">
                    {(() => {
                      const gc = kanbanGroupField === 'category' ? getCategoryColor(column) : { text: 'text-fq-accent', bg: 'bg-fq-light-accent' };
                      return (<span className={`font-body text-[12px] font-medium ${gc.text} ${gc.bg} px-2.5 py-0.5 rounded-full`}>{column}</span>);
                    })()}
                    <span className={`font-body text-[11px] ${t.light}`}>{columnTasks.length}</span>
                  </div>
                  <span className={`font-body text-[10px] ${t.light}`}>{colDone}/{columnTasks.length}</span>
                </div>
                <div className="space-y-2">
                  {columnTasks.map((task) => {
                    const member = task.assigned_to ? getTeamMember(task.assigned_to) : null;
                    const taskStatus = task.status || '';
                    return (
                      <div
                        key={task.id}
                        onDoubleClick={() => setSelectedTaskId(task.id)}
                        className={`bg-white border rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer border-fq-border ${
                          selectedTaskId === task.id ? 'ring-1 ring-fq-blue' : ''
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <button onClick={(e) => { e.stopPropagation(); toggleTaskComplete(task.id); }}
                            className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${taskStatus === 'completed' ? 'bg-[#4CAF6A] border-[#4CAF6A] text-white' : 'border-fq-border hover:border-fq-accent'}`}>
                            {taskStatus === 'completed' && <svg width="8" height="8" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 5l2.5 2.5L8 3" /></svg>}
                          </button>
                          <span className={`font-body text-[12px] leading-snug flex-1 ${taskStatus === 'completed' ? 'text-fq-muted/50 line-through' : t.heading}`}>
                            {task.text}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          {taskStatus && <span className={`font-body text-[10px] ${statusColors[taskStatus]} px-1.5 py-0.5 rounded`}>{statusLabels[taskStatus]}</span>}
                          {task.due_date && <span className={`font-body text-[10px] ${t.light} bg-fq-bg px-1.5 py-0.5 rounded`}>{formatDate(task.due_date)}</span>}
                          {task.category && kanbanGroupField !== 'category' && (() => {
                            const cc = getCategoryColor(task.category!);
                            return (<span className={`font-body text-[10px] ${cc.text} ${cc.bg} px-1.5 py-0.5 rounded`}>{task.category}</span>);
                          })()}
                          {member && kanbanGroupField !== 'assigned_to' && (
                            <div className="w-5 h-5 rounded-full bg-fq-light-accent flex items-center justify-center shrink-0 ml-auto" title={member.name}>
                              <span className="font-body text-[8px] font-semibold text-fq-accent">{member.initials}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
        </div>
        {/* Detail panel */}
        {selectedTask && (
          <TaskDetailPanel
            task={selectedTask}
            onClose={() => setSelectedTaskId(null)}
            onUpdate={updateTask}
            categories={categories}
            assignedTo={assignedTo}
          />
        )}
      </div>
    </div>
  );
}

/* DriveCard replaced by imported ProjectDriveSection component */

/* ─────────────── Main Page ─────────────── */
export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const { projects, getTeamMember: teamLookup, loading } = useFullProjects();
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [filesKey, setFilesKey] = useState(0);
  const [composeOpen, setComposeOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<'overview' | 'drive'>('overview');

  // Update the module-level lookup so sub-components can use it
  getTeamMember = teamLookup;

  const project = projects.find(p => p.id === projectId);
  const activeProjects = projects.filter(p => p.status === 'active' && (p.type === 'client' || p.type === 'shoot'));

  if (loading) {
    return (
      <div className="px-10 py-10">
        <p className="font-body text-fq-muted">Loading...</p>
      </div>
    );
  }

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
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setComposeOpen(true)}
            className="flex items-center gap-1.5 font-body text-[13px] font-medium border border-fq-border bg-fq-card text-fq-dark/80 px-4 py-2 rounded-lg hover:bg-fq-light-accent transition-colors"
          >
            <Mail size={13} className="text-fq-accent" />
            Send Email
          </button>
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-2 font-body text-[13px] font-medium bg-fq-dark text-white px-4 py-2 rounded-lg hover:bg-fq-accent transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 9.5V2M4.5 4.5L7 2l2.5 2.5" />
              <path d="M1.5 11.5h11" />
            </svg>
            Upload File
          </button>
        </div>
      </div>

      {/* Section tab navigation */}
      <div className="flex border-b border-fq-border mb-6 -mx-1">
        {(['overview', 'drive'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveSection(tab)}
            className={`px-4 py-2.5 font-body text-[13px] font-medium transition-colors border-b-2 ${
              activeSection === tab
                ? 'text-fq-dark border-fq-accent'
                : 'text-fq-muted border-transparent hover:text-fq-dark'
            }`}
          >
            {tab === 'overview' ? 'Overview' : 'Drive'}
          </button>
        ))}
      </div>

      {activeSection === 'overview' && (
        <>
          <div className="grid grid-cols-[1fr_440px] gap-5 mb-8">
            <HeaderCard project={project} />
            <NextCallAgenda items={project.next_call_agenda || []} projectId={project.id} />
          </div>

          <div className="mb-8"><VendorContacts
            vendors={project.vendors || []}
            projectId={project.id}
            supabaseProjectId={(project as any)._supabaseId || project.id}
            eventDays={(project as any).event_days || []}
            projectVenueName={project.venue_name || project.location || ''}
            projectEventDate={project.event_date || ''}
          /></div>

          <div className="mb-8"><CallNotesSection notes={project.call_notes || []} tasks={project.tasks || []} projectId={project.id} /></div>

          <div className="mb-8">
            <TaskListSection tasks={project.tasks || []} projectColor={project.color} assignedTo={project.assigned_to} projectId={project.id} />
          </div>

          <div className="mb-8">
            <ProjectFileUpload key={filesKey} projectId={project.id} onUploadClick={() => setShowUploadModal(true)} />
          </div>
        </>
      )}

      {activeSection === 'drive' && (
        <div className="mb-8" style={{ minHeight: 600 }}>
          <ProjectDriveTab projectId={project.id} />
        </div>
      )}

      {showUploadModal && (
        <UploadModal
          onClose={() => setShowUploadModal(false)}
          defaultProjectId={project.id}
          defaultProjectName={project.name}
          onUploaded={() => setFilesKey(k => k + 1)}
        />
      )}

      {composeOpen && (
        <ComposePanel
          projects={activeProjects.map(p => ({ id: p.id, name: p.name, status: p.status, type: p.type, color: p.color ?? null }))}
          initialProjectId={project.id}
          initialTo={(project as unknown as Record<string, unknown>).client1_email as string | undefined}
          onClose={() => setComposeOpen(false)}
        />
      )}
    </div>
  );
}
