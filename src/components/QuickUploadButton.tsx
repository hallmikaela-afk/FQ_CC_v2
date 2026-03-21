'use client';

import { useState } from 'react';
import UploadModal from '@/components/UploadModal';

export default function QuickUploadButton({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <span onClick={e => e.preventDefault()}>
      <button
        onClick={e => { e.preventDefault(); e.stopPropagation(); setOpen(true); }}
        title="Upload file to this project"
        className="inline-flex items-center gap-1 font-body text-[11px] text-fq-muted/60 hover:text-fq-accent transition-colors"
      >
        <svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 9.5V2M4.5 4.5L7 2l2.5 2.5" />
          <path d="M1.5 11.5h11" />
        </svg>
        <span>Upload</span>
      </button>

      {open && (
        <UploadModal
          onClose={() => setOpen(false)}
          defaultProjectId={projectId}
          defaultProjectName={projectName}
        />
      )}
    </span>
  );
}
