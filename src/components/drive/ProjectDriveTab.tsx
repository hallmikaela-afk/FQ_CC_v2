'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { DriveFileIcon } from './DriveFileIcon';

const FQ_SUBFOLDERS = [
  'Budgets',
  'Client Questionnaires',
  'Design Boards & Mockups',
  'Design Invoices & Contracts',
  'Floorplans',
  'Paper Goods',
  'Photos',
  'Planning Checklists',
  'Processional',
  'RSVP Summaries',
  'Timelines',
  'Vendor Contracts & Proposals',
  'Venue Documents',
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

export default function ProjectDriveTab({ projectId }: { projectId: string }) {
  const [status, setStatus] = useState<Status>('loading');
  const [driveData, setDriveData] = useState<{ internalFolderUrl: string; clientFolderUrl: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string>(FQ_SUBFOLDERS[0]);
  const [fileCache, setFileCache] = useState<Record<string, DriveFile[]>>({});
  const [countCache, setCountCache] = useState<Record<string, number>>({});
  const [folderLoading, setFolderLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchStatus = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      const [provRes, statusRes] = await Promise.all([
        fetch(`/api/drive/provision?projectId=${projectId}`),
        fetch('/api/auth/google/status'),
      ]);
      const [prov, stat] = await Promise.all([provRes.json(), statusRes.json()]);
      if (!stat.connected) {
        setStatus('not_connected');
      } else if (prov.provisioned) {
        setDriveData({ internalFolderUrl: prov.internalFolderUrl, clientFolderUrl: prov.clientFolderUrl });
        setStatus('provisioned');
      } else {
        setStatus('not_provisioned');
      }
    } catch {
      setStatus('not_connected');
    }
  }, [projectId]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const loadFolder = useCallback(async (folder: string) => {
    if (fileCache[folder] !== undefined) return;
    setFolderLoading(true);
    try {
      const res = await fetch(`/api/drive/files?projectId=${projectId}&folder=${encodeURIComponent(folder)}`);
      const data = await res.json();
      const files: DriveFile[] = data.files ?? [];
      setFileCache(prev => ({ ...prev, [folder]: files }));
      setCountCache(prev => ({ ...prev, [folder]: files.length }));
    } catch {}
    setFolderLoading(false);
  }, [fileCache, projectId]);

  useEffect(() => {
    if (status === 'provisioned') loadFolder(selectedFolder);
  }, [status, selectedFolder, loadFolder]);

  const handleFolderClick = (folder: string) => {
    setSelectedFolder(folder);
    loadFolder(folder);
  };

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

  const uploadFile = async (file: File) => {
    setUploading(true);
    setUploadMsg(null);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('projectId', projectId);
    formData.append('subfolder', selectedFolder);
    try {
      const res = await fetch('/api/drive/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.success) {
        setFileCache(prev => ({
          ...prev,
          [selectedFolder]: [data.file, ...(prev[selectedFolder] ?? [])],
        }));
        setCountCache(prev => ({ ...prev, [selectedFolder]: (prev[selectedFolder] ?? 0) + 1 }));
        setUploadMsg('Saved ✓');
      } else {
        setUploadMsg(data.error ?? 'Upload failed');
      }
    } catch {
      setUploadMsg('Upload failed');
    }
    setUploading(false);
    setTimeout(() => setUploadMsg(null), 3000);
  };

  if (status === 'loading') {
    return (
      <div className="p-8">
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-8 bg-fq-border/20 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (status === 'not_connected') {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <p className="font-body text-[13px] text-fq-muted">Google Drive is not connected.</p>
        <a href="/api/auth/google/login"
          className="font-body text-[12px] font-medium bg-fq-dark text-white px-4 py-2 rounded-lg hover:bg-fq-accent transition-colors">
          Connect Google Drive to use this feature
        </a>
      </div>
    );
  }

  if (status === 'not_provisioned') {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        {error && <p className="font-body text-[12px] text-red-500">{error}</p>}
        <p className="font-body text-[13px] text-fq-muted">No Drive folders have been set up for this project yet.</p>
        <button onClick={provision}
          className="font-body text-[12px] font-medium bg-fq-dark text-white px-4 py-2 rounded-lg hover:bg-fq-accent transition-colors">
          Set Up Drive Folders
        </button>
      </div>
    );
  }

  if (status === 'provisioning') {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="font-body text-[12px] text-fq-muted/60">Creating folder structure in Drive...</p>
      </div>
    );
  }

  const currentFiles = fileCache[selectedFolder];

  return (
    <div className="flex flex-col h-full">
      {/* Top links */}
      {driveData && (
        <div className="flex items-center gap-6 mb-5">
          <a href={driveData.internalFolderUrl} target="_blank" rel="noopener noreferrer"
            className="font-body text-[12px] text-fq-muted hover:text-fq-accent transition-colors">
            Open Internal Folder ↗
          </a>
          <a href={driveData.clientFolderUrl} target="_blank" rel="noopener noreferrer"
            className="font-body text-[12px] text-fq-muted hover:text-fq-accent transition-colors">
            Open Client Shared Folder ↗
          </a>
        </div>
      )}

      {/* Two-column layout */}
      <div className="flex gap-0 border border-fq-border rounded-xl overflow-hidden flex-1">
        {/* Left: subfolder list */}
        <div className="w-[240px] shrink-0 border-r border-fq-border bg-fq-bg overflow-y-auto">
          {FQ_SUBFOLDERS.map(folder => {
            const isSelected = folder === selectedFolder;
            const count = countCache[folder];
            return (
              <button
                key={folder}
                onClick={() => handleFolderClick(folder)}
                className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-left transition-colors border-b border-fq-border/40 last:border-0 ${
                  isSelected
                    ? 'bg-fq-light-accent text-fq-dark'
                    : 'text-fq-muted hover:text-fq-dark hover:bg-fq-light-accent/40'
                }`}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
                <span className="font-body text-[12px] flex-1 truncate">{folder}</span>
                {count !== undefined && (
                  <span className="font-body text-[10px] text-fq-muted/50 shrink-0">{count}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Right: file list */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Right header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-fq-border">
            <span className="font-body text-[12.5px] font-medium text-fq-dark">{selectedFolder}</span>
            <div className="flex items-center gap-3">
              {uploadMsg && (
                <span className={`font-body text-[11px] ${uploadMsg.includes('✓') ? 'text-fq-sage' : 'text-red-400'}`}>
                  {uploadMsg}
                </span>
              )}
              <input ref={fileInputRef} type="file" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f); e.target.value = ''; }} />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="font-body text-[11.5px] font-medium text-fq-muted hover:text-fq-dark border border-fq-border rounded-lg px-3 py-1.5 hover:bg-fq-light-accent/40 transition-colors"
              >
                {uploading ? 'Uploading...' : 'Upload'}
              </button>
            </div>
          </div>

          {/* File list */}
          <div
            className={`flex-1 overflow-y-auto relative ${dragOver ? 'bg-fq-light-accent' : ''}`}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files[0];
              if (f) uploadFile(f);
            }}
          >
            {dragOver && (
              <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                <span className="font-body text-[13px] text-fq-accent">Drop to upload to {selectedFolder}</span>
              </div>
            )}

            {folderLoading && !currentFiles && (
              <div className="p-5 space-y-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-10 bg-fq-border/15 rounded animate-pulse" />
                ))}
              </div>
            )}

            {!folderLoading && currentFiles && currentFiles.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full py-16 gap-2">
                <p className="font-body text-[12.5px] text-fq-muted/55">No files in this folder yet</p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="font-body text-[11.5px] text-fq-accent hover:underline"
                >
                  Upload a file
                </button>
              </div>
            )}

            {currentFiles && currentFiles.length > 0 && (
              <div>
                {/* Subtle drop zone bar at top when files exist */}
                <div
                  className="flex items-center gap-2 px-5 py-2 border-b border-fq-border/30 cursor-pointer hover:bg-fq-light-accent/30 transition-colors group"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-fq-muted/40 group-hover:text-fq-muted shrink-0">
                    <path d="M7 9.5V2M4.5 4.5L7 2l2.5 2.5M1.5 11.5h11" />
                  </svg>
                  <span className="font-body text-[10.5px] text-fq-muted/40 group-hover:text-fq-muted">Drop files here or click to upload</span>
                </div>

                {currentFiles.map(file => (
                  <a
                    key={file.id}
                    href={file.webViewLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-5 py-3 border-b border-fq-border/30 last:border-0 hover:bg-fq-bg transition-colors group"
                  >
                    <DriveFileIcon mimeType={file.mimeType} size={28} />
                    <div className="flex-1 min-w-0">
                      <p className="font-body text-[12.5px] text-fq-dark truncate group-hover:text-fq-accent transition-colors">{file.name}</p>
                      <p className="font-body text-[10.5px] text-fq-muted/50">{fmtDate(file.modifiedTime)}</p>
                    </div>
                    <span className="font-body text-[11px] text-fq-muted/40 group-hover:text-fq-accent/70 shrink-0">Open ↗</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
