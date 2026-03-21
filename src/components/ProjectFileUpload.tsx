'use client';

import { useState, useCallback, useEffect } from 'react';

interface ProjectFile {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  storage_path: string;
  public_url: string;
  notes: string | null;
  uploaded_at: string;
}

const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic'];
const FILE_ICON: Record<string, string> = {
  '.pdf': '📄',
  '.doc': '📝',
  '.docx': '📝',
  '.xls': '📊',
  '.xlsx': '📊',
  '.csv': '📊',
  '.eml': '✉️',
};

function fileIcon(file: ProjectFile): string {
  const ext = '.' + file.file_name.split('.').pop()!.toLowerCase();
  return FILE_ICON[ext] ?? '📎';
}

function isImage(file: ProjectFile) {
  const name = file.file_name.toLowerCase();
  return IMAGE_EXTS.some(ext => name.endsWith(ext));
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ProjectFileUpload({
  projectId,
  onUploadClick,
}: {
  projectId: string;
  /** Called when the Upload button is clicked — parent opens the modal */
  onUploadClick?: () => void;
}) {
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFiles = useCallback(async () => {
    try {
      const res = await fetch(`/api/project-files?projectId=${projectId}`);
      if (res.ok) setFiles(await res.json());
    } catch { /* silent */ }
    setLoading(false);
  }, [projectId]);

  useEffect(() => { fetchFiles(); }, [fetchFiles]);

  const deleteFile = async (file: ProjectFile) => {
    if (!confirm(`Delete "${file.file_name}"?`)) return;
    const res = await fetch(
      `/api/project-files?id=${file.id}&storagePath=${encodeURIComponent(file.storage_path)}`,
      { method: 'DELETE' }
    );
    if (res.ok) setFiles(prev => prev.filter(f => f.id !== file.id));
  };

  const t = { heading: 'text-fq-dark/90', light: 'text-fq-muted/70' };

  return (
    <div className="bg-fq-card rounded-xl border border-fq-border shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className={`font-heading text-[18px] font-semibold ${t.heading}`}>Files</h2>
        {onUploadClick && (
          <button
            onClick={onUploadClick}
            className="px-3 py-1.5 bg-fq-accent text-white text-[12px] font-medium rounded-lg hover:bg-fq-dark transition-colors"
          >
            + Upload
          </button>
        )}
      </div>

      {loading && <p className={`font-body text-[12px] ${t.light}`}>Loading files…</p>}

      {!loading && files.length === 0 && (
        <div
          onClick={onUploadClick}
          className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer border-fq-border hover:border-fq-muted transition-colors"
        >
          <p className={`font-body text-[13px] ${t.light} mb-1`}>No files yet</p>
          <p className={`font-body text-[11px] ${t.light}`}>Click Upload or use the button above to add files</p>
        </div>
      )}

      {!loading && files.length > 0 && (
        <div className="space-y-2">
          {files.map(file => (
            <div key={file.id} className="group flex items-start gap-3 p-3 rounded-lg hover:bg-fq-bg transition-colors">
              {/* Thumbnail or icon */}
              {isImage(file) ? (
                <a href={file.public_url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                  <img
                    src={file.public_url}
                    alt={file.file_name}
                    className="w-12 h-12 object-cover rounded-lg border border-fq-border"
                  />
                </a>
              ) : (
                <a href={file.public_url} target="_blank" rel="noopener noreferrer"
                  className="w-12 h-12 flex items-center justify-center rounded-lg border border-fq-border bg-fq-light-accent shrink-0 text-xl hover:opacity-80 transition-opacity">
                  {fileIcon(file)}
                </a>
              )}

              {/* Info */}
              <div className="flex-1 min-w-0">
                <a href={file.public_url} target="_blank" rel="noopener noreferrer"
                  className={`font-body text-[13px] text-fq-dark hover:text-fq-accent transition-colors truncate block`}>
                  {file.file_name}
                </a>
                <p className={`font-body text-[11px] ${t.light}`}>
                  {formatBytes(file.file_size)} · {formatDate(file.uploaded_at)}
                </p>
                {file.notes && (
                  <p className={`font-body text-[11px] ${t.light} mt-0.5 line-clamp-2`}>{file.notes}</p>
                )}
              </div>

              {/* Delete */}
              <button
                onClick={() => deleteFile(file)}
                className="text-fq-muted/30 hover:text-fq-alert transition-colors opacity-0 group-hover:opacity-100 text-[12px] shrink-0 mt-0.5"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
