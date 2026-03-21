'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

interface ProjectFile {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  storage_path: string;
  public_url: string;
  uploaded_at: string;
}

const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic'];

function isImage(file: ProjectFile) {
  const name = file.file_name.toLowerCase();
  return IMAGE_EXTS.some(ext => name.endsWith(ext));
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ProjectFileUpload({ projectId }: { projectId: string }) {
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchFiles = useCallback(async () => {
    try {
      const res = await fetch(`/api/project-files?projectId=${projectId}`);
      if (res.ok) setFiles(await res.json());
    } catch { /* silent */ }
    setLoading(false);
  }, [projectId]);

  useEffect(() => { fetchFiles(); }, [fetchFiles]);

  const uploadFile = useCallback(async (file: File) => {
    setError(null);
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('projectId', projectId);
    try {
      const res = await fetch('/api/project-files', { method: 'POST', body: formData });
      const json = await res.json();
      if (!res.ok) { setError(json.error || 'Upload failed'); return; }
      setFiles(prev => [json, ...prev]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }, [projectId]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  }, [uploadFile]);

  const handleInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = '';
  }, [uploadFile]);

  const deleteFile = async (file: ProjectFile) => {
    if (!confirm(`Delete "${file.file_name}"?`)) return;
    const res = await fetch(`/api/project-files?id=${file.id}&storagePath=${encodeURIComponent(file.storage_path)}`, { method: 'DELETE' });
    if (res.ok) setFiles(prev => prev.filter(f => f.id !== file.id));
  };

  const t = {
    heading: 'text-fq-dark/90',
    body: 'text-fq-muted/90',
    light: 'text-fq-muted/70',
  };

  return (
    <div className="bg-fq-card rounded-xl border border-fq-border shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className={`font-heading text-[18px] font-semibold ${t.heading}`}>Files</h2>
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="px-3 py-1.5 bg-fq-accent text-white text-[12px] font-medium rounded-lg hover:bg-fq-dark transition-colors disabled:opacity-50"
        >
          {uploading ? 'Uploading…' : '+ Upload'}
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.gif,.webp,.heic,.eml"
        onChange={handleInput}
        className="hidden"
      />

      {/* Drop zone — shown when no files yet */}
      {files.length === 0 && !loading && (
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
            dragOver ? 'border-fq-accent bg-fq-light-accent' : 'border-fq-border hover:border-fq-muted'
          }`}
        >
          <p className={`font-body text-[13px] ${t.light} mb-1`}>Drop photos, screenshots, or emails here</p>
          <p className={`font-body text-[11px] ${t.light}`}>JPG · PNG · GIF · WEBP · HEIC · EML</p>
        </div>
      )}

      {/* Drop overlay when files exist */}
      {files.length > 0 && (
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`relative ${dragOver ? 'outline outline-2 outline-fq-accent rounded-xl' : ''}`}
        >
          {dragOver && (
            <div className="absolute inset-0 bg-fq-light-accent/80 rounded-xl flex items-center justify-center z-10 pointer-events-none">
              <p className={`font-body text-[13px] text-fq-accent font-medium`}>Drop to upload</p>
            </div>
          )}

          <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-3">
            {files.map(file => (
              <div key={file.id} className="group relative">
                {isImage(file) ? (
                  <a href={file.public_url} target="_blank" rel="noopener noreferrer">
                    <img
                      src={file.public_url}
                      alt={file.file_name}
                      className="w-full h-24 object-cover rounded-lg border border-fq-border hover:opacity-90 transition-opacity"
                    />
                  </a>
                ) : (
                  <a href={file.public_url} target="_blank" rel="noopener noreferrer"
                    className="flex flex-col items-center justify-center h-24 rounded-lg border border-fq-border bg-fq-light-accent hover:bg-fq-bg transition-colors">
                    <span className="text-2xl mb-1">✉️</span>
                    <span className={`font-body text-[10px] ${t.light} text-center px-1 truncate w-full text-center`}>.eml</span>
                  </a>
                )}
                <p className={`font-body text-[10px] ${t.light} mt-1 truncate`} title={file.file_name}>
                  {file.file_name}
                </p>
                <p className={`font-body text-[9px] ${t.light}`}>{formatBytes(file.file_size)}</p>
                <button
                  onClick={() => deleteFile(file)}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/50 text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-fq-alert"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <p className="mt-3 font-body text-[12px] text-fq-alert">{error}</p>
      )}

      {loading && (
        <p className={`font-body text-[12px] ${t.light}`}>Loading files…</p>
      )}
    </div>
  );
}
