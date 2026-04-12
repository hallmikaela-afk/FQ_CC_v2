'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { VendorDirectoryRow, VendorContactRow, VendorDocumentRow, VendorProjectLinkRow } from '@/lib/database.types';
import AddEditVendorModal from '@/components/vendors/AddEditVendorModal';
import AddContactModal from '@/components/vendors/AddContactModal';
import LinkDocumentModal from '@/components/vendors/LinkDocumentModal';

interface ProjectBasic {
  id: string;
  name: string;
  slug: string | null;
  color: string;
}

interface VendorWithRelations extends VendorDirectoryRow {
  vendor_contacts: VendorContactRow[];
  vendor_documents: VendorDocumentRow[];
  vendor_project_links: (VendorProjectLinkRow & { projects: ProjectBasic })[];
}

const STATUS_COLORS: Record<string, string> = {
  Unsigned: 'bg-fq-amber/10 text-fq-amber',
  Executed: 'bg-fq-sage/15 text-fq-sage',
  Superseded: 'bg-fq-muted/10 text-fq-muted',
  Archived: 'bg-fq-muted/10 text-fq-muted',
};

export default function VendorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [vendor, setVendor] = useState<VendorWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [editingContact, setEditingContact] = useState<VendorContactRow | null>(null);
  const [showDocModal, setShowDocModal] = useState(false);
  const [showLinkProject, setShowLinkProject] = useState(false);
  const [allProjects, setAllProjects] = useState<ProjectBasic[]>([]);
  const [linkingProject, setLinkingProject] = useState(false);

  const fetchVendor = useCallback(async () => {
    try {
      const res = await fetch(`/api/vendor-directory/${id}`);
      if (res.status === 404) { router.replace('/vendors'); return; }
      if (res.ok) setVendor(await res.json());
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => { fetchVendor(); }, [fetchVendor]);

  useEffect(() => {
    if (showLinkProject && allProjects.length === 0) {
      fetch('/api/projects')
        .then(r => r.json())
        .then(data => setAllProjects(data.filter((p: any) => p.status === 'active')));
    }
  }, [showLinkProject, allProjects.length]);

  const handleDeleteContact = async (contactId: string) => {
    await fetch(`/api/vendor-contacts?id=${contactId}`, { method: 'DELETE' });
    setVendor(v => v ? { ...v, vendor_contacts: v.vendor_contacts.filter(c => c.id !== contactId) } : v);
  };

  const handleStarContact = async (contact: VendorContactRow) => {
    const res = await fetch('/api/vendor-contacts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: contact.id, vendor_id: vendor?.id, is_primary: true }),
    });
    if (res.ok) {
      const updated = await res.json();
      setVendor(v => v ? {
        ...v,
        vendor_contacts: v.vendor_contacts.map(c =>
          c.id === updated.id ? updated : { ...c, is_primary: false }
        ),
      } : v);
    }
  };

  const handleDeleteDoc = async (docId: string) => {
    await fetch(`/api/vendor-documents?id=${docId}`, { method: 'DELETE' });
    setVendor(v => v ? { ...v, vendor_documents: v.vendor_documents.filter(d => d.id !== docId) } : v);
  };

  const handleUnlinkProject = async (linkId: string) => {
    await fetch(`/api/vendor-project-links?id=${linkId}`, { method: 'DELETE' });
    setVendor(v => v ? { ...v, vendor_project_links: v.vendor_project_links.filter(l => l.id !== linkId) } : v);
  };

  const handleLinkProject = async (project: ProjectBasic) => {
    if (!vendor) return;
    setLinkingProject(true);
    try {
      const res = await fetch('/api/vendor-project-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vendor_id: vendor.id, project_id: project.id }),
      });
      if (res.ok) {
        const link = await res.json();
        setVendor(v => v ? { ...v, vendor_project_links: [...v.vendor_project_links, link] } : v);
        setShowLinkProject(false);
      } else if (res.status === 409) {
        setShowLinkProject(false); // Already linked — silently close
      }
    } finally {
      setLinkingProject(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-fq-muted font-body text-[14px]">
        Loading…
      </div>
    );
  }

  if (!vendor) return null;

  const linkedProjectIds = new Set(vendor.vendor_project_links.map(l => l.project_id));
  const unlinkableProjects = allProjects.filter(p => !linkedProjectIds.has(p.id));

  return (
    <div className="max-w-3xl mx-auto px-8 py-8">
      {/* Back */}
      <Link href="/vendors" className="flex items-center gap-1.5 font-body text-[12px] text-fq-muted hover:text-fq-dark transition-colors mb-6">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M9 3L5 7l4 4" />
        </svg>
        Vendor Directory
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="font-heading text-[28px] font-semibold text-fq-dark">{vendor.name}</h1>
            <span className="bg-fq-light-accent text-fq-accent font-body text-[11px] px-2.5 py-1 rounded-full">
              {vendor.category}
            </span>
          </div>
          {vendor.company && (
            <p className="font-body text-[14px] text-fq-muted">{vendor.company}</p>
          )}
        </div>
        <button
          onClick={() => setShowEditModal(true)}
          className="shrink-0 flex items-center gap-1.5 border border-fq-border bg-fq-card text-fq-dark font-body text-[12px] px-3 py-2 rounded-lg hover:bg-fq-light-accent/40 transition-colors"
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M9.5 1.5l2 2-7 7H2.5v-2l7-7z" />
          </svg>
          Edit
        </button>
      </div>

      {/* Contact info */}
      <div className="bg-fq-card border border-fq-border rounded-xl p-5 mb-6">
        <h2 className="font-heading text-[13px] font-semibold text-fq-muted uppercase tracking-wider mb-4">Contact Info</h2>
        <div className="grid grid-cols-2 gap-x-6 gap-y-3">
          {[
            { label: 'Email', value: vendor.email, href: vendor.email ? `mailto:${vendor.email}` : undefined },
            { label: 'Phone', value: vendor.phone, href: vendor.phone ? `tel:${vendor.phone}` : undefined },
            { label: 'Instagram', value: vendor.instagram, href: vendor.instagram ? `https://instagram.com/${vendor.instagram.replace('@', '')}` : undefined },
            { label: 'Website', value: vendor.website, href: vendor.website ?? undefined },
          ].map(({ label, value, href }) => (
            value ? (
              <div key={label}>
                <p className="font-body text-[10px] text-fq-muted uppercase tracking-wide mb-0.5">{label}</p>
                {href ? (
                  <a href={href} target="_blank" rel="noopener noreferrer" className="font-body text-[13px] text-fq-accent hover:underline underline-offset-2">
                    {value}
                  </a>
                ) : (
                  <p className="font-body text-[13px] text-fq-dark">{value}</p>
                )}
              </div>
            ) : null
          ))}
        </div>
        {vendor.notes && (
          <div className="mt-4 pt-4 border-t border-fq-border">
            <p className="font-body text-[10px] text-fq-muted uppercase tracking-wide mb-1">Notes</p>
            <p className="font-body text-[13px] text-fq-dark whitespace-pre-line">{vendor.notes}</p>
          </div>
        )}
      </div>

      {/* Contacts */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-heading text-[16px] font-semibold text-fq-dark">Contacts</h2>
          <button
            onClick={() => { setEditingContact(null); setShowContactModal(true); }}
            className="flex items-center gap-1 font-body text-[12px] text-fq-accent hover:text-fq-accent/80 transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6.5 2v9M2 6.5h9" />
            </svg>
            Add Contact
          </button>
        </div>

        {vendor.vendor_contacts.length === 0 ? (
          <p className="font-body text-[13px] text-fq-muted/60 italic">No contacts yet.</p>
        ) : (
          <div className="bg-fq-card border border-fq-border rounded-xl overflow-hidden">
            {vendor.vendor_contacts
              .sort((a, b) => Number(b.is_primary) - Number(a.is_primary))
              .map((contact, i) => (
                <div key={contact.id} className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t border-fq-border' : ''}`}>
                  {/* Star */}
                  <button
                    onClick={() => handleStarContact(contact)}
                    title={contact.is_primary ? 'Primary contact' : 'Set as primary'}
                    className="shrink-0 transition-colors"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill={contact.is_primary ? '#8B6F4E' : 'none'} stroke={contact.is_primary ? '#8B6F4E' : '#9B8E82'} strokeWidth="1.5">
                      <path d="M8 1l1.8 3.6 4 .6-2.9 2.8.7 4L8 10.1 4.4 12l.7-4L2.2 5.2l4-.6z" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>

                  <div className="flex-1 min-w-0">
                    <p className="font-body text-[13px] text-fq-dark font-medium">{contact.name}</p>
                    <p className="font-body text-[11px] text-fq-muted">
                      {[contact.title, contact.email, contact.phone].filter(Boolean).join(' · ')}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => { setEditingContact(contact); setShowContactModal(true); }}
                      className="text-fq-muted/40 hover:text-fq-muted transition-colors"
                    >
                      <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                        <path d="M9.5 1.5l2 2-7 7H2.5v-2l7-7z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDeleteContact(contact.id)}
                      className="text-fq-muted/40 hover:text-fq-alert transition-colors"
                    >
                      <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                        <path d="M2 3h9M4 3V2h5v1M5 6v4M8 6v4M3 3l.5 8h6L10 3" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}
      </section>

      {/* Documents */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-heading text-[16px] font-semibold text-fq-dark">Documents</h2>
          <button
            onClick={() => setShowDocModal(true)}
            className="flex items-center gap-1 font-body text-[12px] text-fq-accent hover:text-fq-accent/80 transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6.5 2v9M2 6.5h9" />
            </svg>
            Link Document
          </button>
        </div>

        {vendor.vendor_documents.length === 0 ? (
          <p className="font-body text-[13px] text-fq-muted/60 italic">No documents linked yet.</p>
        ) : (
          <div className="bg-fq-card border border-fq-border rounded-xl overflow-hidden">
            {vendor.vendor_documents
              .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
              .map((doc, i) => (
                <div key={doc.id} className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t border-fq-border' : ''}`}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" className="text-fq-muted shrink-0">
                    <path d="M8 1.5H3a1 1 0 00-1 1v9a1 1 0 001 1h8a1 1 0 001-1V5.5L8 1.5z" />
                    <path d="M8 1.5V5.5h4" />
                  </svg>

                  <div className="flex-1 min-w-0">
                    {doc.drive_url ? (
                      <a
                        href={doc.drive_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-body text-[13px] text-fq-dark hover:text-fq-accent transition-colors truncate block"
                      >
                        {doc.display_name}
                      </a>
                    ) : (
                      <p className="font-body text-[13px] text-fq-dark truncate">{doc.display_name}</p>
                    )}
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-body text-[10px] text-fq-muted">{doc.doc_type}</span>
                      {doc.date && <span className="font-body text-[10px] text-fq-muted/60">{new Date(doc.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`font-body text-[10px] px-2 py-0.5 rounded-full ${STATUS_COLORS[doc.status] ?? 'bg-fq-muted/10 text-fq-muted'}`}>
                      {doc.status}
                    </span>
                    <button
                      onClick={() => handleDeleteDoc(doc.id)}
                      className="text-fq-muted/40 hover:text-fq-alert transition-colors"
                    >
                      <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                        <path d="M2 3h9M4 3V2h5v1M5 6v4M8 6v4M3 3l.5 8h6L10 3" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}
      </section>

      {/* Used On */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-heading text-[16px] font-semibold text-fq-dark">Used On</h2>
          <button
            onClick={() => setShowLinkProject(v => !v)}
            className="flex items-center gap-1 font-body text-[12px] text-fq-accent hover:text-fq-accent/80 transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6.5 2v9M2 6.5h9" />
            </svg>
            Link Project
          </button>
        </div>

        {/* Project search dropdown */}
        {showLinkProject && (
          <div className="bg-fq-card border border-fq-border rounded-xl overflow-hidden mb-3">
            {unlinkableProjects.length === 0 ? (
              <p className="px-4 py-3 font-body text-[12px] text-fq-muted">All active projects are already linked.</p>
            ) : (
              unlinkableProjects.map((p, i) => (
                <button
                  key={p.id}
                  onClick={() => handleLinkProject(p)}
                  disabled={linkingProject}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-fq-light-accent/40 transition-colors ${i > 0 ? 'border-t border-fq-border' : ''}`}
                >
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                  <span className="font-body text-[13px] text-fq-dark">{p.name}</span>
                </button>
              ))
            )}
          </div>
        )}

        {vendor.vendor_project_links.length === 0 ? (
          <p className="font-body text-[13px] text-fq-muted/60 italic">Not linked to any projects yet.</p>
        ) : (
          <div className="bg-fq-card border border-fq-border rounded-xl overflow-hidden">
            {vendor.vendor_project_links.map((link, i) => (
              <div key={link.id} className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t border-fq-border' : ''}`}>
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: link.projects?.color ?? '#8B6F4E' }} />
                <Link
                  href={`/projects/${link.projects?.slug ?? link.project_id}`}
                  className="flex-1 font-body text-[13px] text-fq-dark hover:text-fq-accent transition-colors"
                >
                  {link.projects?.name ?? 'Unknown Project'}
                </Link>
                {link.role_notes && (
                  <span className="font-body text-[11px] text-fq-muted">{link.role_notes}</span>
                )}
                <button
                  onClick={() => handleUnlinkProject(link.id)}
                  className="text-fq-muted/40 hover:text-fq-alert transition-colors shrink-0"
                >
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M2 2l9 9M11 2L2 11" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Modals */}
      <AddEditVendorModal
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        existing={vendor}
        onSaved={(updated) => { setVendor(v => v ? { ...v, ...updated } : v); setShowEditModal(false); }}
      />
      <AddContactModal
        open={showContactModal}
        onClose={() => { setShowContactModal(false); setEditingContact(null); }}
        vendorId={vendor.id}
        existing={editingContact}
        onSaved={(saved) => {
          setVendor(v => {
            if (!v) return v;
            const exists = v.vendor_contacts.find(c => c.id === saved.id);
            const contacts = exists
              ? v.vendor_contacts.map(c => c.id === saved.id ? saved : (saved.is_primary ? { ...c, is_primary: false } : c))
              : [...v.vendor_contacts, saved];
            if (saved.is_primary) {
              return { ...v, vendor_contacts: contacts.map(c => c.id === saved.id ? c : { ...c, is_primary: false }) };
            }
            return { ...v, vendor_contacts: contacts };
          });
          setShowContactModal(false);
          setEditingContact(null);
        }}
      />
      <LinkDocumentModal
        open={showDocModal}
        onClose={() => setShowDocModal(false)}
        vendorId={vendor.id}
        vendorName={vendor.name}
        existingDocs={vendor.vendor_documents}
        onSaved={(doc) => { setVendor(v => v ? { ...v, vendor_documents: [doc, ...v.vendor_documents] } : v); setShowDocModal(false); }}
      />
    </div>
  );
}
