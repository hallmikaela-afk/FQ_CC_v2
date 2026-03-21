'use client';

import { useState, useRef, useCallback } from 'react';

export default function QuickUploadButton({ projectId }: { projectId: string }) {
  const [state, setState] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = useCallback(async (file: File) => {
    setState('uploading');
    setErrorMsg('');
    const formData = new FormData();
    formData.append('file', file);
    formData.append('projectId', projectId);
    try {
      const res = await fetch('/api/project-files', { method: 'POST', body: formData });
      const json = await res.json();
      if (!res.ok) {
        setErrorMsg(json.error || 'Upload failed');
        setState('error');
      } else {
        setState('success');
        setTimeout(() => setState('idle'), 2000);
      }
    } catch (err: any) {
      setErrorMsg(err.message);
      setState('error');
      setTimeout(() => setState('idle'), 3000);
    }
  }, [projectId]);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) upload(file);
    e.target.value = '';
  };

  return (
    <span onClick={e => e.preventDefault()}>
      <input
        ref={inputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.gif,.webp,.heic,.eml"
        onChange={handleInput}
        className="hidden"
      />
      {state === 'error' ? (
        <span className="font-body text-[10px] text-fq-alert" title={errorMsg}>Upload failed</span>
      ) : (
        <button
          onClick={e => { e.preventDefault(); e.stopPropagation(); inputRef.current?.click(); }}
          disabled={state === 'uploading'}
          title="Upload photo, screenshot, or email"
          className="inline-flex items-center gap-1 font-body text-[11px] text-fq-muted/60 hover:text-fq-accent transition-colors disabled:opacity-50"
        >
          {state === 'success' ? (
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 6l3 3 5-5" />
            </svg>
          ) : state === 'uploading' ? (
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
              <circle cx="6" cy="6" r="4" strokeDasharray="6 6" />
            </svg>
          ) : (
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 8V3M4 5l2-2 2 2" />
              <path d="M2 10h8" />
            </svg>
          )}
          <span>{state === 'success' ? 'Uploaded' : state === 'uploading' ? 'Uploading…' : 'Upload'}</span>
        </button>
      )}
    </span>
  );
}
