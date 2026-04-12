'use client';

import { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { VendorDirectoryRow } from '@/lib/database.types';

const TARGET_FIELDS = [
  { key: 'name', label: 'Name', required: true },
  { key: 'company', label: 'Company', required: false },
  { key: 'category', label: 'Category', required: true },
  { key: 'email', label: 'Email', required: false },
  { key: 'phone', label: 'Phone', required: false },
  { key: 'instagram', label: 'Instagram', required: false },
  { key: 'website', label: 'Website', required: false },
  { key: 'notes', label: 'Notes', required: false },
];

// Aisle Planner CSV column → vendor_directory field guesses
const AP_GUESSES: Record<string, string> = {
  'first name': 'name',
  'last name': '',        // merged into name below
  'company': 'company',
  'business name': 'company',
  'email': 'email',
  'phone': 'phone',
  'category': 'category',
  'type': 'category',
  'instagram': 'instagram',
  'website': 'website',
  'notes': 'notes',
};

interface ColumnMapping {
  sourceCol: string;
  targetField: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onImported: (vendors: VendorDirectoryRow[]) => void;
}

export default function VendorCSVImportModal({ open, onClose, onImported }: Props) {
  const [step, setStep] = useState<'upload' | 'map' | 'preview' | 'done'>('upload');
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [sourceColumns, setSourceColumns] = useState<string[]>([]);
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [previewRows, setPreviewRows] = useState<Record<string, string>[]>([]);
  const [flagged, setFlagged] = useState<number[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ inserted: number; updated: number; errors: { row: number; error: string }[] } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState('');

  const reset = () => {
    setStep('upload');
    setRawRows([]);
    setSourceColumns([]);
    setMappings([]);
    setPreviewRows([]);
    setFlagged([]);
    setResult(null);
    setFileName('');
  };

  const handleClose = () => { reset(); onClose(); };

  const processFile = useCallback((file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = e.target?.result;
      const wb = XLSX.read(data, { type: 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' });
      if (rows.length === 0) return;

      const cols = Object.keys(rows[0]);
      setRawRows(rows);
      setSourceColumns(cols);

      // Auto-map columns using AP guesses
      const autoMappings: ColumnMapping[] = cols.map(col => ({
        sourceCol: col,
        targetField: AP_GUESSES[col.toLowerCase()] ?? '',
      }));
      setMappings(autoMappings);
      setStep('map');
    };
    reader.readAsBinaryString(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const buildPreview = () => {
    // Check for AP-style first+last name columns
    const firstNameMapping = mappings.find(m => m.sourceCol.toLowerCase() === 'first name' && m.targetField === 'name');
    const lastNameCol = sourceColumns.find(c => c.toLowerCase() === 'last name');

    const mapped = rawRows.map(row => {
      const out: Record<string, string> = {};
      for (const m of mappings) {
        if (!m.targetField) continue;
        if (firstNameMapping && m.sourceCol === firstNameMapping.sourceCol && lastNameCol) {
          const first = row[m.sourceCol]?.trim() ?? '';
          const last = row[lastNameCol]?.trim() ?? '';
          out['name'] = [first, last].filter(Boolean).join(' ');
        } else {
          out[m.targetField] = row[m.sourceCol]?.trim() ?? '';
        }
      }
      return out;
    });

    // Flag rows missing required fields
    const flaggedIdx: number[] = [];
    mapped.forEach((row, i) => {
      if (!row['name'] || !row['category']) flaggedIdx.push(i);
    });

    setPreviewRows(mapped);
    setFlagged(flaggedIdx);
    setStep('preview');
  };

  const runImport = async () => {
    const validRows = previewRows.filter((_, i) => !flagged.includes(i));
    if (validRows.length === 0) return;
    setImporting(true);
    try {
      const res = await fetch('/api/vendor-directory/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: validRows }),
      });
      const data = await res.json();
      setResult(data);
      setStep('done');
    } finally {
      setImporting(false);
    }
  };

  const handleDone = async () => {
    // Fetch updated vendors to pass back
    const res = await fetch('/api/vendor-directory');
    const vendors = res.ok ? await res.json() : [];
    onImported(vendors);
    handleClose();
  };

  if (!open) return null;

  const inputClass = 'bg-fq-bg border border-fq-border rounded-lg px-3 py-2 font-body text-[12px] text-fq-dark outline-none focus:border-fq-accent/50';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative bg-fq-card rounded-2xl border border-fq-border shadow-2xl w-[700px] max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-fq-border flex items-center justify-between">
          <div>
            <h2 className="font-heading text-[18px] font-semibold text-fq-dark">Import Vendors from CSV</h2>
            {fileName && <p className="font-body text-[11px] text-fq-muted mt-0.5">{fileName}</p>}
          </div>
          <button onClick={handleClose} className="text-fq-muted hover:text-fq-dark transition-colors">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M4 4l10 10M14 4L4 14" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5">
          {/* Step: upload */}
          {step === 'upload' && (
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${dragOver ? 'border-fq-accent bg-fq-light-accent/30' : 'border-fq-border'}`}
            >
              <p className="font-body text-[14px] text-fq-muted mb-3">Drag and drop a CSV or Excel file here</p>
              <label className="cursor-pointer bg-fq-accent text-white font-body text-[13px] font-medium px-4 py-2 rounded-lg hover:bg-fq-accent/90 transition-colors">
                Browse File
                <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileInput} />
              </label>
              <p className="font-body text-[11px] text-fq-muted/60 mt-4">
                Supported: Aisle Planner exports (CSV), Excel. Columns: First Name, Last Name, Company, Email, Phone, Category, Instagram, Website.
              </p>
            </div>
          )}

          {/* Step: map */}
          {step === 'map' && (
            <div>
              <p className="font-body text-[13px] text-fq-muted mb-4">
                Map your file columns to vendor directory fields. Required fields: <strong className="text-fq-dark">Name</strong>, <strong className="text-fq-dark">Category</strong>.
              </p>
              <div className="space-y-2">
                {mappings.map((m, i) => (
                  <div key={m.sourceCol} className="flex items-center gap-3">
                    <span className="font-body text-[12px] text-fq-dark w-40 truncate shrink-0">{m.sourceCol}</span>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-fq-muted shrink-0">
                      <path d="M3 7h8M8 4l3 3-3 3" />
                    </svg>
                    <select
                      value={m.targetField}
                      onChange={e => {
                        const next = [...mappings];
                        next[i] = { ...m, targetField: e.target.value };
                        setMappings(next);
                      }}
                      className={`${inputClass} flex-1`}
                    >
                      <option value="">— skip —</option>
                      {TARGET_FIELDS.map(f => (
                        <option key={f.key} value={f.key}>{f.label}{f.required ? ' *' : ''}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step: preview */}
          {step === 'preview' && (
            <div>
              {flagged.length > 0 && (
                <div className="bg-fq-amber/10 border border-fq-amber/30 rounded-lg px-4 py-3 mb-4">
                  <p className="font-body text-[12px] text-fq-dark font-medium">
                    {flagged.length} row{flagged.length > 1 ? 's' : ''} flagged — missing required fields (Name or Category).
                    These rows will be skipped.
                  </p>
                </div>
              )}
              <p className="font-body text-[12px] text-fq-muted mb-3">
                Previewing {previewRows.filter((_, i) => !flagged.includes(i)).length} valid rows
                {flagged.length > 0 ? ` (${flagged.length} skipped)` : ''} from {previewRows.length} total.
              </p>
              <div className="overflow-x-auto rounded-lg border border-fq-border">
                <table className="w-full font-body text-[12px]">
                  <thead className="bg-fq-bg">
                    <tr>
                      <th className="text-left px-3 py-2 text-fq-muted font-medium">Name</th>
                      <th className="text-left px-3 py-2 text-fq-muted font-medium">Company</th>
                      <th className="text-left px-3 py-2 text-fq-muted font-medium">Category</th>
                      <th className="text-left px-3 py-2 text-fq-muted font-medium">Email</th>
                      <th className="text-left px-3 py-2 text-fq-muted font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, i) => (
                      <tr key={i} className={`border-t border-fq-border ${flagged.includes(i) ? 'opacity-40' : ''}`}>
                        <td className="px-3 py-2 text-fq-dark">{row.name || <span className="text-fq-alert">missing</span>}</td>
                        <td className="px-3 py-2 text-fq-muted">{row.company || '—'}</td>
                        <td className="px-3 py-2 text-fq-dark">{row.category || <span className="text-fq-alert">missing</span>}</td>
                        <td className="px-3 py-2 text-fq-muted">{row.email || '—'}</td>
                        <td className="px-3 py-2">
                          {flagged.includes(i) && (
                            <span className="bg-fq-alert/10 text-fq-alert font-body text-[10px] px-2 py-0.5 rounded-full">Skipped</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Step: done */}
          {step === 'done' && result && (
            <div className="text-center py-8">
              <div className="text-fq-sage text-[40px] mb-3">✓</div>
              <p className="font-heading text-[18px] text-fq-dark mb-2">Import complete</p>
              <p className="font-body text-[13px] text-fq-muted">
                {result.inserted} added · {result.updated} updated
                {result.errors.length > 0 ? ` · ${result.errors.length} failed` : ''}
              </p>
              {result.errors.length > 0 && (
                <div className="mt-4 text-left rounded-lg border border-fq-alert/30 bg-fq-alert/5 px-4 py-3 max-h-32 overflow-y-auto">
                  {result.errors.map((e, i) => (
                    <p key={i} className="font-body text-[11px] text-fq-alert">Row {e.row + 1}: {e.error}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-fq-border flex justify-between items-center">
          <button onClick={handleClose} className="font-body text-[13px] text-fq-muted hover:text-fq-dark transition-colors">
            {step === 'done' ? 'Close' : 'Cancel'}
          </button>
          <div className="flex gap-2">
            {step === 'map' && (
              <>
                <button onClick={() => setStep('upload')} className="font-body text-[13px] text-fq-muted hover:text-fq-dark transition-colors px-4 py-2">
                  Back
                </button>
                <button
                  onClick={buildPreview}
                  className="bg-fq-accent text-white font-body text-[13px] font-medium px-5 py-2 rounded-lg hover:bg-fq-accent/90 transition-colors"
                >
                  Preview
                </button>
              </>
            )}
            {step === 'preview' && (
              <>
                <button onClick={() => setStep('map')} className="font-body text-[13px] text-fq-muted hover:text-fq-dark transition-colors px-4 py-2">
                  Back
                </button>
                <button
                  onClick={runImport}
                  disabled={importing || previewRows.filter((_, i) => !flagged.includes(i)).length === 0}
                  className="bg-fq-accent text-white font-body text-[13px] font-medium px-5 py-2 rounded-lg hover:bg-fq-accent/90 transition-colors disabled:opacity-50"
                >
                  {importing ? 'Importing…' : `Import ${previewRows.filter((_, i) => !flagged.includes(i)).length} Vendors`}
                </button>
              </>
            )}
            {step === 'done' && (
              <button
                onClick={handleDone}
                className="bg-fq-accent text-white font-body text-[13px] font-medium px-5 py-2 rounded-lg hover:bg-fq-accent/90 transition-colors"
              >
                View Directory
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
