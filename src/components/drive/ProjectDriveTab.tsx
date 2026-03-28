'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { DriveFileIcon } from './DriveFileIcon';

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
  modifiedTime: string;
}

type Status = 'loading' | 'not_connected' | 'not_provisioned' | 'provisioned' | 'provisioning';
type SetupMode = 'choose' | 'link' | 'create';

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function extractFolderId(url: string): string | null {
  // Handles URLs like: https://drive.google.com/drive/folders/FOLDER_ID
  // or bare folder IDs
  const match = url.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  // Bare ID (no slashes)
  if (/^[a-zA-Z0-9_-]{20,}$/.test(url.trim())) return url.trim();
  return null;
}

export default function ProjectDriveTab({ projectId }: { projectId: string }) {
  const [status, setStatus] = useState<Status>('loading');
  const [driveData, setDriveData] = useState<{ internalFolderUrl: string; rootFolderUrl?: string } | null>(null);
  const [subfolders, setSubfolders] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string>('');
  const [fileCache, setFileCache] = useState<Record<string, DriveFile[]>>({});
  const [countCache, setCountCache] = useState<Record<string, number>>({});
  const [folderLoading, setFolderLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Setup flow state
  const [setupMode, setSetupMode] = useState<SetupMode>('choose');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkError, setLinkError] = useState<string | null>(null);

  const applyProvisionData = (prov: {
    internalFolderUrl?: string;
    rootFolderUrl?: string;
    subfolderIds?: Record<string, string>;
  }) => {
    setDriveData({
      internalFolderUrl: prov.internalFolderUrl ?? '',
      rootFolderUrl: prov.rootFolderUrl,
    });
    const folders = Object.keys(prov.subfolderIds ?? {});
    setSubfolders(folders);
    if (folders.length > 0) setSelectedFolder(folders[0]);
    setStatus('provisioned');
  };

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
        applyProvisionData(prov);
      } else {
        setStatus('not_provisioned');
        setSetupMode('choose');
      }
    } catch {
      setStatus('not_connected');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    if (status === 'provisioned' && selectedFolder) loadFolder(selectedFolder);
  }, [status, selectedFolder, loadFolder]);

  const handleFolderClick = (folder: string) => {
    setSelectedFolder(folder);
    loadFolder(folder);
  };

  const provisionCreate = async () => {
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
        applyProvisionData(data);
      } else {
        setError(data.error ?? 'Failed to set up Drive folders.');
        setStatus('not_provisioned');
      }
    } catch {
      setError('Failed to set up Drive folders.');
      setStatus('not_provisioned');
    }
  };

  const provisionLink = async () => {
    setLinkError(null);
    const folderId = extractFolderId(linkUrl.trim());
    if (!folderId) {
      setLinkError('Paste a valid Google Drive folder URL or folder ID.');
      return;
    }
    setStatus('provisioning');
    try {
      const res = await fetch('/api/drive/provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, linkFolderId: folderId }),
      });
      const data = await res.json();
      if (data.success) {
        applyProvisionData(data);
      } else {
        setError(data.error ?? 'Failed to link folder.');
        setStatus('not_provisioned');
      }
    } catch {
      setError('Failed to link folder.');
      setStatus('not_provisioned');
    }
  };

  const uploadFile = async (file: File) => {
    if (!selectedFolder) return;
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
      <div className="p-8 space-y-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-8 bg-fq-border/20 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (status === 'not_connected') {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <p className="font-body text-[13px] text-fq-muted">Google Drive is not connected.</p>
        <a href="/api/auth/google/login"
          className="font-body text-[12px] font-medium bg-fq-dark text-white px-4 py-2 rounded-lg hover:bg-fq-accent transition-colors">
          Connect Google Drive
        </a>
      </div>
    );
  }

  if (status === 'provisioning') {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="font-body text-[12px] text-fq-muted/60">Setting up Drive connection...</p>
      </div>
    );
  }

  if (status === 'not_provisioned') {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-5 max-w-md mx-auto">
        {error && <p className="font-body text-[12px] text-red-500">{error}</p>}

        {setupMode === 'choose' && (
          <>
            <p className="font-body text-[13px] text-fq-muted text-center">
              Connect a Google Drive folder to this project.
            </p>
            <div className="flex flex-col gap-3 w-full max-w-xs">
              <button
                onClick={() => setSetupMode('link')}
                className="font-body text-[13px] font-medium border border-fq-border bg-fq-card text-fq-dark px-5 py-3 rounded-xl hover:bg-fq-light-accent transition-colors text-left"
              >
                <span className="block text-[12px] text-fq-muted font-normal mb-0.5">Use existing</span>
                Link an existing Drive folder
              </button>
              <button
                onClick={provisionCreate}
                className="font-body text-[13px] font-medium border border-fq-border bg-fq-card text-fq-dark px-5 py-3 rounded-xl hover:bg-fq-light-accent transition-colors text-left"
              >
                <span className="block text-[12px] text-fq-muted font-normal mb-0.5">Start fresh</span>
                Create new folder structure
              </button>
            </div>
          </>
        )}

        {setupMode === 'link' && (
          <>
            <div className="w-full max-w-sm">
              <p className="font-body text-[13px] text-fq-muted mb-3 text-center">
                Paste the Google Drive folder URL or folder ID.
              </p>
              <input
                type="text"
                value={linkUrl}
                onChange={e => { setLinkUrl(e.target.value); setLinkError(null); }}
                placeholder="https://drive.google.com/drive/folders/..."
                className="w-full font-body text-[12.5px] text-fq-dark bg-white border border-fq-border rounded-lg px-3 py-2.5 outline-none focus:border-fq-accent/40 placeholder:text-fq-muted/40 mb-2"
              />
              {linkError && <p className="font-body text-[11px] text-red-400 mb-2">{linkError}</p>}
              <div className="flex gap-2">
                <button
                  onClick={() => { setSetupMode('choose'); setLinkUrl(''); setLinkError(null); }}
                  className="font-body text-[12px] text-fq-muted hover:text-fq-dark transition-colors px-3 py-2"
                >
                  Back
                </button>
                <button
                  onClick={provisionLink}
                  disabled={!linkUrl.trim()}
                  className="flex-1 font-body text-[12.5px] font-medium bg-fq-dark text-white px-4 py-2 rounded-lg hover:bg-fq-accent transition-colors disabled:opacity-40"
                >
                  Link Folder
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  const currentFiles = fileCache[selectedFolder];

  return (
    <div className="flex flex-col h-full">
      {/* Top link */}
      {driveData?.rootFolderUrl && (
        <div className="flex items-center gap-6 mb-5">
          <a href={driveData.rootFolderUrl} target="_blank" rel="noopener noreferrer"
            className="font-body text-[12px] text-fq-muted hover:text-fq-accent transition-colors">
            Open in Drive ↗
          </a>
        </div>
      )}

      {/* Two-column layout */}
      <div className="flex gap-0 border border-fq-border rounded-xl overflow-hidden flex-1">
        {/* Left: subfolder list */}
        <div className="w-[240px] shrink-0 border-r border-fq-border bg-fq-bg overflow-y-auto">
          {subfolders.length === 0 && (
            <p className="px-4 py-4 font-body text-[11.5px] text-fq-muted/50">
              No subfolders found in this folder.
            </p>
          )}
          {subfolders.map(folder => {
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
          <div className="flex items-center justify-between px-5 py-3 border-b border-fq-border">
            <span className="font-body text-[12.5px] font-medium text-fq-dark">
              {selectedFolder || 'Select a folder'}
            </span>
            <div className="flex items-center gap-3">
              {uploadMsg && (
                <span className={`font-body text-[11px] ${uploadMsg.includes('✓') ? 'text-fq-sage' : 'text-red-400'}`}>
                  {uploadMsg}
                </span>
              )}
              <input ref={fileInputRef} type="file" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f); e.target.value = ''; }} />
              {selectedFolder && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="font-body text-[11.5px] font-medium text-fq-muted hover:text-fq-dark border border-fq-border rounded-lg px-3 py-1.5 hover:bg-fq-light-accent/40 transition-colors"
                >
                  {uploading ? 'Uploading...' : 'Upload'}
                </button>
              )}
            </div>
          </div>

          <div
            className={`flex-1 overflow-y-auto relative ${dragOver ? 'bg-fq-light-accent' : ''}`}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files[0];
              if (f && selectedFolder) uploadFile(f);
            }}
          >
            {dragOver && (
              <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                <span className="font-body text-[13px] text-fq-accent">
                  Drop to upload{selectedFolder ? ` to ${selectedFolder}` : ''}
                </span>
              </div>
            )}

            {!selectedFolder && (
              <div className="flex items-center justify-center h-full py-16">
                <p className="font-body text-[12.5px] text-fq-muted/55">Select a folder on the left</p>
              </div>
            )}

            {selectedFolder && folderLoading && !currentFiles && (
              <div className="p-5 space-y-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-10 bg-fq-border/15 rounded animate-pulse" />
                ))}
              </div>
            )}

            {selectedFolder && !folderLoading && currentFiles && currentFiles.length === 0 && (
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
