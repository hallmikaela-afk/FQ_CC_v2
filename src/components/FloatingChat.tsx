'use client';

import { useState, useRef, useEffect } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  tasks_changed?: boolean;
  tasks_count?: number;
  change_type?: 'created' | 'updated' | 'completed' | 'mixed' | null;
}

const INITIAL_MESSAGE: Message = {
  role: 'assistant',
  content: "Hi Mikaela — ask me anything about your projects, tasks, vendors, or upcoming events. I can create, update, and complete tasks directly.",
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

export default function FloatingChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, open]);

  // Load the most recent floating session when the chat opens for the first time
  useEffect(() => {
    if (!open || sessionId !== null) return;
    fetch('/api/chat/sessions?context=floating&limit=1')
      .then(r => r.ok ? r.json() : [])
      .then(async (sessions: any[]) => {
        if (sessions.length === 0) return;
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
      .catch(() => {/* Supabase not configured — stay with initial message */});
  }, [open, sessionId]);

  const startNewConversation = () => {
    setSessionId(null);
    setMessages([INITIAL_MESSAGE]);
    setInput('');
  };

  const saveMessage = async (sid: string, msg: Message) => {
    const { tasks_changed, tasks_count, change_type, ...rest } = msg;
    await fetch(`/api/chat/sessions/${sid}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: msg.role,
        content: msg.content,
        metadata: { tasks_changed, tasks_count, change_type },
      }),
    }).catch(() => {/* non-fatal */});
  };

  const ensureSession = async (): Promise<string> => {
    if (sessionId) return sessionId;
    const res = await fetch('/api/chat/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context: 'floating' }),
    });
    if (!res.ok) throw new Error('Failed to create session');
    const data = await res.json();
    setSessionId(data.id);
    return data.id;
  };

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { role: 'user', content: text };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);

    try {
      const sid = await ensureSession().catch(() => null);
      if (sid) await saveMessage(sid, userMsg);

      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      const assistantMsg: Message = {
        role: 'assistant',
        content: data.content || data.error || 'No response.',
        tasks_changed: data.tasks_changed,
        tasks_count: data.tasks_count,
        change_type: data.change_type,
      };
      setMessages(prev => [...prev, assistantMsg]);
      if (sid) await saveMessage(sid, assistantMsg);
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
    <>
      {/* Drawer */}
      <div
        className={`
          fixed bottom-20 right-6 z-50
          w-[360px] h-[500px]
          bg-fq-card border border-fq-border rounded-xl shadow-xl
          flex flex-col
          transition-all duration-200
          ${open ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-4 pointer-events-none'}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-fq-border shrink-0">
          <h2 className="font-heading text-[14px] text-fq-dark">Fox &amp; Quinn Assistant</h2>
          <div className="flex items-center gap-2">
            {/* New conversation */}
            <button
              onClick={startNewConversation}
              title="New conversation"
              className="text-fq-muted hover:text-fq-dark transition-colors"
              aria-label="New conversation"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M8 3v10M3 8h10"/>
              </svg>
            </button>
            {/* Expand to full assistant page */}
            <a
              href="/assistant"
              title="Open full assistant"
              className="text-fq-muted hover:text-fq-dark transition-colors"
              aria-label="Expand to full chat"
            >
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 2h4v4M14 2l-5 5M6 14H2v-4M2 14l5-5" />
              </svg>
            </a>
            <button
              onClick={() => setOpen(false)}
              className="text-fq-muted hover:text-fq-dark transition-colors"
              aria-label="Close chat"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
          {messages.map((msg, i) => (
            <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
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
        <div className="shrink-0 border-t border-fq-border px-3 py-3 flex items-end gap-2">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything or create a task..."
            rows={1}
            className="flex-1 resize-none bg-fq-bg border border-fq-border rounded-lg px-3 py-2 font-body text-sm text-fq-dark placeholder:text-fq-muted focus:outline-none focus:border-fq-accent leading-relaxed"
            style={{ maxHeight: '96px' }}
          />
          <button
            onClick={send}
            disabled={!input.trim() || loading}
            className="shrink-0 w-8 h-8 rounded-lg bg-fq-dark text-white flex items-center justify-center hover:opacity-80 disabled:opacity-30 transition-opacity"
            aria-label="Send"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 7H2M7 2l5 5-5 5" />
            </svg>
          </button>
        </div>
      </div>

      {/* Trigger button */}
      <button
        onClick={() => setOpen(prev => !prev)}
        className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full bg-fq-dark text-white shadow-lg flex items-center justify-center hover:bg-fq-dark/90 transition-all"
        aria-label={open ? 'Close assistant' : 'Open assistant'}
      >
        {open ? (
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 4l10 10M14 4L4 14" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 10c0 3.87-3.13 7-7 7-1.5 0-2.9-.47-4.05-1.28L3 17l1.28-2.95A6.96 6.96 0 013 10c0-3.87 3.13-7 7-7s7 3.13 7 7z" />
          </svg>
        )}
      </button>
    </>
  );
}
