'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
  iconLink: string;
  modifiedTime: string;
}

interface SidebarDriveFlyoutProps {
  projectName: string;
  projectId: string;
  internalFolderUrl: string;
  clientFolderUrl: string;
  subfolderIds: Record<string, string>;
  anchorTop: number;
  sidebarWidth: number;
  onClose: () => void;
}

interface UploadState {
  status: 'idle' | 'uploading' | 'done' | 'error';
  msg?: string;
}

const FLYOUT_WIDTH = 260;

function FileIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-fq-muted/50 shrink-0">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

export default function SidebarDriveFlyout({
  projectName,
  projectId,
  internalFolderUrl,
  clientFolderUrl,
  subfolderIds,
  anchorTop,
  sidebarWidth,
  onClose,
}: SidebarDriveFlyoutProps) {
  const [uploadStates, setUploadStates] = useState<Record<string, UploadState>>({});
  const [selectedSubfolder, setSelectedSubfolder] = useState<string | null>(null);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const flyoutRef = useRef<HTMLDivElement>(null);

  const subfolderNames = Object.keys(subfolderIds);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (flyoutRef.current && !flyoutRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const openSubfolder = async (name: string) => {
    if (selectedSubfolder === name) {
      setSelectedSubfolder(null);
      setFiles([]);
      return;
    }
    setSelectedSubfolder(name);
    setFiles([]);
    setFilesLoading(true);
    try {
      const res = await fetch(`/api/drive/files?projectId=${encodeURIComponent(projectId)}&folder=${encodeURIComponent(name)}`);
      const data = await res.json();
      setFiles(data.files ?? []);
    } catch {
      setFiles([]);
    } finally {
      setFilesLoading(false);
    }
  };

  const uploadToSubfolder = async (subfolder: string, file: File) => {
    setUploadStates(prev => ({ ...prev, [subfolder]: { status: 'uploading' } }));
    const formData = new FormData();
    formData.append('file', file);
    formData.append('projectId', projectId);
    formData.append('subfolder', subfolder);
    try {
      const res = await fetch('/api/drive/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.success) {
        setUploadStates(prev => ({ ...prev, [subfolder]: { status: 'done', msg: 'Saved ✓' } }));
        // Refresh files if this subfolder is open
        if (selectedSubfolder === subfolder) {
          openSubfolder(subfolder);
        }
      } else {
        setUploadStates(prev => ({ ...prev, [subfolder]: { status: 'error', msg: 'Failed' } }));
      }
    } catch {
      setUploadStates(prev => ({ ...prev, [subfolder]: { status: 'error', msg: 'Failed' } }));
    }
    setTimeout(() => {
      setUploadStates(prev => ({ ...prev, [subfolder]: { status: 'idle' } }));
    }, 2500);
  };

  const topPos = Math.max(0, anchorTop);
  const maxH = 'calc(100vh - 40px)';

  const content = (
    <div ref={flyoutRef} className="fixed z-[200] flex" style={{ top: topPos, left: sidebarWidth }}>
      {/* Level 1 — subfolder list */}
      <div
        style={{ width: FLYOUT_WIDTH, maxHeight: maxH }}
        className="bg-fq-card border border-fq-border rounded-r-xl shadow-xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-fq-border shrink-0">
          <span className="font-heading text-[13px] font-semibold text-fq-dark truncate">{projectName}</span>
          <button onClick={onClose} className="text-fq-muted hover:text-fq-dark transition-colors ml-2 shrink-0">
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <path d="M2 2l10 10M12 2L2 12" />
            </svg>
          </button>
        </div>

        {/* Subfolder list */}
        <div className="overflow-y-auto flex-1">
          {subfolderNames.length === 0 && (
            <p className="font-body text-[11px] text-fq-muted/60 px-4 py-3">No subfolders found.</p>
          )}
          {subfolderNames.map(name => {
            const state = uploadStates[name] ?? { status: 'idle' };
            const isOpen = selectedSubfolder === name;
            return (
              <div
                key={name}
                className={`flex items-center gap-2 px-3 py-2 border-b border-fq-border/40 last:border-0 transition-colors cursor-pointer ${
                  isOpen ? 'bg-fq-light-accent/60' : 'hover:bg-fq-bg'
                }`}
                onClick={() => openSubfolder(name)}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-fq-muted/60 shrink-0">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
                <span className="font-body text-[11.5px] text-fq-dark flex-1 truncate">{name}</span>
                <svg
                  width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor"
                  strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                  className={`text-fq-muted/50 shrink-0 transition-transform duration-150 ${isOpen ? 'rotate-90' : ''}`}
                >
                  <path d="M5 3l3 3-3 3" />
                </svg>

                {/* Upload — stop propagation so click doesn't also open folder */}
                <div onClick={e => e.stopPropagation()}>
                  {state.status === 'idle' && (
                    <label className="font-body text-[10px] text-fq-muted hover:text-fq-accent cursor-pointer shrink-0 transition-colors ml-1">
                      + Upload
                      <input
                        type="file"
                        className="hidden"
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) uploadToSubfolder(name, file);
                          e.target.value = '';
                        }}
                      />
                    </label>
                  )}
                  {state.status === 'uploading' && (
                    <span className="font-body text-[10px] text-fq-muted/60 shrink-0 ml-1">...</span>
                  )}
                  {(state.status === 'done' || state.status === 'error') && (
                    <span className={`font-body text-[10px] shrink-0 ml-1 ${state.status === 'done' ? 'text-fq-sage' : 'text-red-400'}`}>
                      {state.msg}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer links */}
        <div className="px-4 py-3 border-t border-fq-border space-y-2 shrink-0">
          <a
            href={internalFolderUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 font-body text-[11px] text-fq-muted hover:text-fq-accent transition-colors"
          >
            Open Internal Folder ↗
          </a>
          <a
            href={clientFolderUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 font-body text-[11px] text-fq-muted hover:text-fq-accent transition-colors"
          >
            Open Client Shared Folder ↗
          </a>
        </div>
      </div>

      {/* Level 2 — files panel, pops to the right */}
      {selectedSubfolder && (
        <div
          style={{ width: FLYOUT_WIDTH, maxHeight: maxH }}
          className="bg-fq-card border border-l-0 border-fq-border rounded-r-xl shadow-xl flex flex-col overflow-hidden ml-0"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-fq-border shrink-0">
            <span className="font-heading text-[12.5px] font-semibold text-fq-dark truncate">{selectedSubfolder}</span>
            <button
              onClick={() => { setSelectedSubfolder(null); setFiles([]); }}
              className="text-fq-muted hover:text-fq-dark transition-colors ml-2 shrink-0"
            >
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                <path d="M2 2l10 10M12 2L2 12" />
              </svg>
            </button>
          </div>

          <div className="overflow-y-auto flex-1 py-1">
            {filesLoading && (
              <p className="font-body text-[11px] text-fq-muted/60 px-4 py-3">Loading...</p>
            )}
            {!filesLoading && files.length === 0 && (
              <p className="font-body text-[11px] text-fq-muted/50 px-4 py-3 italic">No files in this folder.</p>
            )}
            {!filesLoading && files.map(file => (
              <a
                key={file.id}
                href={file.webViewLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 border-b border-fq-border/30 last:border-0 hover:bg-fq-bg transition-colors group"
              >
                <FileIcon />
                <span className="font-body text-[11px] text-fq-dark flex-1 truncate group-hover:text-fq-accent transition-colors">
                  {file.name}
                </span>
                <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-fq-muted/40 shrink-0">
                  <path d="M7 2h3v3M10 2L5 7" />
                  <path d="M3 4H2a1 1 0 00-1 1v5a1 1 0 001 1h5a1 1 0 001-1V9" />
                </svg>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return createPortal(content, document.body);
}
