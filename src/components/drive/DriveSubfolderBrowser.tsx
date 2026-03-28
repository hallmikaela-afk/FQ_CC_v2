'use client';

import { useState, useRef } from 'react';
import { DriveFileIcon } from './DriveFileIcon';

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
  size: string | null;
  modifiedTime: string;
}

interface Props {
  name: string;
  projectId: string;
  isOpen: boolean;
  onToggle: () => void;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function DriveSubfolderBrowser({ name, projectId, isOpen, onToggle }: Props) {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadFiles = async () => {
    if (loaded || loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/drive/files?projectId=${projectId}&folder=${encodeURIComponent(name)}`);
      const data = await res.json();
      setFiles(data.files ?? []);
      setLoaded(true);
    } catch {}
    setLoading(false);
  };

  const handleToggle = () => {
    onToggle();
    if (!isOpen) loadFiles();
  };

  const uploadFile = async (file: File) => {
    setUploading(true);
    setUploadMsg(null);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('projectId', projectId);
    formData.append('subfolder', name);
    try {
      const res = await fetch('/api/drive/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.success) {
        setFiles(prev => [data.file, ...prev]);
        if (!loaded) setLoaded(true);
        setUploadMsg('Uploaded ✓');
      } else {
        setUploadMsg(data.error ?? 'Upload failed');
      }
    } catch {
      setUploadMsg('Upload failed');
    }
    setUploading(false);
    setTimeout(() => setUploadMsg(null), 3000);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  };

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = '';
  };

  return (
    <div className="border border-fq-border rounded-xl overflow-hidden">
      {/* Folder header / toggle */}
      <button
        onClick={handleToggle}
        className="w-full flex items-center gap-2.5 px-4 py-3 bg-fq-bg hover:bg-fq-light-accent/30 transition-colors text-left"
      >
        <svg
          width="11" height="11" viewBox="0 0 12 12" fill="none"
          stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
          className={`transition-transform shrink-0 text-fq-muted ${isOpen ? '' : '-rotate-90'}`}
        >
          <path d="M3 5l3 3 3-3" />
        </svg>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" className="text-fq-muted shrink-0">
          <path d="M1.5 4a1 1 0 011-1h2.586a1 1 0 01.707.293L7 4.5h5a1 1 0 011 1V11a1 1 0 01-1 1H2.5a1 1 0 01-1-1V4z" />
        </svg>
        <span className="font-body text-[13px] text-fq-dark flex-1">{name}</span>
        {loaded && (
          <span className="font-body text-[11px] text-fq-muted/60 shrink-0">
            {files.length} file{files.length !== 1 ? 's' : ''}
          </span>
        )}
      </button>

      {/* Expanded content */}
      {isOpen && (
        <div className="border-t border-fq-border bg-fq-card">
          {loading && (
            <p className="px-4 py-3 font-body text-[12px] text-fq-muted/60">Loading...</p>
          )}

          {!loading && files.length > 0 && (
            <div className="divide-y divide-fq-border">
              {files.map(file => (
                <a
                  key={file.id}
                  href={file.webViewLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-fq-bg transition-colors group"
                >
                  <DriveFileIcon mimeType={file.mimeType} size={26} />
                  <div className="flex-1 min-w-0">
                    <p className="font-body text-[12.5px] text-fq-dark truncate group-hover:text-fq-accent transition-colors">
                      {file.name}
                    </p>
                    <p className="font-body text-[10.5px] text-fq-muted/55">{fmtDate(file.modifiedTime)}</p>
                  </div>
                  <span className="font-body text-[10.5px] text-fq-muted/40 group-hover:text-fq-accent/60 transition-colors shrink-0">↗</span>
                </a>
              ))}
            </div>
          )}

          {!loading && loaded && files.length === 0 && (
            <p className="px-4 py-3 font-body text-[12px] text-fq-muted/55">No files in this folder yet</p>
          )}

          {/* Drop zone + upload button */}
          <div className="px-4 py-3 border-t border-fq-border/50">
            <input ref={fileInputRef} type="file" className="hidden" onChange={handleInput} />
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`flex items-center gap-2.5 py-2 px-3 border border-dashed rounded-lg cursor-pointer transition-all ${
                dragOver ? 'border-fq-accent bg-fq-light-accent' : 'border-fq-border/60 hover:border-fq-muted'
              }`}
            >
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 ${dragOver ? 'text-fq-accent' : 'text-fq-muted/60'}`}>
                <path d="M7 9.5V2M4.5 4.5L7 2l2.5 2.5M1.5 11.5h11" />
              </svg>
              <span className={`font-body text-[11.5px] ${uploadMsg?.includes('✓') ? 'text-fq-sage' : 'text-fq-muted/65'}`}>
                {uploading ? 'Uploading...' : uploadMsg ?? 'Drop a file or click to upload'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
