'use client';

import { useState, useRef, useEffect } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  tasks_added?: boolean;
  tasks_count?: number;
}

interface Props {
  week: string;
  onTaskAdded: () => void;
}

const INITIAL_MESSAGE: Message = {
  role: 'assistant',
  content: "Add sprint tasks or planner tasks by telling me what you need to do and which project it's for.\n\nExamples:\n- 'Add email Art about florals to Menorca'\n- 'Create a task on Sun-Steeped to research drapery vendors with subtasks to email each one'",
};

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
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: data.content,
          tasks_added: data.task_added || data.tasks_added,
          tasks_count: data.tasks_count,
        },
      ]);
      if (data.task_added || data.tasks_added) {
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
            {/* Task added badge */}
            {msg.tasks_added && (
              <div className="flex items-center gap-1.5 mt-1 px-2.5 py-1 rounded-full bg-fq-sage-light border border-fq-sage/20 font-body text-[11px] text-fq-sage font-medium">
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 6l3 3 5-5" />
                </svg>
                {msg.tasks_count && msg.tasks_count > 1 ? `${msg.tasks_count} tasks added` : 'Task added'}
              </div>
            )}
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
