'use client';

import { useState, useEffect } from 'react';
import { VendorDirectoryRow } from '@/lib/database.types';

const CATEGORIES = [
  'Audio Visual',
  'Bridal',
  'Cake',
  'Content Creator',
  'Entertainment',
  'Florist',
  'Hair & Makeup',
  'Lighting',
  'Linens',
  'Paper Goods',
  'Photographer',
  'Rentals',
  'Transportation & Cars',
  'Venues',
  'Video',
  'Other',
];

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: (vendor: VendorDirectoryRow) => void;
  existing?: VendorDirectoryRow | null;
}

export default function AddEditVendorModal({ open, onClose, onSaved, existing }: Props) {
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [category, setCategory] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [instagram, setInstagram] = useState('');
  const [website, setWebsite] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setName(existing?.name ?? '');
      setCompany(existing?.company ?? '');
      setCategory(existing?.category ?? '');
      setEmail(existing?.email ?? '');
      setPhone(existing?.phone ?? '');
      setInstagram(existing?.instagram ?? '');
      setWebsite(existing?.website ?? '');
      setNotes(existing?.notes ?? '');
      setError('');
    }
  }, [open, existing]);

  if (!open) return null;

  const handleSubmit = async () => {
    if (!name.trim()) { setError('Vendor name is required.'); return; }
    if (!category.trim()) { setError('Category is required.'); return; }
    setSaving(true);
    setError('');

    const payload = {
      name: name.trim(),
      company: company.trim() || null,
      category: category.trim(),
      email: email.trim() || null,
      phone: phone.trim() || null,
      instagram: instagram.trim() || null,
      website: website.trim() || null,
      notes: notes.trim() || null,
    };

    try {
      const res = await fetch(
        existing ? '/api/vendor-directory' : '/api/vendor-directory',
        {
          method: existing ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(existing ? { id: existing.id, ...payload } : payload),
        }
      );
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? 'Something went wrong.');
        return;
      }
      const saved = await res.json();
      onSaved(saved);
    } finally {
      setSaving(false);
    }
  };

  const inputClass = 'w-full bg-fq-bg border border-fq-border rounded-lg px-3 py-2 font-body text-[13px] text-fq-dark outline-none focus:border-fq-accent/50 placeholder:text-fq-muted/40';
  const labelClass = 'block font-body text-[11px] text-fq-muted uppercase tracking-wide mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-fq-card rounded-2xl border border-fq-border shadow-2xl w-[560px] max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-fq-border">
          <h2 className="font-heading text-[18px] font-semibold text-fq-dark">
            {existing ? 'Edit Vendor' : 'Add Vendor'}
          </h2>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-6 py-5 flex flex-col gap-4">
          {error && (
            <p className="font-body text-[12px] text-fq-alert bg-fq-alert/10 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Name *</label>
              <input className={inputClass} value={name} onChange={e => setName(e.target.value)} placeholder="Contact or vendor name" />
            </div>
            <div>
              <label className={labelClass}>Company</label>
              <input className={inputClass} value={company} onChange={e => setCompany(e.target.value)} placeholder="Company name" />
            </div>
          </div>

          <div>
            <label className={labelClass}>Category *</label>
            <input
              className={inputClass}
              value={category}
              onChange={e => setCategory(e.target.value)}
              list="vendor-categories"
              placeholder="Select or type a category"
            />
            <datalist id="vendor-categories">
              {CATEGORIES.map(c => <option key={c} value={c} />)}
            </datalist>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Email</label>
              <input className={inputClass} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com" />
            </div>
            <div>
              <label className={labelClass}>Phone</label>
              <input className={inputClass} value={phone} onChange={e => setPhone(e.target.value)} placeholder="(000) 000-0000" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Instagram</label>
              <input className={inputClass} value={instagram} onChange={e => setInstagram(e.target.value)} placeholder="@handle" />
            </div>
            <div>
              <label className={labelClass}>Website</label>
              <input className={inputClass} value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://..." />
            </div>
          </div>

          <div>
            <label className={labelClass}>Notes</label>
            <textarea
              className={`${inputClass} resize-none`}
              rows={3}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Internal notes about this vendor"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-fq-border flex justify-between items-center">
          <button onClick={onClose} className="font-body text-[13px] text-fq-muted hover:text-fq-dark transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="bg-fq-accent text-white font-body text-[13px] font-medium px-5 py-2 rounded-lg hover:bg-fq-accent/90 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving…' : existing ? 'Save Changes' : 'Add Vendor'}
          </button>
        </div>
      </div>
    </div>
  );
}
