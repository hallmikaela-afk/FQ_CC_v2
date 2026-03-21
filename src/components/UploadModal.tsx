'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

interface Project {
  id: string;
  name: string;
}

interface UploadModalProps {
  onClose: () => void;
  /** Pre-fill and lock the project when uploading from a specific project page */
  defaultProjectId?: string;
  defaultProjectName?: string;
  /** Called after a successful upload */
  onUploaded?: () => void;
}

const FILE_ICON: Record<string, string> = {
  '.pdf': '📄',
  '.doc': '📝',
  '.docx': '📝',
  '.xls': '📊',
  '.xlsx': '📊',
  '.csv': '📊',
  '.eml': '✉️',
  '.jpg': '🖼️',
  '.jpeg': '🖼️',
  '.png': '🖼️',
  '.gif': '🖼️',
  '.webp': '🖼️',
  '.heic': '🖼️',
};

function getIcon(fileName: string): string {
  const ext = '.' + fileName.split('.').pop()!.toLowerCase();
  return FILE_ICON[ext] ?? '📎';
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function UploadModal({ onClose, defaultProjectId, defaultProjectName, onUploaded }: UploadModalProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState(defaultProjectId || '');
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch projects for the selector (only if not pre-filled)
  useEffect(() => {
    if (defaultProjectId) return; // don't need the list when locked to a project
    fetch('/api/projects')
      .then(r => r.json())
      .then(data => setProjects(
        (data as any[])
          .filter(p => p.status === 'active')
          .map(p => ({ id: p.id, name: p.name }))
      ))
      .catch(() => {});
  }, [defaultProjectId]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) setFile(dropped);
  }, []);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    if (picked) setFile(picked);
    e.target.value = '';
  };

  const handleUpload = async () => {
    if (!file) { setError('Please select a file.'); return; }
    if (!projectId) { setError('Please select a project.'); return; }

    setError(null);
    setUploading(true);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('projectId', projectId);
    if (notes.trim()) formData.append('notes', notes.trim());

    try {
      const res = await fetch('/api/project-files', { method: 'POST', body: formData });
      const json = await res.json();
      if (!res.ok) { setError(json.error || 'Upload failed'); return; }
      setSuccess(true);
      onUploaded?.();
      setTimeout(onClose, 1200);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-fq-card rounded-2xl border border-fq-border shadow-2xl w-[520px] max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-fq-border">
          <h2 className="font-heading text-[20px] font-semibold text-fq-dark">Upload File</h2>
          <button onClick={onClose} className="text-fq-muted/40 hover:text-fq-dark transition-colors text-[18px] leading-none">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Project */}
          <div>
            <label className="block font-body text-[12px] font-medium text-fq-dark mb-1.5">Project</label>
            {defaultProjectId ? (
              <div className="flex items-center gap-2 px-3 py-2.5 bg-fq-light-accent border border-fq-border rounded-lg">
                <span className="w-2 h-2 rounded-full bg-fq-accent shrink-0" />
                <span className="font-body text-[13px] text-fq-dark">{defaultProjectName}</span>
              </div>
            ) : (
              <select
                value={projectId}
                onChange={e => setProjectId(e.target.value)}
                className="w-full font-body text-[13px] text-fq-dark bg-fq-bg border border-fq-border rounded-lg px-3 py-2.5 outline-none cursor-pointer focus:border-fq-accent/40"
              >
                <option value="">Select project…</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block font-body text-[12px] font-medium text-fq-dark mb-1.5">
              Notes <span className="font-normal text-fq-muted">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Describe what this file is, where it's from, or anything relevant…"
              rows={3}
              className="w-full font-body text-[13px] text-fq-dark bg-fq-bg border border-fq-border rounded-lg px-3 py-2.5 outline-none resize-none focus:border-fq-accent/40 placeholder:text-fq-muted/40"
            />
          </div>

          {/* Google Drive destination — coming soon */}
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <label className="font-body text-[12px] font-medium text-fq-dark">Google Drive Destination</label>
              <span className="font-body text-[10px] font-medium text-fq-accent bg-fq-light-accent px-2 py-0.5 rounded-full">Coming soon</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2.5 bg-fq-bg border border-fq-border rounded-lg opacity-50 cursor-not-allowed">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-fq-muted shrink-0">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
              <span className="font-body text-[13px] text-fq-muted">Connect Google Drive to choose a folder</span>
            </div>
          </div>

          {/* File drop zone */}
          <div>
            <label className="block font-body text-[12px] font-medium text-fq-dark mb-1.5">File</label>
            <input ref={inputRef} type="file" onChange={handleInput} className="hidden" />
            {file ? (
              <div className="flex items-center gap-3 px-4 py-3 bg-fq-light-accent border border-fq-accent/30 rounded-xl">
                <span className="text-xl shrink-0">{getIcon(file.name)}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-body text-[13px] text-fq-dark truncate">{file.name}</p>
                  <p className="font-body text-[11px] text-fq-muted">{formatBytes(file.size)}</p>
                </div>
                <button onClick={() => setFile(null)} className="text-fq-muted/50 hover:text-fq-alert transition-colors text-[12px] shrink-0">✕</button>
              </div>
            ) : (
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                  dragOver ? 'border-fq-accent bg-fq-light-accent' : 'border-fq-border hover:border-fq-muted'
                }`}
              >
                <p className="font-body text-[13px] text-fq-muted mb-1">Drop any file here, or click to browse</p>
                <p className="font-body text-[11px] text-fq-muted/60">
                  CSV · Excel · Word · PDF · Email · Photos · Screenshots · any format
                </p>
              </div>
            )}
          </div>

          {error && <p className="font-body text-[12px] text-fq-alert">{error}</p>}
          {success && <p className="font-body text-[12px] text-green-700 font-medium">Uploaded successfully!</p>}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-fq-border">
          <button
            onClick={onClose}
            className="font-body text-[13px] text-fq-muted hover:text-fq-dark transition-colors px-4 py-2"
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={uploading || !file || !projectId}
            className="font-body text-[13px] font-medium bg-fq-accent text-white px-5 py-2 rounded-lg hover:bg-fq-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {uploading ? 'Uploading…' : 'Upload File'}
          </button>
        </div>
      </div>
    </div>
  );
}
