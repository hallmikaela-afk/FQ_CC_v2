'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

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

interface SidebarDriveFlyoutProps {
  projectName: string;
  projectId: string;
  internalFolderUrl: string;
  clientFolderUrl: string;
  anchorTop: number;
  sidebarWidth: number;
  onClose: () => void;
}

interface UploadState {
  status: 'idle' | 'uploading' | 'done' | 'error';
  msg?: string;
}

export default function SidebarDriveFlyout({
  projectName,
  projectId,
  internalFolderUrl,
  clientFolderUrl,
  anchorTop,
  sidebarWidth,
  onClose,
}: SidebarDriveFlyoutProps) {
  const [uploadStates, setUploadStates] = useState<Record<string, UploadState>>({});
  const flyoutRef = useRef<HTMLDivElement>(null);

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

  const content = (
    <div
      ref={flyoutRef}
      style={{
        top: Math.max(0, anchorTop),
        left: sidebarWidth,
        maxHeight: 'calc(100vh - 40px)',
      }}
      className="fixed z-[200] w-[280px] bg-fq-card border border-fq-border rounded-r-xl shadow-xl flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-fq-border">
        <span className="font-heading text-[13.5px] font-semibold text-fq-dark truncate">{projectName}</span>
        <button onClick={onClose} className="text-fq-muted hover:text-fq-dark transition-colors ml-2 shrink-0">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M2 2l10 10M12 2L2 12" />
          </svg>
        </button>
      </div>

      {/* Subfolder list */}
      <div className="overflow-y-auto flex-1">
        {FQ_SUBFOLDERS.map(subfolder => {
          const state = uploadStates[subfolder] ?? { status: 'idle' };
          return (
            <div key={subfolder} className="flex items-center gap-2 px-4 py-2 border-b border-fq-border/40 last:border-0 hover:bg-fq-bg transition-colors">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-fq-muted/60 shrink-0">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
              <span className="font-body text-[11.5px] text-fq-dark flex-1 truncate">{subfolder}</span>

              {/* Upload state */}
              {state.status === 'idle' && (
                <label className="font-body text-[10px] text-fq-muted hover:text-fq-accent cursor-pointer shrink-0 transition-colors">
                  + Upload
                  <input
                    type="file"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) uploadToSubfolder(subfolder, file);
                      e.target.value = '';
                    }}
                  />
                </label>
              )}
              {state.status === 'uploading' && (
                <span className="font-body text-[10px] text-fq-muted/60 shrink-0">Uploading...</span>
              )}
              {(state.status === 'done' || state.status === 'error') && (
                <span className={`font-body text-[10px] shrink-0 ${state.status === 'done' ? 'text-fq-sage' : 'text-red-400'}`}>
                  {state.msg}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer links */}
      <div className="px-4 py-3 border-t border-fq-border space-y-2">
        <a
          href={internalFolderUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 font-body text-[11.5px] text-fq-muted hover:text-fq-accent transition-colors"
        >
          Open Internal Folder ↗
        </a>
        <a
          href={clientFolderUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 font-body text-[11.5px] text-fq-muted hover:text-fq-accent transition-colors"
        >
          Open Client Shared Folder ↗
        </a>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
