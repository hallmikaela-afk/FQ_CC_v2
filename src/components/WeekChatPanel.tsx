'use client';

import { useState, useRef, useEffect } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Props {
  week: string;
  onTaskAdded: () => void;
}

const INITIAL_MESSAGE: Message = {
  role: 'assistant',
  content: "Add tasks to your sprint by telling me what you need to do and which project it's for.\n\nFor example: 'Add email Art about florals to Menorca' or 'Add check RSVP to Julia & Frank.'",
};

export default function WeekChatPanel({ week, onTaskAdded }: Props) {
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { role: 'user', content: text };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/sprint-tasks/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextMessages.map(m => ({ role: m.role, content: m.content })),
          week,
        }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.content }]);
      if (data.task_added) {
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
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] px-3 py-2 rounded-xl font-body text-[13px] leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-fq-dark text-white rounded-br-sm'
                  : 'bg-fq-bg text-fq-dark rounded-bl-sm'
              }`}
            >
              {msg.content}
            </div>
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
          ref={textareaRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add a task or ask..."
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
  );
}
