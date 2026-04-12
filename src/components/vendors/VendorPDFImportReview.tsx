'use client';

import { useState } from 'react';
import { VendorDirectoryRow } from '@/lib/database.types';

const CATEGORIES = [
  'Audio Visual', 'Bridal', 'Cake', 'Content Creator', 'Entertainment',
  'Florist', 'Hair & Makeup', 'Lighting', 'Linens', 'Paper Goods',
  'Photographer', 'Rentals', 'Transportation & Cars', 'Venues', 'Video', 'Other',
];

interface CandidateCard {
  data: Partial<VendorDirectoryRow>;
  status: 'pending' | 'accepted' | 'discarded';
}

interface Props {
  candidates: Partial<VendorDirectoryRow>[];
  onClose: () => void;
  onSaved: () => void;
}

export default function VendorPDFImportReview({ candidates, onClose, onSaved }: Props) {
  const [cards, setCards] = useState<CandidateCard[]>(
    candidates.map(c => ({ data: { ...c }, status: 'pending' }))
  );
  const [saving, setSaving] = useState(false);

  const update = (i: number, field: keyof VendorDirectoryRow, value: string) => {
    setCards(prev => {
      const next = [...prev];
      next[i] = { ...next[i], data: { ...next[i].data, [field]: value } };
      return next;
    });
  };

  const setStatus = (i: number, status: CandidateCard['status']) => {
    setCards(prev => {
      const next = [...prev];
      next[i] = { ...next[i], status };
      return next;
    });
  };

  const acceptAll = () => setCards(prev => prev.map(c => ({ ...c, status: 'accepted' })));

  const handleSave = async () => {
    const accepted = cards.filter(c => c.status === 'accepted' && c.data.name && c.data.category);
    if (accepted.length === 0) { onClose(); return; }

    setSaving(true);
    try {
      await fetch('/api/vendor-directory/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: accepted.map(c => c.data) }),
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  const acceptedCount = cards.filter(c => c.status === 'accepted').length;
  const inputClass = 'w-full bg-fq-bg border border-fq-border rounded-md px-2.5 py-1.5 font-body text-[12px] text-fq-dark outline-none focus:border-fq-accent/50 placeholder:text-fq-muted/40';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-fq-card rounded-2xl border border-fq-border shadow-2xl w-[760px] max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-fq-border flex items-center justify-between">
          <div>
            <h2 className="font-heading text-[18px] font-semibold text-fq-dark">Review PDF Vendors</h2>
            <p className="font-body text-[12px] text-fq-muted mt-0.5">
              {candidates.length} vendor{candidates.length !== 1 ? 's' : ''} found. Review and accept the ones you want to save.
            </p>
          </div>
          <button
            onClick={acceptAll}
            className="font-body text-[12px] text-fq-accent hover:text-fq-accent/80 transition-colors"
          >
            Accept All
          </button>
        </div>

        {/* Cards */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-3">
          {cards.map((card, i) => (
            <div
              key={i}
              className={`border rounded-xl px-4 py-4 transition-colors ${
                card.status === 'accepted'
                  ? 'border-fq-sage/40 bg-fq-sage/5'
                  : card.status === 'discarded'
                  ? 'border-fq-border bg-fq-border/10 opacity-40'
                  : 'border-fq-border bg-fq-card'
              }`}
            >
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div>
                  <label className="block font-body text-[10px] text-fq-muted uppercase tracking-wide mb-1">Name *</label>
                  <input
                    className={inputClass}
                    value={card.data.name ?? ''}
                    onChange={e => update(i, 'name', e.target.value)}
                    placeholder="Vendor name"
                    disabled={card.status === 'discarded'}
                  />
                </div>
                <div>
                  <label className="block font-body text-[10px] text-fq-muted uppercase tracking-wide mb-1">Company</label>
                  <input
                    className={inputClass}
                    value={card.data.company ?? ''}
                    onChange={e => update(i, 'company', e.target.value)}
                    placeholder="Company"
                    disabled={card.status === 'discarded'}
                  />
                </div>
                <div>
                  <label className="block font-body text-[10px] text-fq-muted uppercase tracking-wide mb-1">Category *</label>
                  <input
                    className={inputClass}
                    value={card.data.category ?? ''}
                    onChange={e => update(i, 'category', e.target.value)}
                    list={`pdf-cats-${i}`}
                    placeholder="Category"
                    disabled={card.status === 'discarded'}
                  />
                  <datalist id={`pdf-cats-${i}`}>
                    {CATEGORIES.map(c => <option key={c} value={c} />)}
                  </datalist>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-3">
                <div>
                  <label className="block font-body text-[10px] text-fq-muted uppercase tracking-wide mb-1">Email</label>
                  <input
                    className={inputClass}
                    value={card.data.email ?? ''}
                    onChange={e => update(i, 'email', e.target.value)}
                    placeholder="email@example.com"
                    disabled={card.status === 'discarded'}
                  />
                </div>
                <div>
                  <label className="block font-body text-[10px] text-fq-muted uppercase tracking-wide mb-1">Phone</label>
                  <input
                    className={inputClass}
                    value={card.data.phone ?? ''}
                    onChange={e => update(i, 'phone', e.target.value)}
                    placeholder="(000) 000-0000"
                    disabled={card.status === 'discarded'}
                  />
                </div>
                <div>
                  <label className="block font-body text-[10px] text-fq-muted uppercase tracking-wide mb-1">Instagram</label>
                  <input
                    className={inputClass}
                    value={card.data.instagram ?? ''}
                    onChange={e => update(i, 'instagram', e.target.value)}
                    placeholder="@handle"
                    disabled={card.status === 'discarded'}
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-fq-border/40">
                {card.status !== 'discarded' && (
                  <button
                    onClick={() => setStatus(i, 'discarded')}
                    className="font-body text-[11px] text-fq-muted/60 hover:text-fq-muted transition-colors px-3 py-1"
                  >
                    Discard
                  </button>
                )}
                {card.status === 'discarded' && (
                  <button
                    onClick={() => setStatus(i, 'pending')}
                    className="font-body text-[11px] text-fq-muted hover:text-fq-dark transition-colors px-3 py-1"
                  >
                    Restore
                  </button>
                )}
                {card.status !== 'discarded' && (
                  <button
                    onClick={() => setStatus(i, card.status === 'accepted' ? 'pending' : 'accepted')}
                    className={`font-body text-[11px] font-medium px-3 py-1 rounded-md transition-colors ${
                      card.status === 'accepted'
                        ? 'bg-fq-sage/20 text-fq-sage hover:bg-fq-sage/30'
                        : 'bg-fq-accent/10 text-fq-accent hover:bg-fq-accent/20'
                    }`}
                  >
                    {card.status === 'accepted' ? 'Accepted' : 'Accept'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-fq-border flex justify-between items-center">
          <button onClick={onClose} className="font-body text-[13px] text-fq-muted hover:text-fq-dark transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || acceptedCount === 0}
            className="bg-fq-accent text-white font-body text-[13px] font-medium px-5 py-2 rounded-lg hover:bg-fq-accent/90 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving…' : `Save ${acceptedCount} Vendor${acceptedCount !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}
