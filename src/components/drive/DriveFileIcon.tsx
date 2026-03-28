'use client';

const MIME_MAP: Record<string, { bg: string; label: string }> = {
  'application/vnd.google-apps.document':     { bg: '#4285F4', label: 'DOC' },
  'application/vnd.google-apps.spreadsheet':  { bg: '#0F9D58', label: 'XLS' },
  'application/vnd.google-apps.presentation': { bg: '#F4B400', label: 'PPT' },
  'application/vnd.google-apps.drawing':      { bg: '#00ACC1', label: 'DRW' },
  'application/vnd.google-apps.form':         { bg: '#7B1FA2', label: 'FRM' },
  'application/pdf':                          { bg: '#E53935', label: 'PDF' },
  'image/jpeg':                               { bg: '#9C27B0', label: 'IMG' },
  'image/png':                                { bg: '#9C27B0', label: 'IMG' },
  'image/gif':                                { bg: '#9C27B0', label: 'GIF' },
  'image/webp':                               { bg: '#9C27B0', label: 'IMG' },
  'video/mp4':                                { bg: '#E64A19', label: 'VID' },
  'audio/mpeg':                               { bg: '#FF6F00', label: 'AUD' },
  'application/zip':                          { bg: '#546E7A', label: 'ZIP' },
  'text/plain':                               { bg: '#78909C', label: 'TXT' },
  'text/csv':                                 { bg: '#388E3C', label: 'CSV' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':   { bg: '#1565C0', label: 'DOC' },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':         { bg: '#2E7D32', label: 'XLS' },
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': { bg: '#E65100', label: 'PPT' },
};

const DEFAULT = { bg: '#8B6F4E', label: 'FILE' };

export function DriveFileIcon({ mimeType, size = 32 }: { mimeType: string; size?: number }) {
  const cfg = MIME_MAP[mimeType] ?? DEFAULT;
  const fontSize = Math.round(size * 0.28);
  return (
    <div
      style={{ width: size, height: size, backgroundColor: cfg.bg, borderRadius: Math.round(size * 0.18) }}
      className="flex items-center justify-center shrink-0"
    >
      <span style={{ color: '#fff', fontSize, fontWeight: 700, fontFamily: 'var(--font-body)', lineHeight: 1 }}>
        {cfg.label}
      </span>
    </div>
  );
}
