'use client';

/**
 * AddressField — chip-based email address input with autocomplete.
 * Used in reply composer and compose panel for To / CC / BCC fields.
 */

import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';

/* ── Types ── */
export interface Contact {
  name: string;
  email: string;
  source: 'client' | 'vendor' | 'recent';
  projectName?: string;
}

export interface ContactChip {
  name: string;
  email: string;
}

/* ── Design token (mirrors parent files) ── */
const tk = { light: 'text-fq-muted/65' };

/* ─────────────────────────────────────────────────────────────────────────────
   useContacts — loads clients, vendors, recent senders from API
───────────────────────────────────────────────────────────────────────────── */
export function useContacts(): Contact[] {
  const [contacts, setContacts] = useState<Contact[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const [projRes, vendorRes, emailRes] = await Promise.all([
          fetch('/api/projects'),
          fetch('/api/vendors'),
          fetch('/api/emails?top=50'),
        ]);

        // Clients from projects
        const projData = await projRes.json();
        const projectList: Array<{
          name?: string;
          client1_name?: string; client1_email?: string;
          client2_name?: string; client2_email?: string;
        }> = projData.projects ?? projData ?? [];

        const clientContacts: Contact[] = [];
        for (const p of projectList) {
          if (p.client1_email) clientContacts.push({ name: p.client1_name ?? p.client1_email, email: p.client1_email, source: 'client', projectName: p.name });
          if (p.client2_email) clientContacts.push({ name: p.client2_name ?? p.client2_email, email: p.client2_email, source: 'client', projectName: p.name });
        }

        // Vendors
        const vendorData = await vendorRes.json();
        const vendorContacts: Contact[] = (vendorData.vendors ?? vendorData ?? [])
          .filter((v: { email?: string }) => !!v.email)
          .map((v: { vendor_name?: string; email: string }) => ({
            name: v.vendor_name ?? v.email,
            email: v.email,
            source: 'vendor' as const,
          }));

        // Recent senders
        const emailData = await emailRes.json();
        const seen = new Set<string>();
        const recentContacts: Contact[] = [];
        for (const e of emailData.emails ?? []) {
          if (e.from_email && !seen.has(e.from_email)) {
            seen.add(e.from_email);
            recentContacts.push({ name: e.from_name ?? e.from_email, email: e.from_email, source: 'recent' });
          }
        }

        // Merge, deduplicate by email (clients win over vendors win over recent)
        const allSeen = new Set<string>();
        const merged: Contact[] = [];
        for (const c of [...clientContacts, ...vendorContacts, ...recentContacts]) {
          if (!allSeen.has(c.email.toLowerCase())) {
            allSeen.add(c.email.toLowerCase());
            merged.push(c);
          }
        }
        setContacts(merged);
      } catch { /* silently ignore */ }
    };
    load();
  }, []);

  return contacts;
}

/* ─────────────────────────────────────────────────────────────────────────────
   AddressField — chip input + autocomplete dropdown
───────────────────────────────────────────────────────────────────────────── */
export function AddressField({
  label,
  chips,
  onChipsChange,
  contacts,
}: {
  label: string;
  chips: ContactChip[];
  onChipsChange: (chips: ContactChip[]) => void;
  contacts: Contact[];
}) {
  const [inputValue, setInputValue] = useState('');
  const [open, setOpen]             = useState(false);
  const wrapRef  = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = inputValue.length > 0
    ? contacts
        .filter((c) => {
          const q = inputValue.toLowerCase();
          return c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q);
        })
        .filter((c) => !chips.some((ch) => ch.email.toLowerCase() === c.email.toLowerCase()))
        .slice(0, 6)
    : [];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const addChip = (name: string, email: string) => {
    const trimmed = email.trim();
    if (!trimmed) return;
    if (chips.some((ch) => ch.email.toLowerCase() === trimmed.toLowerCase())) return;
    onChipsChange([...chips, { name: name || trimmed, email: trimmed }]);
    setInputValue('');
    setOpen(false);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const removeChip = (email: string) => onChipsChange(chips.filter((ch) => ch.email !== email));

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'Enter' || e.key === ',') && inputValue.trim()) {
      e.preventDefault();
      addChip(inputValue.trim(), inputValue.trim());
    }
    if (e.key === 'Backspace' && !inputValue && chips.length > 0) {
      removeChip(chips[chips.length - 1].email);
    }
  };

  return (
    <div ref={wrapRef} className="relative">
      <div className="flex items-start gap-2">
        <span className={`font-body text-[11.5px] font-medium ${tk.light} w-14 shrink-0 leading-6 pt-0.5`}>
          {label}
        </span>
        {/* Chip + input row */}
        <div
          className="flex-1 flex flex-wrap items-center gap-1 min-h-[26px] cursor-text"
          onClick={() => inputRef.current?.focus()}
        >
          {chips.map((chip) => (
            <span
              key={chip.email}
              className="inline-flex items-center gap-1 pl-2 pr-1.5 py-0.5 rounded-md bg-fq-card border border-fq-border font-body text-[12px] text-fq-dark/80 max-w-[200px]"
            >
              <span className="truncate">
                {chip.name && chip.name !== chip.email ? chip.name : chip.email}
              </span>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); removeChip(chip.email); }}
                className={`flex-shrink-0 ${tk.light} hover:text-red-500 transition-colors`}
              >
                <X size={10} />
              </button>
            </span>
          ))}
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => { setInputValue(e.target.value); setOpen(true); }}
            onKeyDown={handleKeyDown}
            onFocus={() => { if (inputValue.length > 0) setOpen(true); }}
            placeholder={chips.length === 0 ? `Add ${label.toLowerCase()}…` : ''}
            className="flex-1 min-w-[130px] font-body text-[13px] text-fq-dark/85 bg-transparent border-none outline-none placeholder:text-fq-muted/50"
          />
        </div>
      </div>

      {/* Autocomplete dropdown */}
      {open && suggestions.length > 0 && (
        <div className="absolute left-16 right-0 top-full mt-1 z-50 rounded-xl border border-fq-border bg-fq-card shadow-lg overflow-hidden">
          {suggestions.map((c) => (
            <button
              key={c.email}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); addChip(c.name, c.email); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-fq-bg transition-colors text-left"
            >
              <div className="w-6 h-6 rounded-full bg-fq-light-accent flex items-center justify-center shrink-0">
                <span className={`font-body text-[10px] font-semibold ${tk.light}`}>
                  {c.name?.[0]?.toUpperCase() ?? '?'}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-body text-[12.5px] font-medium text-fq-dark/80 truncate">{c.name}</p>
                <p className={`font-body text-[11px] ${tk.light} truncate`}>{c.email}</p>
              </div>
              {c.projectName && (
                <span className={`ml-2 font-body text-[10px] ${tk.light} shrink-0 italic truncate max-w-[90px]`}>
                  {c.projectName}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Convert a chip array to Microsoft Graph recipient format. */
export function chipsToRecipients(chips: ContactChip[]) {
  return chips.map((c) => ({ emailAddress: { address: c.email, name: c.name } }));
}
