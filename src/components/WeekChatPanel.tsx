'use client';

import { useState, useRef, useEffect } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  tasks_changed?: boolean;
  tasks_count?: number;
  change_type?: 'created' | 'updated' | 'completed' | 'mixed' | null;
  attachments?: { name: string; type: string; size: string; previewUrl?: string }[];
}

interface PendingFile {
  name: string;
  fileType: string;
  size: string;
  parsedText: string;
  previewUrl?: string;
  base64?: string;
  mediaType?: string;
}

interface Props {
  week: string;
  onTaskAdded: () => void;
}

const INITIAL_MESSAGE: Message = {
  role: 'assistant',
  content: "I can create, update, and complete tasks — both sprint tasks and project planner tasks.\n\nExamples:\n- 'Add email Art about florals to Menorca'\n- 'Mark the florist task on Julia & Frank as done'\n- 'Update the venue contract task to be due next Friday'",
};

function changeBadge(msg: Message) {
  if (!msg.tasks_changed) return null;
  const n = msg.tasks_count ?? 1;
  const label =
    msg.change_type === 'completed' ? (n === 1 ? 'Task completed' : `${n} tasks completed`) :
    msg.change_type === 'updated'   ? (n === 1 ? 'Task updated'   : `${n} tasks updated`)   :
    msg.change_type === 'mixed'     ? `${n} tasks updated` :
    /* created */                     (n === 1 ? 'Task added'     : `${n} tasks added`);
  return (
    <div className="flex items-center gap-1.5 mt-1 px-2.5 py-1 rounded-full bg-fq-sage-light border border-fq-sage/20 font-body text-[11px] text-fq-sage font-medium">
      <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 6l3 3 5-5" />
      </svg>
      {label}
    </div>
  );
}

function formatMessage(text: string) {
  return text.split('\n').map((line, i) => {
    const applyInline = (raw: string) =>
      raw
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="underline underline-offset-2 text-fq-accent hover:opacity-75 transition-opacity">$1</a>');

    if (line.trim().startsWith('- ') || line.trim().startsWith('• ')) {
      const content = line.trim().replace(/^[-•]\s*/, '');
      return (
        <div key={i} className="flex gap-1.5">
          <span className="text-fq-accent shrink-0 mt-px">•</span>
          <span dangerouslySetInnerHTML={{ __html: applyInline(content) }} />
        </div>
      );
    }

    const numMatch = line.trim().match(/^(\d+)\.\s+(.*)/);
    if (numMatch) {
      return (
        <div key={i} className="flex gap-1.5">
          <span className="text-fq-accent shrink-0 font-medium">{numMatch[1]}.</span>
          <span dangerouslySetInnerHTML={{ __html: applyInline(numMatch[2]) }} />
        </div>
      );
    }

    return line.trim() ? (
      <span key={i} dangerouslySetInnerHTML={{ __html: applyInline(line) }} />
    ) : (
      <span key={i} className="h-1 block" />
    );
  });
}

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

function formatSize(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)}KB` : `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export default function WeekChatPanel({ week, onTaskAdded }: Props) {
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [fileUploading, setFileUploading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load or create the session for this week on mount
  useEffect(() => {
    const pageContext = `week:${week}`;
    fetch(`/api/chat/sessions?context=week&page_context=${encodeURIComponent(pageContext)}&limit=1`)
      .then(r => r.ok ? r.json() : [])
      .then(async (sessions: any[]) => {
        if (sessions.length === 0) return; // will be created on first message
        const s = sessions[0];
        const res = await fetch(`/api/chat/sessions/${s.id}`);
        if (!res.ok) return;
        const data = await res.json();
        const loaded: Message[] = (data.messages || []).map((m: any) => ({
          role: m.role,
          content: m.content,
          ...m.metadata,
        }));
        if (loaded.length > 0) {
          setSessionId(s.id);
          setMessages(loaded);
        }
      })
      .catch(() => {/* non-fatal */});
  }, [week]);

  const saveMessage = async (sid: string, msg: Message) => {
    const { tasks_changed, tasks_count, change_type, attachments } = msg;
    await fetch(`/api/chat/sessions/${sid}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: msg.role,
        content: msg.content,
        metadata: { tasks_changed, tasks_count, change_type, attachments: attachments?.map(a => ({ name: a.name, type: a.type, size: a.size })) },
      }),
    }).catch(() => {/* non-fatal */});
  };

  const ensureSession = async (): Promise<string> => {
    if (sessionId) return sessionId;
    const res = await fetch('/api/chat/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context: 'week', page_context: `week:${week}`, title: `Week ${week}` }),
    });
    if (!res.ok) throw new Error('Failed to create session');
    const data = await res.json();
    setSessionId(data.id);
    return data.id;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setFileUploading(true);
    for (const file of files) {
      const size = formatSize(file.size);
      if (IMAGE_TYPES.includes(file.type)) {
        const dataUrl = await new Promise<string>(resolve => {
          const reader = new FileReader();
          reader.onload = ev => resolve(ev.target?.result as string);
          reader.readAsDataURL(file);
        });
        setPendingFiles(prev => [...prev, {
          name: file.name, fileType: file.type, size, parsedText: '',
          previewUrl: dataUrl, base64: dataUrl.split(',')[1], mediaType: file.type,
        }]);
      } else {
        try {
          const formData = new FormData();
          formData.append('file', file);
          const res = await fetch('/api/parse-file', { method: 'POST', body: formData });
          if (res.ok) {
            const data = await res.json();
            const parsedText = (data.rows || []).map((r: Record<string, string>) => Object.values(r).join(' | ')).join('\n');
            setPendingFiles(prev => [...prev, { name: file.name, fileType: file.type, size, parsedText }]);
          }
        } catch { /* skip */ }
      }
    }
    setFileUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const send = async () => {
    const text = input.trim();
    if ((!text && pendingFiles.length === 0) || loading) return;

    const docFiles = pendingFiles.filter(f => !f.base64);
    const imgFiles = pendingFiles.filter(f => f.base64 && f.mediaType);
    const displayContent = text || pendingFiles.map(f => f.name).join(', ');
    const fileContext = docFiles.map(f => `[Attached: ${f.name}]\n${f.parsedText}`).join('\n\n');
    const apiContent = fileContext ? `${fileContext}\n\n${text}` : text;

    const userMsg: Message = {
      role: 'user',
      content: displayContent,
      attachments: pendingFiles.map(f => ({ name: f.name, type: f.fileType, size: f.size, previewUrl: f.previewUrl })),
    };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput('');
    setPendingFiles([]);
    setLoading(true);

    try {
      const sid = await ensureSession().catch(() => null);
      if (sid) await saveMessage(sid, userMsg);

      const apiHistory = [
        ...messages.map(m => ({ role: m.role, content: m.content })),
        { role: 'user' as const, content: apiContent },
      ];

      const res = await fetch('/api/sprint-tasks/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: apiHistory,
          week,
          imageAttachments: imgFiles.map(f => ({ base64: f.base64, mediaType: f.mediaType, name: f.name })),
        }),
      });
      const data = await res.json();
      const assistantMsg: Message = {
        role: 'assistant',
        content: data.content,
        tasks_changed: data.tasks_changed,
        tasks_count: data.tasks_count,
        change_type: data.change_type,
      };
      setMessages(prev => [...prev, assistantMsg]);
      if (sid) await saveMessage(sid, assistantMsg);
      if (data.task_added || data.tasks_changed) {
        onTaskAdded();
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Something went wrong. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="bg-fq-card border border-fq-border rounded-xl shadow-sm flex flex-col" style={{ height: '600px' }}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-fq-border shrink-0">
        <p className="font-body text-[11px] text-fq-muted uppercase tracking-wide">Sprint assistant</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        {messages.map((msg, i) => (
          <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            {/* Image attachments */}
            {msg.attachments && msg.attachments.some(a => a.previewUrl) && (
              <div className="flex flex-wrap gap-1.5 mb-1 justify-end">
                {msg.attachments.filter(a => a.previewUrl).map((a, j) => (
                  <img key={j} src={a.previewUrl} alt={a.name} className="w-20 h-20 object-cover rounded-lg border border-fq-border" />
                ))}
              </div>
            )}
            {/* Document badges */}
            {msg.attachments && msg.attachments.some(a => !a.previewUrl) && (
              <div className="flex flex-wrap gap-1.5 mb-1 justify-end">
                {msg.attachments.filter(a => !a.previewUrl).map((a, j) => (
                  <span key={j} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-fq-light-accent border border-fq-border font-body text-[11px] text-fq-muted">
                    <span className="font-bold text-[10px]">{a.name.split('.').pop()?.toUpperCase()}</span>
                    <span className="max-w-[80px] truncate">{a.name}</span>
                  </span>
                ))}
              </div>
            )}
            <div
              className={`max-w-[85%] px-3 py-2 rounded-xl font-body text-[13px] leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-fq-dark text-white rounded-br-sm'
                  : 'bg-fq-bg text-fq-dark rounded-bl-sm'
              }`}
            >
              {msg.role === 'user' ? (
                <span className="whitespace-pre-wrap">{msg.content}</span>
              ) : (
                <div className="flex flex-col gap-0.5">{formatMessage(msg.content)}</div>
              )}
            </div>
            {changeBadge(msg)}
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-fq-bg text-fq-muted px-3 py-2 rounded-xl rounded-bl-sm font-body text-[13px]">
              <span className="animate-pulse">···</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-fq-border px-3 py-3 flex flex-col gap-2">
        {/* Pending file previews */}
        {pendingFiles.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {pendingFiles.map((f, i) => (
              f.previewUrl ? (
                <div key={i} className="relative group">
                  <img src={f.previewUrl} alt={f.name} className="w-12 h-12 object-cover rounded-lg border border-fq-border" />
                  <button
                    onClick={() => setPendingFiles(prev => prev.filter((_, j) => j !== i))}
                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-fq-dark text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <svg width="7" height="7" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 3l6 6M9 3l-6 6"/></svg>
                  </button>
                </div>
              ) : (
                <div key={i} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-fq-light-accent border border-fq-border">
                  <span className="font-body text-[10px] font-bold text-fq-muted">{f.name.split('.').pop()?.toUpperCase()}</span>
                  <span className="font-body text-[11px] text-fq-dark max-w-[80px] truncate">{f.name}</span>
                  <button onClick={() => setPendingFiles(prev => prev.filter((_, j) => j !== i))} className="text-fq-muted hover:text-fq-dark">
                    <svg width="8" height="8" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M3 3l6 6M9 3l-6 6"/></svg>
                  </button>
                </div>
              )
            ))}
          </div>
        )}
        <div className="flex items-end gap-2">
          {/* Attach button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={fileUploading}
            title="Attach file"
            className="shrink-0 text-fq-muted hover:text-fq-accent transition-colors disabled:opacity-40 mb-1.5"
          >
            <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 7l-6.5 6.5a2.12 2.12 0 11-3-3L12 4a3.5 3.5 0 115 5l-6.5 6.5a5 5 0 01-7-7L10 2" />
            </svg>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/gif,image/webp,.pdf,.docx,.doc,.xlsx,.xls,.csv"
            className="hidden"
            onChange={handleFileChange}
          />
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add a task, ask, or attach a file..."
            rows={1}
            className="flex-1 resize-none bg-fq-bg border border-fq-border rounded-lg px-3 py-2 font-body text-sm text-fq-dark placeholder:text-fq-muted focus:outline-none focus:border-fq-accent leading-relaxed"
            style={{ maxHeight: '96px' }}
          />
          <button
            onClick={send}
            disabled={(!input.trim() && pendingFiles.length === 0) || loading}
            className="shrink-0 w-8 h-8 rounded-lg bg-fq-dark text-white flex items-center justify-center hover:opacity-80 disabled:opacity-30 transition-opacity"
            aria-label="Send"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 7H2M7 2l5 5-5 5" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
