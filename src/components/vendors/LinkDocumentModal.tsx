'use client';

import { useState, useEffect } from 'react';
import { VendorDocumentRow } from '@/lib/database.types';

const DOC_TYPES = ['Proposal', 'Contract', 'Invoice', 'Addendum', 'COI', 'Other'];
const STATUSES: VendorDocumentRow['status'][] = ['Unsigned', 'Executed', 'Superseded', 'Archived'];

function generateDisplayName(vendorName: string, docType: string, date: string): string {
  if (!vendorName || !docType) return '';
  const year = date ? new Date(date).getFullYear().toString() : new Date().getFullYear().toString();
  // Format as VendorName - DocType - DDMonYY
  if (date) {
    const d = new Date(date);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dd = String(d.getDate()).padStart(2, '0');
    const mon = months[d.getMonth()];
    const yy = String(d.getFullYear()).slice(-2);
    return `${vendorName} - ${docType} - ${dd}${mon}${yy}`;
  }
  return `${vendorName} - ${docType} - ${year}`;
}

function parseDriveFileId(url: string): string {
  const match = url.match(/\/file\/d\/([^/]+)/);
  return match?.[1] ?? '';
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: (doc: VendorDocumentRow) => void;
  vendorId: string;
  vendorName: string;
  existingDocs: VendorDocumentRow[];
}

export default function LinkDocumentModal({ open, onClose, onSaved, vendorId, vendorName, existingDocs }: Props) {
  const [displayName, setDisplayName] = useState('');
  const [driveUrl, setDriveUrl] = useState('');
  const [docType, setDocType] = useState('Contract');
  const [status, setStatus] = useState<VendorDocumentRow['status']>('Unsigned');
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [priorDoc, setPriorDoc] = useState<VendorDocumentRow | null>(null);
  const [markSuperseded, setMarkSuperseded] = useState(false);
  const [nameAutoSet, setNameAutoSet] = useState(false);

  useEffect(() => {
    if (open) {
      setDisplayName('');
      setDriveUrl('');
      setDocType('Contract');
      setStatus('Unsigned');
      setDate('');
      setNotes('');
      setError('');
      setPriorDoc(null);
      setMarkSuperseded(false);
      setNameAutoSet(false);
    }
  }, [open]);

  // Auto-generate display name when vendor name, doc type, or date changes
  useEffect(() => {
    if (!nameAutoSet || !displayName) {
      const generated = generateDisplayName(vendorName, docType, date);
      if (generated) {
        setDisplayName(generated);
        setNameAutoSet(false); // keep auto-updating until user edits manually
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorName, docType, date]);

  // Check for prior version when docType changes
  useEffect(() => {
    const prior = existingDocs.find(
      d => d.doc_type === docType && d.status !== 'Superseded' && d.status !== 'Archived'
    );
    setPriorDoc(prior ?? null);
    setMarkSuperseded(false);
  }, [docType, existingDocs]);

  if (!open) return null;

  const handleDriveUrlChange = (val: string) => {
    setDriveUrl(val);
  };

  const handleSubmit = async () => {
    if (!displayName.trim()) { setError('Display name is required.'); return; }
    setSaving(true);
    setError('');

    try {
      // If user chose to mark prior as superseded, do that first
      if (priorDoc && markSuperseded) {
        await fetch('/api/vendor-documents', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: priorDoc.id, status: 'Superseded' }),
        });
      }

      const res = await fetch('/api/vendor-documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendor_id: vendorId,
          display_name: displayName.trim(),
          drive_url: driveUrl.trim() || null,
          drive_file_id: driveUrl.trim() ? parseDriveFileId(driveUrl.trim()) : null,
          doc_type: docType,
          status,
          date: date || null,
          notes: notes.trim() || null,
        }),
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
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-fq-card rounded-2xl border border-fq-border shadow-2xl w-[560px] max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-fq-border">
          <h2 className="font-heading text-[18px] font-semibold text-fq-dark">Link Document</h2>
          <p className="font-body text-[12px] text-fq-muted mt-0.5">No files are moved or renamed automatically.</p>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-6 py-5 flex flex-col gap-4">
          {error && (
            <p className="font-body text-[12px] text-fq-alert bg-fq-alert/10 rounded-lg px-3 py-2">{error}</p>
          )}

          {/* Prior version warning */}
          {priorDoc && (
            <div className="bg-fq-amber/10 border border-fq-amber/30 rounded-lg px-4 py-3">
              <p className="font-body text-[12px] text-fq-dark font-medium">An existing {docType} was found:</p>
              <p className="font-body text-[12px] text-fq-muted mt-0.5">{priorDoc.display_name}</p>
              <label className="flex items-center gap-2 mt-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={markSuperseded}
                  onChange={e => setMarkSuperseded(e.target.checked)}
                  className="accent-fq-accent"
                />
                <span className="font-body text-[12px] text-fq-dark">Mark it as Superseded when saving</span>
              </label>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Doc Type</label>
              <select className={inputClass} value={docType} onChange={e => setDocType(e.target.value)}>
                {DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Status</label>
              <select className={inputClass} value={status} onChange={e => setStatus(e.target.value as VendorDocumentRow['status'])}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className={labelClass}>Date</label>
            <input type="date" className={inputClass} value={date} onChange={e => setDate(e.target.value)} />
          </div>

          <div>
            <label className={labelClass}>Display Name</label>
            <input
              className={inputClass}
              value={displayName}
              onChange={e => { setDisplayName(e.target.value); setNameAutoSet(true); }}
              placeholder="e.g. VendorName - Contract - 12Apr26"
            />
            <p className="font-body text-[10px] text-fq-muted/60 mt-1">Auto-generated from naming convention. Edit as needed.</p>
          </div>

          <div>
            <label className={labelClass}>Google Drive URL</label>
            <input
              className={inputClass}
              value={driveUrl}
              onChange={e => handleDriveUrlChange(e.target.value)}
              placeholder="https://drive.google.com/file/d/…"
            />
          </div>

          <div>
            <label className={labelClass}>Notes</label>
            <textarea
              className={`${inputClass} resize-none`}
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Optional notes about this document"
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
            {saving ? 'Saving…' : 'Link Document'}
          </button>
        </div>
      </div>
    </div>
  );
}
