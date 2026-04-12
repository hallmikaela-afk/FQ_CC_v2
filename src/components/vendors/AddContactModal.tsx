'use client';

import { useState, useEffect } from 'react';
import { VendorContactRow } from '@/lib/database.types';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: (contact: VendorContactRow) => void;
  vendorId: string;
  existing?: VendorContactRow | null;
}

export default function AddContactModal({ open, onClose, onSaved, vendorId, existing }: Props) {
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setName(existing?.name ?? '');
      setTitle(existing?.title ?? '');
      setEmail(existing?.email ?? '');
      setPhone(existing?.phone ?? '');
      setIsPrimary(existing?.is_primary ?? false);
      setError('');
    }
  }, [open, existing]);

  if (!open) return null;

  const handleSubmit = async () => {
    if (!name.trim()) { setError('Name is required.'); return; }
    setSaving(true);
    setError('');

    const payload = {
      vendor_id: vendorId,
      name: name.trim(),
      title: title.trim() || null,
      email: email.trim() || null,
      phone: phone.trim() || null,
      is_primary: isPrimary,
    };

    try {
      const res = await fetch('/api/vendor-contacts', {
        method: existing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(existing ? { id: existing.id, ...payload } : payload),
      });
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
      <div className="relative bg-fq-card rounded-2xl border border-fq-border shadow-2xl w-[480px] flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-fq-border">
          <h2 className="font-heading text-[18px] font-semibold text-fq-dark">
            {existing ? 'Edit Contact' : 'Add Contact'}
          </h2>
        </div>

        {/* Body */}
        <div className="px-6 py-5 flex flex-col gap-4">
          {error && (
            <p className="font-body text-[12px] text-fq-alert bg-fq-alert/10 rounded-lg px-3 py-2">{error}</p>
          )}

          <div>
            <label className={labelClass}>Name *</label>
            <input className={inputClass} value={name} onChange={e => setName(e.target.value)} placeholder="Full name" />
          </div>

          <div>
            <label className={labelClass}>Title</label>
            <input className={inputClass} value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Lead Coordinator" />
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

          <label className="flex items-center gap-2 cursor-pointer">
            <div
              onClick={() => setIsPrimary(v => !v)}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors border ${isPrimary ? 'bg-fq-amber border-fq-amber/50' : 'border-fq-border hover:border-fq-amber/40'}`}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill={isPrimary ? '#8B6F4E' : 'none'} stroke={isPrimary ? '#fff' : 'currentColor'} strokeWidth="1.5">
                <path d="M8 1l1.8 3.6 4 .6-2.9 2.8.7 4L8 10.1 4.4 12l.7-4L2.2 5.2l4-.6z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span className="font-body text-[13px] text-fq-dark">Set as primary contact</span>
          </label>
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
            {saving ? 'Saving…' : existing ? 'Save Changes' : 'Add Contact'}
          </button>
        </div>
      </div>
    </div>
  );
}
