'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import DriveSubfolderBrowser from './DriveSubfolderBrowser';
import { DriveFileIcon } from './DriveFileIcon';

// Keep in sync with src/lib/google-drive.ts
const FQ_INTERNAL_SUBFOLDERS = [
  'Budgets', 'Client Questionnaires', 'Design Boards & Mockups',
  'Design Invoices & Contracts', 'Floorplans', 'Paper Goods', 'Photos',
  'Planning Checklists', 'Processional', 'RSVP Summaries', 'Timelines',
  'Vendor Contracts & Proposals', 'Venue Documents',
] as const;

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
  modifiedTime: string;
}

type Status = 'loading' | 'not_connected' | 'not_provisioned' | 'provisioned' | 'provisioning';

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ProjectDriveSection({ projectId }: { projectId: string }) {
  const [status, setStatus] = useState<Status>('loading');
  const [driveData, setDriveData] = useState<{ internalFolderUrl: string; clientFolderUrl: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'internal' | 'client'>('internal');
  const [openFolder, setOpenFolder] = useState<string | null>(null);
  const [clientFiles, setClientFiles] = useState<DriveFile[]>([]);
  const [clientLoading, setClientLoading] = useState(false);
  const [clientLoaded, setClientLoaded] = useState(false);
  const clientDropRef = useRef<HTMLInputElement>(null);
  const [clientDragOver, setClientDragOver] = useState(false);
  const [clientUploading, setClientUploading] = useState(false);
  const [clientUploadMsg, setClientUploadMsg] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      const res = await fetch(`/api/drive/provision?projectId=${projectId}`);
      const data = await res.json();
      if (data.provisioned) {
        setDriveData({ internalFolderUrl: data.internalFolderUrl, clientFolderUrl: data.clientFolderUrl });
        setStatus('provisioned');
      } else {
        const statusRes = await fetch('/api/auth/google/status');
        const statusData = await statusRes.json();
        setStatus(statusData.connected ? 'not_provisioned' : 'not_connected');
      }
    } catch {
      setStatus('not_connected');
    }
  }, [projectId]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const provision = async () => {
    setStatus('provisioning');
    setError(null);
    try {
      const res = await fetch('/api/drive/provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      });
      const data = await res.json();
      if (data.success) {
        setDriveData({ internalFolderUrl: data.internalFolderUrl, clientFolderUrl: data.clientFolderUrl });
        setStatus('provisioned');
      } else {
        setError(data.error ?? 'Failed to set up Drive folders.');
        setStatus('not_provisioned');
      }
    } catch {
      setError('Failed to set up Drive folders.');
      setStatus('not_provisioned');
    }
  };

  const loadClientFiles = async () => {
    if (clientLoaded || clientLoading) return;
    setClientLoading(true);
    try {
      const res = await fetch(`/api/drive/files?projectId=${projectId}&folder=client`);
      const data = await res.json();
      setClientFiles(data.files ?? []);
      setClientLoaded(true);
    } catch {}
    setClientLoading(false);
  };

  const handleTabChange = (tab: 'internal' | 'client') => {
    setActiveTab(tab);
    if (tab === 'client') loadClientFiles();
  };

  const uploadClientFile = async (file: File) => {
    setClientUploading(true);
    setClientUploadMsg(null);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('projectId', projectId);
    formData.append('subfolder', 'client');
    try {
      const res = await fetch('/api/drive/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.success) {
        setClientFiles(prev => [data.file, ...prev]);
        setClientUploadMsg('Uploaded ✓');
      } else {
        setClientUploadMsg(data.error ?? 'Upload failed');
      }
    } catch {
      setClientUploadMsg('Upload failed');
    }
    setClientUploading(false);
    setTimeout(() => setClientUploadMsg(null), 3000);
  };

  return (
    <div className="bg-fq-card rounded-xl border border-fq-border shadow-sm p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-heading text-[18px] font-semibold text-fq-dark/90">Drive Files</h2>
        {status === 'provisioned' && driveData && (
          <div className="flex items-center gap-4">
            <a href={driveData.internalFolderUrl} target="_blank" rel="noopener noreferrer"
              className="font-body text-[11.5px] text-fq-muted hover:text-fq-accent transition-colors">
              Internal ↗
            </a>
            <a href={driveData.clientFolderUrl} target="_blank" rel="noopener noreferrer"
              className="font-body text-[11.5px] text-fq-muted hover:text-fq-accent transition-colors">
              Client Shared ↗
            </a>
          </div>
        )}
      </div>

      {/* Status states */}
      {status === 'loading' && (
        <p className="font-body text-[12px] text-fq-muted/60">Checking Drive connection...</p>
      )}

      {status === 'not_connected' && (
        <div className="space-y-3">
          <p className="font-body text-[13px] text-fq-muted">Google Drive is not connected.</p>
          <a href="/api/auth/google/login"
            className="inline-block font-body text-[12px] font-medium bg-fq-dark text-white px-4 py-2 rounded-lg hover:bg-fq-accent transition-colors">
            Connect Google Drive
          </a>
        </div>
      )}

      {status === 'not_provisioned' && (
        <div className="space-y-3">
          {error && <p className="font-body text-[12px] text-red-500">{error}</p>}
          <p className="font-body text-[13px] text-fq-muted">No Drive folders set up for this project yet.</p>
          <button onClick={provision}
            className="font-body text-[12px] font-medium bg-fq-dark text-white px-4 py-2 rounded-lg hover:bg-fq-accent transition-colors">
            Set Up Drive Folders
          </button>
        </div>
      )}

      {status === 'provisioning' && (
        <p className="font-body text-[12px] text-fq-muted/60">Creating folder structure in Drive...</p>
      )}

      {status === 'provisioned' && (
        <>
          {/* Tabs */}
          <div className="flex border-b border-fq-border mb-4 -mx-1">
            {(['internal', 'client'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => handleTabChange(tab)}
                className={`px-4 py-2 font-body text-[12.5px] font-medium transition-colors border-b-2 ${
                  activeTab === tab
                    ? 'text-fq-dark border-fq-accent'
                    : 'text-fq-muted border-transparent hover:text-fq-dark'
                }`}
              >
                {tab === 'internal' ? 'Internal' : 'Client Shared'}
              </button>
            ))}
          </div>

          {/* Internal: 13 subfolders */}
          {activeTab === 'internal' && (
            <div className="space-y-2">
              {FQ_INTERNAL_SUBFOLDERS.map(name => (
                <DriveSubfolderBrowser
                  key={name}
                  name={name}
                  projectId={projectId}
                  isOpen={openFolder === name}
                  onToggle={() => setOpenFolder(prev => prev === name ? null : name)}
                />
              ))}
            </div>
          )}

          {/* Client Shared */}
          {activeTab === 'client' && (
            <div className="border border-fq-border rounded-xl overflow-hidden">
              {clientLoading && (
                <p className="px-4 py-3 font-body text-[12px] text-fq-muted/60">Loading...</p>
              )}
              {!clientLoading && clientFiles.map(file => (
                <a
                  key={file.id}
                  href={file.webViewLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-4 py-2.5 border-b border-fq-border last:border-0 hover:bg-fq-bg transition-colors group"
                >
                  <DriveFileIcon mimeType={file.mimeType} size={26} />
                  <div className="flex-1 min-w-0">
                    <p className="font-body text-[12.5px] text-fq-dark truncate group-hover:text-fq-accent transition-colors">{file.name}</p>
                    <p className="font-body text-[10.5px] text-fq-muted/55">{fmtDate(file.modifiedTime)}</p>
                  </div>
                  <span className="font-body text-[10.5px] text-fq-muted/40 group-hover:text-fq-accent/60 shrink-0">↗</span>
                </a>
              ))}
              {!clientLoading && clientLoaded && clientFiles.length === 0 && (
                <p className="px-4 py-3 font-body text-[12px] text-fq-muted/55">No files in the Client Shared folder yet</p>
              )}
              {/* Upload drop zone for client folder */}
              <div className="px-4 py-3 border-t border-fq-border/50">
                <input ref={clientDropRef} type="file" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadClientFile(f); e.target.value = ''; }} />
                <div
                  onDragOver={e => { e.preventDefault(); setClientDragOver(true); }}
                  onDragLeave={() => setClientDragOver(false)}
                  onDrop={e => { e.preventDefault(); setClientDragOver(false); const f = e.dataTransfer.files[0]; if (f) uploadClientFile(f); }}
                  onClick={() => clientDropRef.current?.click()}
                  className={`flex items-center gap-2.5 py-2 px-3 border border-dashed rounded-lg cursor-pointer transition-all ${
                    clientDragOver ? 'border-fq-accent bg-fq-light-accent' : 'border-fq-border/60 hover:border-fq-muted'
                  }`}
                >
                  <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 ${clientDragOver ? 'text-fq-accent' : 'text-fq-muted/60'}`}>
                    <path d="M7 9.5V2M4.5 4.5L7 2l2.5 2.5M1.5 11.5h11" />
                  </svg>
                  <span className={`font-body text-[11.5px] ${clientUploadMsg?.includes('✓') ? 'text-fq-sage' : 'text-fq-muted/65'}`}>
                    {clientUploading ? 'Uploading...' : clientUploadMsg ?? 'Drop a file or click to upload'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
