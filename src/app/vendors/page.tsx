'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { VendorDirectoryRow } from '@/lib/database.types';
import AddEditVendorModal from '@/components/vendors/AddEditVendorModal';
import VendorCSVImportModal from '@/components/vendors/VendorCSVImportModal';
import VendorPDFImportReview from '@/components/vendors/VendorPDFImportReview';

export default function VendorsPage() {
  const [vendors, setVendors] = useState<VendorDirectoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCSVModal, setShowCSVModal] = useState(false);
  const [showPDFReview, setShowPDFReview] = useState(false);
  const [pdfCandidates, setPdfCandidates] = useState<Partial<VendorDirectoryRow>[]>([]);
  const [importMenuOpen, setImportMenuOpen] = useState(false);
  const [uploadingPDF, setUploadingPDF] = useState(false);

  const fetchVendors = useCallback(async () => {
    try {
      const res = await fetch('/api/vendor-directory');
      if (res.ok) setVendors(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchVendors(); }, [fetchVendors]);

  // Derived category list with counts
  const categories = ['All', ...Array.from(new Set(vendors.map(v => v.category))).sort()];
  const categoryCounts: Record<string, number> = { All: vendors.length };
  vendors.forEach(v => {
    categoryCounts[v.category] = (categoryCounts[v.category] ?? 0) + 1;
  });

  // Filtered list
  const filtered = vendors.filter(v => {
    const matchCat = selectedCategory === 'All' || v.category === selectedCategory;
    const q = search.toLowerCase();
    const matchSearch = !q || v.name.toLowerCase().includes(q) || (v.company ?? '').toLowerCase().includes(q);
    return matchCat && matchSearch;
  });

  const handlePDFUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPDF(true);
    setImportMenuOpen(false);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/vendor-directory/import-pdf', { method: 'POST', body: form });
      if (!res.ok) throw new Error('PDF import failed');
      const candidates = await res.json();
      setPdfCandidates(candidates);
      setShowPDFReview(true);
    } catch {
      alert('Could not parse the PDF. Please try again.');
    } finally {
      setUploadingPDF(false);
      e.target.value = '';
    }
  };

  return (
    <div className="flex h-screen bg-fq-bg">
      {/* Category sidebar */}
      <aside className="w-[200px] shrink-0 border-r border-fq-border bg-fq-card flex flex-col pt-8 px-3 overflow-y-auto">
        <h2 className="font-heading text-[13px] font-semibold text-fq-muted uppercase tracking-wider px-2 mb-3">
          Categories
        </h2>
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`
              flex items-center justify-between px-3 py-2 rounded-lg font-body text-[13px] transition-colors text-left
              ${selectedCategory === cat
                ? 'bg-fq-light-accent text-fq-dark font-medium'
                : 'text-fq-muted hover:text-fq-dark hover:bg-fq-light-accent/40'
              }
            `}
          >
            <span className="truncate">{cat}</span>
            <span className={`text-[11px] ml-1 shrink-0 ${selectedCategory === cat ? 'text-fq-accent' : 'text-fq-muted/60'}`}>
              {categoryCounts[cat] ?? 0}
            </span>
          </button>
        ))}
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-8 py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="font-heading text-[28px] font-semibold text-fq-dark">Vendor Directory</h1>
              <p className="font-body text-[13px] text-fq-muted mt-0.5">
                {vendors.length} vendor{vendors.length !== 1 ? 's' : ''} across all projects
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* Import dropdown */}
              <div className="relative">
                <button
                  onClick={() => setImportMenuOpen(o => !o)}
                  className="flex items-center gap-1.5 border border-fq-border bg-fq-card text-fq-dark font-body text-[13px] px-4 py-2 rounded-lg hover:bg-fq-light-accent/40 transition-colors"
                >
                  {uploadingPDF ? 'Parsing PDF…' : 'Import'}
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M3 5l3 3 3-3" />
                  </svg>
                </button>
                {importMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setImportMenuOpen(false)} />
                    <div className="absolute right-0 top-full mt-1 z-20 bg-fq-card border border-fq-border rounded-xl shadow-lg w-44 py-1 overflow-hidden">
                      <button
                        onClick={() => { setImportMenuOpen(false); setShowCSVModal(true); }}
                        className="w-full text-left px-4 py-2.5 font-body text-[13px] text-fq-dark hover:bg-fq-light-accent/50 transition-colors"
                      >
                        Import CSV
                      </button>
                      <label className="w-full text-left px-4 py-2.5 font-body text-[13px] text-fq-dark hover:bg-fq-light-accent/50 transition-colors cursor-pointer flex items-center">
                        Import PDF
                        <input type="file" accept=".pdf" className="hidden" onChange={handlePDFUpload} />
                      </label>
                    </div>
                  </>
                )}
              </div>

              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-1.5 bg-fq-accent text-white font-body text-[13px] font-medium px-4 py-2 rounded-lg hover:bg-fq-accent/90 transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M7 2v10M2 7h10" />
                </svg>
                Add Vendor
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-6">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-fq-muted" width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <circle cx="6.5" cy="6.5" r="4" />
              <path d="M10 10l2.5 2.5" />
            </svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search vendors…"
              className="w-full pl-9 pr-4 py-2.5 bg-fq-card border border-fq-border rounded-xl font-body text-[13px] text-fq-dark outline-none focus:border-fq-accent/50 placeholder:text-fq-muted/50"
            />
          </div>

          {/* Vendor grid */}
          {loading ? (
            <div className="text-center py-24 text-fq-muted font-body text-[14px]">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-24">
              <p className="font-body text-[14px] text-fq-muted">
                {vendors.length === 0 ? 'No vendors yet. Add one or import from CSV.' : 'No vendors match your search.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map(vendor => (
                <VendorCard key={vendor.id} vendor={vendor} onDeleted={() => setVendors(v => v.filter(x => x.id !== vendor.id))} />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Modals */}
      <AddEditVendorModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSaved={(v) => { setVendors(prev => [v, ...prev]); setShowAddModal(false); }}
      />
      <VendorCSVImportModal
        open={showCSVModal}
        onClose={() => setShowCSVModal(false)}
        onImported={(newVendors) => setVendors(newVendors)}
      />
      {showPDFReview && (
        <VendorPDFImportReview
          candidates={pdfCandidates}
          onClose={() => setShowPDFReview(false)}
          onSaved={() => { fetchVendors(); setShowPDFReview(false); }}
        />
      )}
    </div>
  );
}

function VendorCard({ vendor, onDeleted }: { vendor: VendorDirectoryRow; onDeleted: () => void }) {
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setDeleting(true);
    await fetch(`/api/vendor-directory?id=${vendor.id}`, { method: 'DELETE' });
    onDeleted();
  };

  return (
    <Link
      href={`/vendors/${vendor.id}`}
      className="block bg-fq-card border border-fq-border rounded-xl p-4 hover:border-fq-accent/40 hover:shadow-sm transition-all group"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-heading text-[15px] font-semibold text-fq-dark truncate group-hover:text-fq-accent transition-colors">
            {vendor.name}
          </p>
          {vendor.company && (
            <p className="font-body text-[12px] text-fq-muted truncate">{vendor.company}</p>
          )}
        </div>
        <span className="shrink-0 bg-fq-light-accent text-fq-accent font-body text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap">
          {vendor.category}
        </span>
      </div>

      <div className="mt-3 space-y-1">
        {vendor.email && (
          <p className="font-body text-[11px] text-fq-muted truncate">{vendor.email}</p>
        )}
        {vendor.instagram && (
          <p className="font-body text-[11px] text-fq-muted">{vendor.instagram}</p>
        )}
        {vendor.phone && !vendor.email && !vendor.instagram && (
          <p className="font-body text-[11px] text-fq-muted">{vendor.phone}</p>
        )}
      </div>

      {/* Delete — stop propagation so clicking delete doesn't navigate */}
      <div className="mt-3 pt-2 border-t border-fq-border/60 flex justify-end" onClick={e => e.preventDefault()}>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className={`font-body text-[11px] transition-colors ${confirmDelete ? 'text-fq-alert' : 'text-fq-muted/40 hover:text-fq-muted'}`}
        >
          {deleting ? 'Deleting…' : confirmDelete ? 'Confirm delete' : 'Delete'}
        </button>
        {confirmDelete && !deleting && (
          <button
            onClick={e => { e.preventDefault(); setConfirmDelete(false); }}
            className="ml-3 font-body text-[11px] text-fq-muted/40 hover:text-fq-muted transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
    </Link>
  );
}
