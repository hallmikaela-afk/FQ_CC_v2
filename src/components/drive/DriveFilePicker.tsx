'use client';

import { useState, useEffect } from 'react';
import { DriveFileIcon } from './DriveFileIcon';

// Keep in sync with src/lib/google-drive.ts
const FQ_INTERNAL_SUBFOLDERS = [
  'Budgets', 'Client Questionnaires', 'Design Boards & Mockups',
  'Design Invoices & Contracts', 'Floorplans', 'Paper Goods', 'Photos',
  'Planning Checklists', 'Processional', 'RSVP Summaries', 'Timelines',
  'Vendor Contracts & Proposals', 'Venue Documents',
] as const;

export interface DrivePickerFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
  size: string | null;
  modifiedTime: string;
}

interface Props {
  /** If null, shows a project selector first */
  projectId: string | null;
  onSelect: (file: DrivePickerFile) => void;
  onClose: () => void;
  title?: string;
}

type Status = 'loading' | 'not_connected' | 'no_project' | 'not_provisioned' | 'ready';

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function DriveFilePicker({ projectId, onSelect, onClose, title = 'Pick from Drive' }: Props) {
  const [status, setStatus] = useState<Status>('loading');
  const [provisioning, setProvisioning] = useState(false);
  const [effectiveProjectId, setEffectiveProjectId] = useState<string | null>(projectId);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [activeTab, setActiveTab] = useState<'internal' | 'client'>('internal');
  const [expandedFolder, setExpandedFolder] = useState<string | null>(null);
  const [folderFiles, setFolderFiles] = useState<Record<string, DrivePickerFile[]>>({});
  const [loadingFolders, setLoadingFolders] = useState<Set<string>>(new Set());
  const [clientFiles, setClientFiles] = useState<DrivePickerFile[]>([]);
  const [clientLoading, setClientLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<DrivePickerFile | null>(null);

  useEffect(() => {
    const init = async () => {
      const statusRes = await fetch('/api/auth/google/status');
      const statusData = await statusRes.json();
      if (!statusData.connected) { setStatus('not_connected'); return; }

      if (!effectiveProjectId) {
        // Load projects for selector
        const pRes = await fetch('/api/projects');
        const pData: any[] = await pRes.json();
        setProjects(pData.filter(p => p.status === 'active').map(p => ({ id: p.id, name: p.name })));
        setStatus('no_project');
        return;
      }

      const provRes = await fetch(`/api/drive/provision?projectId=${effectiveProjectId}`);
      const provData = await provRes.json();
      setStatus(provData.provisioned ? 'ready' : 'not_provisioned');
    };
    init().catch(() => setStatus('not_connected'));
  }, [effectiveProjectId]);

  const selectProject = async (pid: string) => {
    setEffectiveProjectId(pid);
    setStatus('loading');
    const provRes = await fetch(`/api/drive/provision?projectId=${pid}`);
    const provData = await provRes.json();
    setStatus(provData.provisioned ? 'ready' : 'not_provisioned');
  };

  const fetchFolder = async (folderName: string) => {
    if (folderFiles[folderName] !== undefined || loadingFolders.has(folderName)) return;
    setLoadingFolders(prev => new Set(prev).add(folderName));
    try {
      const res = await fetch(`/api/drive/files?projectId=${effectiveProjectId}&folder=${encodeURIComponent(folderName)}`);
      const data = await res.json();
      setFolderFiles(prev => ({ ...prev, [folderName]: data.files ?? [] }));
    } catch {
      setFolderFiles(prev => ({ ...prev, [folderName]: [] }));
    }
    setLoadingFolders(prev => { const s = new Set(prev); s.delete(folderName); return s; });
  };

  const fetchClientFiles = async () => {
    if (clientFiles.length > 0 || clientLoading) return;
    setClientLoading(true);
    try {
      const res = await fetch(`/api/drive/files?projectId=${effectiveProjectId}&folder=client`);
      const data = await res.json();
      setClientFiles(data.files ?? []);
    } catch {}
    setClientLoading(false);
  };

  const toggleFolder = (name: string) => {
    if (expandedFolder === name) { setExpandedFolder(null); return; }
    setExpandedFolder(name);
    fetchFolder(name);
  };

  const handleTabChange = (tab: 'internal' | 'client') => {
    setActiveTab(tab);
    if (tab === 'client') fetchClientFiles();
  };

  const filterFiles = (files: DrivePickerFile[]) => {
    if (!search.trim()) return files;
    const q = search.toLowerCase();
    return files.filter(f => f.name.toLowerCase().includes(q));
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-fq-card rounded-2xl border border-fq-border shadow-2xl w-[520px] max-h-[80vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-fq-border shrink-0">
          <div className="flex items-center gap-2">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-fq-accent">
              <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
            </svg>
            <h2 className="font-heading text-[15px] font-semibold text-fq-dark">{title}</h2>
          </div>
          <button onClick={onClose} className="text-fq-muted/50 hover:text-fq-dark transition-colors text-[16px] leading-none">✕</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">

          {status === 'loading' && (
            <div className="flex-1 flex items-center justify-center">
              <p className="font-body text-[13px] text-fq-muted">Connecting to Drive...</p>
            </div>
          )}

          {status === 'not_connected' && (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8">
              <p className="font-body text-[13px] text-fq-muted text-center">Google Drive is not connected.</p>
              <a href="/api/auth/google/login" className="font-body text-[12px] font-medium bg-fq-dark text-white px-4 py-2 rounded-lg hover:bg-fq-accent transition-colors">Connect Drive</a>
            </div>
          )}

          {status === 'no_project' && (
            <div className="flex-1 flex flex-col p-5 gap-3">
              <p className="font-body text-[13px] text-fq-muted">Select a project to browse its Drive files.</p>
              <div className="space-y-1.5">
                {projects.map(p => (
                  <button
                    key={p.id}
                    onClick={() => selectProject(p.id)}
                    className="w-full text-left px-4 py-2.5 rounded-lg border border-fq-border hover:bg-fq-light-accent hover:border-fq-accent/30 transition-colors font-body text-[13px] text-fq-dark"
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {status === 'not_provisioned' && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
              <p className="font-body text-[13px] text-fq-muted text-center">Drive folders are not set up for this project yet.</p>
              <button
                onClick={async () => {
                  if (!effectiveProjectId || provisioning) return;
                  setProvisioning(true);
                  try {
                    const res = await fetch('/api/drive/provision', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ projectId: effectiveProjectId }),
                    });
                    const data = await res.json();
                    if (data.success) setStatus('ready');
                  } catch {}
                  setProvisioning(false);
                }}
                disabled={provisioning}
                className="font-body text-[12px] font-medium bg-fq-dark text-white px-4 py-2 rounded-lg hover:bg-fq-accent transition-colors disabled:opacity-50"
              >
                {provisioning ? 'Setting up...' : 'Set Up Drive Folders'}
              </button>
            </div>
          )}

          {status === 'ready' && (
            <>
              {/* Search */}
              <div className="px-4 py-2.5 border-b border-fq-border shrink-0">
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Filter files by name..."
                  className="w-full font-body text-[12.5px] text-fq-dark bg-fq-bg border border-fq-border rounded-lg px-3 py-1.5 outline-none focus:border-fq-accent/40 placeholder:text-fq-muted/40"
                />
              </div>

              {/* Tabs */}
              <div className="flex border-b border-fq-border shrink-0">
                {(['internal', 'client'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => handleTabChange(tab)}
                    className={`px-5 py-2.5 font-body text-[12.5px] font-medium transition-colors border-b-2 ${
                      activeTab === tab
                        ? 'text-fq-dark border-fq-accent'
                        : 'text-fq-muted border-transparent hover:text-fq-dark'
                    }`}
                  >
                    {tab === 'internal' ? 'Internal' : 'Client Shared'}
                  </button>
                ))}
              </div>

              {/* File tree */}
              <div className="flex-1 overflow-y-auto px-2 py-2">
                {activeTab === 'internal' && (
                  <div>
                    {FQ_INTERNAL_SUBFOLDERS.map(folderName => {
                      const isOpen = expandedFolder === folderName;
                      const files = filterFiles(folderFiles[folderName] ?? []);
                      const isLoading = loadingFolders.has(folderName);
                      return (
                        <div key={folderName}>
                          <button
                            onClick={() => toggleFolder(folderName)}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-fq-bg transition-colors text-left"
                          >
                            <svg
                              width="11" height="11" viewBox="0 0 12 12" fill="none"
                              stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                              className={`transition-transform shrink-0 text-fq-muted ${isOpen ? '' : '-rotate-90'}`}
                            >
                              <path d="M3 5l3 3 3-3" />
                            </svg>
                            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" className="text-fq-muted shrink-0">
                              <path d="M1.5 4a1 1 0 011-1h2.586a1 1 0 01.707.293L7 4.5h5a1 1 0 011 1V11a1 1 0 01-1 1H2.5a1 1 0 01-1-1V4z" />
                            </svg>
                            <span className="font-body text-[12.5px] text-fq-dark flex-1">{folderName}</span>
                            {folderFiles[folderName] !== undefined && (
                              <span className="font-body text-[10.5px] text-fq-muted/60 shrink-0">{folderFiles[folderName].length}</span>
                            )}
                          </button>

                          {isOpen && (
                            <div className="ml-7 mb-1">
                              {isLoading && (
                                <p className="px-3 py-1.5 font-body text-[11.5px] text-fq-muted/60">Loading...</p>
                              )}
                              {!isLoading && files.length === 0 && (
                                <p className="px-3 py-1.5 font-body text-[11.5px] text-fq-muted/50">No files in this folder yet</p>
                              )}
                              {!isLoading && files.map(file => (
                                <button
                                  key={file.id}
                                  onClick={() => setSelected(file)}
                                  className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg transition-colors text-left ${
                                    selected?.id === file.id
                                      ? 'bg-fq-light-accent border border-fq-accent/30'
                                      : 'hover:bg-fq-bg'
                                  }`}
                                >
                                  <DriveFileIcon mimeType={file.mimeType} size={22} />
                                  <div className="flex-1 min-w-0">
                                    <p className="font-body text-[12px] text-fq-dark truncate">{file.name}</p>
                                    <p className="font-body text-[10px] text-fq-muted/55">{fmtDate(file.modifiedTime)}</p>
                                  </div>
                                  {selected?.id === file.id && (
                                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-fq-accent shrink-0">
                                      <path d="M3 8l4 4 6-6" />
                                    </svg>
                                  )}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {activeTab === 'client' && (
                  <div className="px-1">
                    {clientLoading && <p className="px-3 py-2 font-body text-[11.5px] text-fq-muted/60">Loading...</p>}
                    {!clientLoading && filterFiles(clientFiles).length === 0 && (
                      <p className="px-3 py-4 font-body text-[12.5px] text-fq-muted/55">No files in the Client Shared folder yet</p>
                    )}
                    {!clientLoading && filterFiles(clientFiles).map(file => (
                      <button
                        key={file.id}
                        onClick={() => setSelected(file)}
                        className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg transition-colors text-left ${
                          selected?.id === file.id
                            ? 'bg-fq-light-accent border border-fq-accent/30'
                            : 'hover:bg-fq-bg'
                        }`}
                      >
                        <DriveFileIcon mimeType={file.mimeType} size={22} />
                        <div className="flex-1 min-w-0">
                          <p className="font-body text-[12px] text-fq-dark truncate">{file.name}</p>
                          <p className="font-body text-[10px] text-fq-muted/55">{fmtDate(file.modifiedTime)}</p>
                        </div>
                        {selected?.id === file.id && (
                          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-fq-accent shrink-0">
                            <path d="M3 8l4 4 6-6" />
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {status === 'ready' && (
          <div className="flex items-center justify-between px-5 py-3.5 border-t border-fq-border shrink-0">
            {selected ? (
              <p className="font-body text-[11.5px] text-fq-muted truncate max-w-[240px]">{selected.name}</p>
            ) : (
              <p className="font-body text-[11.5px] text-fq-muted/50">No file selected</p>
            )}
            <div className="flex items-center gap-2">
              <button onClick={onClose} className="font-body text-[12.5px] text-fq-muted hover:text-fq-dark transition-colors px-3 py-1.5">
                Cancel
              </button>
              <button
                onClick={() => selected && onSelect(selected)}
                disabled={!selected}
                className="font-body text-[12.5px] font-medium bg-fq-accent text-white px-5 py-1.5 rounded-lg hover:bg-fq-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Select
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
