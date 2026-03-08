'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { projects, team, getTeamMember, type Project, type Task, type Vendor } from '@/data/seed';

/* ── Tokens ── */
const t = {
  heading: 'text-fq-dark/90',
  body: 'text-fq-muted/90',
  light: 'text-fq-muted/70',
  icon: 'text-fq-muted/60',
  label: 'text-fq-muted/80',
};

/* ── Types ── */
interface Attachment {
  name: string;
  type: string;
  size: string;
}

interface ToolUse {
  label: string;   // e.g. "Searching tasks for Julia & Frank"
  icon: 'search' | 'tasks' | 'vendors' | 'notes' | 'web' | 'upload';
}

interface InlineTask {
  id: string;
  text: string;
  completed: boolean;
  due_date?: string;
  project: string;
  category?: string;
  isNew?: boolean;
}

interface InlineVendor {
  category: string;
  vendor_name: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  website?: string;
  instagram?: string;
  isNew?: boolean;
}

interface ProjectRef {
  id: string;
  name: string;
  color: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  attachments?: Attachment[];
  toolUses?: ToolUse[];
  inlineTasks?: InlineTask[];
  inlineVendors?: InlineVendor[];
  projectRefs?: ProjectRef[];
  vendorProject?: string; // project name for vendor additions
}

/* ── Chat History Types ── */
interface SavedChat {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

const MAX_HISTORY = 25;
const STORAGE_KEY = 'fq-assistant-history';

/* ── localStorage helpers ── */
function loadHistory(): SavedChat[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(chats: SavedChat[]) {
  if (typeof window === 'undefined') return;
  // Keep only the most recent MAX_HISTORY chats
  const trimmed = chats.slice(0, MAX_HISTORY);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
}

function generateTitle(messages: ChatMessage[]): string {
  const firstUserMsg = messages.find(m => m.role === 'user');
  if (!firstUserMsg) return 'New chat';
  const text = firstUserMsg.content;
  return text.length > 50 ? text.slice(0, 50) + '...' : text;
}

function formatHistoryDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/* ── Icons ── */
function ToolIcon({ icon }: { icon: ToolUse['icon'] }) {
  const cls = "w-3.5 h-3.5";
  switch (icon) {
    case 'search': return <svg className={cls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="7" cy="7" r="4"/><path d="M10 10l3 3"/></svg>;
    case 'tasks': return <svg className={cls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="12" height="12" rx="2"/><path d="M5 8l2 2 4-4"/></svg>;
    case 'vendors': return <svg className={cls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="5" r="3"/><path d="M2 14c0-3 2.5-5 6-5s6 2 6 5"/></svg>;
    case 'notes': return <svg className={cls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="2" width="10" height="12" rx="1.5"/><path d="M6 5h4M6 8h4M6 11h2"/></svg>;
    case 'web': return <svg className={cls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="8" r="6"/><path d="M2 8h12M8 2c2 2.5 2 9.5 0 12M8 2c-2 2.5-2 9.5 0 12"/></svg>;
    case 'upload': return <svg className={cls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 10V3M5 5l3-3 3 3"/><path d="M2 11v2a1 1 0 001 1h10a1 1 0 001-1v-2"/></svg>;
  }
}

/* ── Tool use pill ── */
function ToolUsePill({ tool }: { tool: ToolUse }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-fq-light-accent text-fq-accent font-body text-[11px] font-medium">
      <ToolIcon icon={tool.icon} />
      {tool.label}
    </span>
  );
}

/* ── Inline task card ── */
function InlineTaskCard({ task, onToggle }: { task: InlineTask; onToggle: (id: string) => void }) {
  const project = projects.find(p => p.name === task.project);
  return (
    <div className={`flex items-start gap-3 px-4 py-3 rounded-lg border ${task.isNew ? 'border-fq-sage/30 bg-fq-sage-light/30' : 'border-fq-border bg-fq-card'} group`}>
      <button
        onClick={() => onToggle(task.id)}
        className={`mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${task.completed ? 'bg-fq-sage border-fq-sage' : 'border-fq-muted/40 hover:border-fq-sage'}`}
      >
        {task.completed && (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 5l2 2 4-4"/></svg>
        )}
      </button>
      <div className="flex-1 min-w-0">
        <p className={`font-body text-[13px] ${task.completed ? 'line-through text-fq-muted/50' : t.heading}`}>{task.text}</p>
        <div className="flex items-center gap-2 mt-1">
          {project && <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: project.color }} />}
          <span className={`font-body text-[11px] ${t.light}`}>{task.project}</span>
          {task.due_date && <span className={`font-body text-[11px] ${t.light}`}>· Due {task.due_date}</span>}
          {task.category && <span className={`font-body text-[11px] ${t.light}`}>· {task.category}</span>}
          {task.isNew && <span className="font-body text-[10px] font-medium text-fq-sage bg-fq-sage-light px-1.5 py-0.5 rounded">Added</span>}
        </div>
      </div>
    </div>
  );
}

/* ── Inline vendor card ── */
function InlineVendorCard({ vendor }: { vendor: InlineVendor }) {
  return (
    <div className={`flex items-start gap-3 px-4 py-3 rounded-lg border ${vendor.isNew ? 'border-fq-sage/30 bg-fq-sage-light/30' : 'border-fq-border bg-fq-card'}`}>
      <div className="w-8 h-8 rounded-full bg-fq-light-accent flex items-center justify-center shrink-0">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-fq-accent">
          <circle cx="8" cy="5" r="3"/><path d="M2 14c0-3 2.5-5 6-5s6 2 6 5"/>
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`font-body text-[13px] font-semibold ${t.heading}`}>{vendor.vendor_name}</span>
          <span className="font-body text-[11px] text-fq-accent bg-fq-light-accent px-2 py-0.5 rounded-full">{vendor.category}</span>
          {vendor.isNew && <span className="font-body text-[10px] font-medium text-fq-sage bg-fq-sage-light px-1.5 py-0.5 rounded">New</span>}
        </div>
        <div className={`font-body text-[12px] ${t.light} mt-0.5 space-y-0`}>
          {vendor.contact_name && <p>Contact: {vendor.contact_name}</p>}
          <div className="flex flex-wrap gap-x-3">
            {vendor.email && <span>{vendor.email}</span>}
            {vendor.phone && <span>{vendor.phone}</span>}
          </div>
          <div className="flex flex-wrap gap-x-3">
            {vendor.website && <span className="text-fq-accent underline">{vendor.website}</span>}
            {vendor.instagram && <span>{vendor.instagram}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Project reference chip ── */
function ProjectChip({ proj }: { proj: ProjectRef }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-fq-light-accent font-body text-[12px] font-medium text-fq-dark/80">
      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: proj.color }} />
      {proj.name}
    </span>
  );
}

/* ── Attachment badge ── */
function AttachmentBadge({ att }: { att: Attachment }) {
  const ext = att.name.split('.').pop()?.toUpperCase() || 'FILE';
  const colors: Record<string, string> = {
    'PDF': 'bg-fq-rose-light text-fq-rose',
    'XLSX': 'bg-fq-sage-light text-fq-sage',
    'XLS': 'bg-fq-sage-light text-fq-sage',
    'CSV': 'bg-fq-sage-light text-fq-sage',
    'DOCX': 'bg-fq-blue-light text-fq-blue',
    'PNG': 'bg-fq-plum-light text-fq-plum',
    'JPG': 'bg-fq-plum-light text-fq-plum',
  };
  const c = colors[ext] || 'bg-fq-light-accent text-fq-muted';
  return (
    <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-fq-border bg-fq-card`}>
      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${c}`}>{ext}</span>
      <div>
        <p className={`font-body text-[12px] font-medium ${t.heading}`}>{att.name}</p>
        <p className={`font-body text-[10px] ${t.light}`}>{att.size}</p>
      </div>
    </div>
  );
}

/* ── Render markdown-lite (bold, italic, line breaks, bullet points) ── */
function renderContent(text: string) {
  const lines = text.split('\n');
  return lines.map((line, i) => {
    // Bullet points
    if (line.trim().startsWith('- ') || line.trim().startsWith('• ')) {
      const content = line.trim().replace(/^[-•]\s*/, '');
      return (
        <div key={i} className="flex gap-2 ml-1 my-0.5">
          <span className="text-fq-accent mt-0.5">•</span>
          <span dangerouslySetInnerHTML={{ __html: formatInline(content) }} />
        </div>
      );
    }
    // Numbered lists
    const numMatch = line.trim().match(/^(\d+)\.\s+(.*)/);
    if (numMatch) {
      return (
        <div key={i} className="flex gap-2 ml-1 my-0.5">
          <span className="text-fq-accent font-medium min-w-[16px]">{numMatch[1]}.</span>
          <span dangerouslySetInnerHTML={{ __html: formatInline(numMatch[2]) }} />
        </div>
      );
    }
    // Empty line
    if (line.trim() === '') return <div key={i} className="h-2" />;
    // Normal text
    return <p key={i} dangerouslySetInnerHTML={{ __html: formatInline(line) }} />;
  });
}

function formatInline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-fq-dark/90">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code class="px-1 py-0.5 rounded bg-fq-light-accent text-fq-accent text-[12px]">$1</code>');
}

/* ── Suggested prompts ── */
const SUGGESTIONS = [
  { icon: 'notes' as const, text: 'Summarize my latest call notes for Julia & Frank' },
  { icon: 'tasks' as const, text: 'What tasks are overdue across all projects?' },
  { icon: 'vendors' as const, text: 'Show me vendor contacts for the Menorca shoot' },
  { icon: 'web' as const, text: 'Research outdoor ceremony backup plan ideas' },
];

/* ── Project mention dropdown helper ── */
const mentionableProjects = projects.filter(p => p.status === 'active');

/* ═══════════════════════════════════════════════════ */
/*  MAIN COMPONENT                                     */
/* ═══════════════════════════════════════════════════ */
export default function AssistantPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [taskStates, setTaskStates] = useState<Record<string, boolean>>({});
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<SavedChat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const messagesEnd = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load history from localStorage on mount
  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  // Auto-save current chat to history whenever messages change
  useEffect(() => {
    if (messages.length === 0) return;

    setHistory(prev => {
      let updated: SavedChat[];
      const now = new Date().toISOString();

      if (activeChatId) {
        // Update existing chat
        updated = prev.map(chat =>
          chat.id === activeChatId
            ? { ...chat, messages, title: generateTitle(messages), updatedAt: now }
            : chat
        );
      } else {
        // Create new chat entry
        const newId = `chat-${Date.now()}`;
        const newChat: SavedChat = {
          id: newId,
          title: generateTitle(messages),
          messages,
          createdAt: now,
          updatedAt: now,
        };
        setActiveChatId(newId);
        updated = [newChat, ...prev];
      }

      // Sort by most recent and trim
      updated.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      updated = updated.slice(0, MAX_HISTORY);
      saveHistory(updated);
      return updated;
    });
  }, [messages]); // eslint-disable-line react-hooks/exhaustive-deps

  const scrollToBottom = useCallback(() => {
    messagesEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, scrollToBottom]);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 160) + 'px';
    }
  }, [input]);

  const handleToggleTask = (taskId: string) => {
    setTaskStates(prev => ({ ...prev, [taskId]: !prev[taskId] }));
  };

  const isTaskCompleted = (task: InlineTask) => taskStates[task.id] ?? task.completed;

  const handleSend = async () => {
    const text = input.trim();
    if (!text) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    // Build conversation history for API
    const allMessages = [...messages, userMsg];
    const apiMessages = allMessages.map(m => ({
      role: m.role,
      content: m.content,
    }));

    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages }),
      });

      if (!res.ok) throw new Error('API error');

      const data = await res.json();
      const aiMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: data.content || data.error || 'Sorry, something went wrong.',
        timestamp: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
        toolUses: getSimulatedTools(text),
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch {
      // Fallback to simulated response if API not configured
      const aiMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: getSimulatedResponse(text),
        timestamp: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
        toolUses: getSimulatedTools(text),
      };
      setMessages(prev => [...prev, aiMsg]);
    }

    setIsTyping(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === '@') {
      setShowMentions(true);
      setMentionFilter('');
    }
    if (showMentions && e.key === 'Escape') {
      setShowMentions(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    // Track @mention filtering
    if (showMentions) {
      const atIdx = e.target.value.lastIndexOf('@');
      if (atIdx >= 0) {
        setMentionFilter(e.target.value.slice(atIdx + 1));
      } else {
        setShowMentions(false);
      }
    }
  };

  const insertMention = (project: Project) => {
    const atIdx = input.lastIndexOf('@');
    setInput(input.slice(0, atIdx) + `@${project.name} `);
    setShowMentions(false);
    inputRef.current?.focus();
  };

  const handleNewChat = () => {
    setMessages([]);
    setActiveChatId(null);
    setTaskStates({});
    setShowHistory(false);
    inputRef.current?.focus();
  };

  const handleLoadChat = (chat: SavedChat) => {
    setMessages(chat.messages);
    setActiveChatId(chat.id);
    setTaskStates({});
    setShowHistory(false);
  };

  const handleDeleteChat = (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setHistory(prev => {
      const updated = prev.filter(c => c.id !== chatId);
      saveHistory(updated);
      return updated;
    });
    if (activeChatId === chatId) {
      setMessages([]);
      setActiveChatId(null);
      setTaskStates({});
    }
  };

  const filteredMentions = mentionableProjects.filter(p =>
    p.name.toLowerCase().includes(mentionFilter.toLowerCase())
  );

  /* ── Input bar ── */
  function renderInputBar() {
    return (
      <div className="border-t border-fq-border bg-fq-card px-4 py-3">
        <div className="max-w-[760px] mx-auto relative">
          {/* @mention dropdown */}
          {showMentions && filteredMentions.length > 0 && (
            <div className="absolute bottom-full mb-2 left-0 w-64 bg-fq-card border border-fq-border rounded-xl shadow-lg overflow-hidden z-50">
              <div className="px-3 py-2 border-b border-fq-border">
                <p className={`font-body text-[11px] ${t.light} uppercase tracking-wide`}>Reference a project</p>
              </div>
              {filteredMentions.map(p => (
                <button
                  key={p.id}
                  onClick={() => insertMention(p)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-fq-light-accent transition-colors text-left"
                >
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                  <span className={`font-body text-[13px] ${t.heading}`}>{p.name}</span>
                  <span className={`font-body text-[11px] ${t.light} ml-auto`}>{p.type}</span>
                </button>
              ))}
            </div>
          )}

          <div className="flex items-end gap-2 bg-fq-bg rounded-2xl border border-fq-border px-4 py-2 focus-within:border-fq-accent/40 transition-colors">
            {/* File upload */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className={`p-1.5 rounded-lg hover:bg-fq-light-accent transition-colors ${t.icon} hover:text-fq-accent mb-0.5`}
              title="Attach file"
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 7l-6.5 6.5a2.12 2.12 0 11-3-3L12 4a3.5 3.5 0 115 5l-6.5 6.5a5 5 0 01-7-7L10 2" />
              </svg>
            </button>
            <input ref={fileInputRef} type="file" className="hidden" />

            {/* Text input */}
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Message Fox & Quinn Assistant... (@ to reference a project)"
              rows={1}
              className="flex-1 bg-transparent font-body text-[14px] text-fq-dark/90 placeholder:text-fq-muted/40 resize-none outline-none py-1.5 max-h-[160px]"
            />

            {/* Send */}
            <button
              onClick={handleSend}
              disabled={!input.trim() || isTyping}
              className={`p-2 rounded-xl transition-all duration-200 mb-0.5 ${input.trim() && !isTyping ? 'bg-fq-accent text-white hover:bg-fq-accent/90' : 'bg-fq-light-accent text-fq-muted/30'}`}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2L7 9" />
                <path d="M14 2l-4 12-3-5-5-3z" />
              </svg>
            </button>
          </div>

          <p className={`font-body text-[11px] ${t.light} text-center mt-2`}>
            Type <kbd className="px-1 py-0.5 rounded bg-fq-light-accent text-fq-accent text-[10px] font-medium">@</kbd> to reference a project · Attach files to import vendor sheets, call notes, and more
          </p>
        </div>
      </div>
    );
  }

  /* ── History sidebar ── */
  function renderHistorySidebar() {
    if (!showHistory) return null;
    return (
      <>
        {/* Backdrop */}
        <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setShowHistory(false)} />
        {/* Sidebar */}
        <div className="fixed left-0 top-0 h-full w-80 bg-fq-card border-r border-fq-border z-50 flex flex-col shadow-xl">
          {/* Sidebar header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-fq-border">
            <h3 className={`font-heading text-[15px] font-semibold ${t.heading}`}>Chat History</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={handleNewChat}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-fq-accent text-white font-body text-[11px] font-medium hover:bg-fq-accent/90 transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M8 3v10M3 8h10"/>
                </svg>
                New chat
              </button>
              <button
                onClick={() => setShowHistory(false)}
                className={`p-1.5 rounded-lg hover:bg-fq-light-accent transition-colors ${t.icon}`}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M4 4l8 8M12 4l-8 8"/>
                </svg>
              </button>
            </div>
          </div>

          {/* Chat list */}
          <div className="flex-1 overflow-y-auto">
            {history.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full px-6">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-fq-muted/30 mb-3">
                  <path d="M21 12c0 4.97-4.03 9-9 9-1.93 0-3.73-.6-5.2-1.64L3 21l1.64-3.8A8.96 8.96 0 013 12c0-4.97 4.03-9 9-9s9 4.03 9 9z"/>
                </svg>
                <p className={`font-body text-[13px] ${t.light} text-center`}>No chat history yet</p>
                <p className={`font-body text-[11px] ${t.light} text-center mt-1`}>Your conversations will appear here</p>
              </div>
            ) : (
              <div className="py-2">
                {history.map(chat => (
                  <button
                    key={chat.id}
                    onClick={() => handleLoadChat(chat)}
                    className={`w-full flex items-start gap-3 px-4 py-3 hover:bg-fq-light-accent transition-colors text-left group ${
                      activeChatId === chat.id ? 'bg-fq-light-accent' : ''
                    }`}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={`${t.icon} shrink-0 mt-0.5`}>
                      <path d="M21 12c0 4.97-4.03 9-9 9-1.93 0-3.73-.6-5.2-1.64L3 21l1.64-3.8A8.96 8.96 0 013 12c0-4.97 4.03-9 9-9s9 4.03 9 9z"/>
                    </svg>
                    <div className="flex-1 min-w-0">
                      <p className={`font-body text-[13px] ${t.heading} truncate`}>{chat.title}</p>
                      <p className={`font-body text-[11px] ${t.light} mt-0.5`}>
                        {chat.messages.length} messages · {formatHistoryDate(chat.updatedAt)}
                      </p>
                    </div>
                    <button
                      onClick={(e) => handleDeleteChat(chat.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-fq-border transition-all shrink-0"
                      title="Delete chat"
                    >
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                        <path d="M4 4l8 8M12 4l-8 8"/>
                      </svg>
                    </button>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Sidebar footer */}
          {history.length > 0 && (
            <div className="px-4 py-3 border-t border-fq-border">
              <p className={`font-body text-[11px] ${t.light} text-center`}>
                {history.length} of {MAX_HISTORY} conversations saved
              </p>
            </div>
          )}
        </div>
      </>
    );
  }

  /* ── Empty state ── */
  if (messages.length === 0) {
    return (
      <div className="flex flex-col h-screen">
        {renderHistorySidebar()}
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <div className="max-w-[560px] w-full text-center">
            {/* Logo / greeting */}
            <div className="mb-8">
              <div className="w-12 h-12 rounded-2xl bg-fq-accent/10 flex items-center justify-center mx-auto mb-4">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-fq-accent">
                  <path d="M21 12c0 4.97-4.03 9-9 9-1.93 0-3.73-.6-5.2-1.64L3 21l1.64-3.8A8.96 8.96 0 013 12c0-4.97 4.03-9 9-9s9 4.03 9 9z"/>
                </svg>
              </div>
              <h1 className={`font-heading text-[28px] font-semibold ${t.heading}`}>Fox & Quinn Assistant</h1>
              <p className={`font-body text-[14px] ${t.light} mt-2 max-w-[400px] mx-auto`}>
                I have access to all your projects, client notes, tasks, and vendor information. Ask me anything or upload a file to get started.
              </p>
            </div>

            {/* Suggestion cards */}
            <div className="grid grid-cols-2 gap-3 mb-8">
              {SUGGESTIONS.map((s, i) => (
                <button
                  key={i}
                  onClick={() => { setInput(s.text); inputRef.current?.focus(); }}
                  className="flex items-start gap-3 px-4 py-3.5 rounded-xl border border-fq-border bg-fq-card hover:border-fq-accent/30 hover:shadow-sm transition-all duration-200 text-left group"
                >
                  <span className="mt-0.5 text-fq-muted/50 group-hover:text-fq-accent transition-colors">
                    <ToolIcon icon={s.icon} />
                  </span>
                  <span className={`font-body text-[13px] ${t.body} group-hover:text-fq-dark/80 transition-colors`}>{s.text}</span>
                </button>
              ))}
            </div>

            {/* History button (only show if there's history) */}
            {history.length > 0 && (
              <button
                onClick={() => setShowHistory(true)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-fq-border font-body text-[12px] ${t.body} hover:bg-fq-light-accent transition-colors`}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="8" cy="8" r="6"/>
                  <path d="M8 4.5V8l2.5 1.5"/>
                </svg>
                View chat history ({history.length})
              </button>
            )}
          </div>
        </div>

        {/* Input bar (empty state) */}
        {renderInputBar()}
      </div>
    );
  }

  /* ── Chat thread ── */
  return (
    <div className="flex flex-col h-screen">
      {renderHistorySidebar()}

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-fq-border bg-fq-card">
        <div className="flex items-center gap-3">
          {/* History toggle */}
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={`p-1.5 rounded-lg hover:bg-fq-light-accent transition-colors ${t.icon} hover:text-fq-accent`}
            title="Chat history"
          >
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 3h12M2 8h12M2 13h12"/>
            </svg>
          </button>
          <div className="w-8 h-8 rounded-xl bg-fq-accent/10 flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-fq-accent">
              <path d="M21 12c0 4.97-4.03 9-9 9-1.93 0-3.73-.6-5.2-1.64L3 21l1.64-3.8A8.96 8.96 0 013 12c0-4.97 4.03-9 9-9s9 4.03 9 9z"/>
            </svg>
          </div>
          <div>
            <h2 className={`font-heading text-[16px] font-semibold ${t.heading}`}>Fox & Quinn Assistant</h2>
            <p className={`font-body text-[11px] ${t.light}`}>
              {isTyping ? 'Thinking...' : 'Connected to all projects'}
            </p>
          </div>
        </div>
        <button
          onClick={handleNewChat}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-fq-border font-body text-[12px] ${t.body} hover:bg-fq-light-accent transition-colors`}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M8 3v10M3 8h10"/>
          </svg>
          New chat
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[760px] mx-auto px-4 py-6 space-y-6">
          {messages.map(msg => (
            <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 rounded-lg bg-fq-accent/10 flex items-center justify-center shrink-0 mt-0.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-fq-accent">
                    <path d="M21 12c0 4.97-4.03 9-9 9-1.93 0-3.73-.6-5.2-1.64L3 21l1.64-3.8A8.96 8.96 0 013 12c0-4.97 4.03-9 9-9s9 4.03 9 9z"/>
                  </svg>
                </div>
              )}

              <div className={`${msg.role === 'user' ? 'max-w-[85%]' : 'max-w-[90%] flex-1'}`}>
                {/* Attachments (user) */}
                {msg.attachments && msg.attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2 justify-end">
                    {msg.attachments.map((att, i) => <AttachmentBadge key={i} att={att} />)}
                  </div>
                )}

                {/* Message bubble */}
                <div className={`
                  rounded-2xl px-5 py-3.5 font-body text-[13.5px] leading-relaxed
                  ${msg.role === 'user'
                    ? 'bg-fq-accent text-white rounded-br-md'
                    : 'bg-fq-card border border-fq-border rounded-bl-md'
                  }
                `}>
                  {/* Tool uses */}
                  {msg.toolUses && msg.toolUses.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {msg.toolUses.map((tool, i) => <ToolUsePill key={i} tool={tool} />)}
                    </div>
                  )}

                  {/* Project refs */}
                  {msg.role === 'assistant' && msg.projectRefs && msg.projectRefs.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {msg.projectRefs.map(p => <ProjectChip key={p.id} proj={p} />)}
                    </div>
                  )}

                  {/* Content */}
                  <div className={msg.role === 'user' ? '' : t.body}>
                    {renderContent(msg.content)}
                  </div>
                </div>

                {/* Inline tasks */}
                {msg.inlineTasks && msg.inlineTasks.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {msg.inlineTasks.map(task => (
                      <InlineTaskCard
                        key={task.id}
                        task={{ ...task, completed: isTaskCompleted(task) }}
                        onToggle={handleToggleTask}
                      />
                    ))}
                  </div>
                )}

                {/* Inline vendors */}
                {msg.inlineVendors && msg.inlineVendors.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {msg.vendorProject && (
                      <p className={`font-body text-[12px] ${t.light} mb-1`}>Added to {msg.vendorProject} project:</p>
                    )}
                    {msg.inlineVendors.map((v, i) => <InlineVendorCard key={i} vendor={v} />)}
                  </div>
                )}

                {/* Timestamp */}
                <p className={`font-body text-[11px] ${t.light} mt-1.5 ${msg.role === 'user' ? 'text-right' : ''}`}>
                  {msg.timestamp}
                </p>
              </div>

              {msg.role === 'user' && (
                <div className="w-7 h-7 rounded-lg bg-fq-accent flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-white text-[11px] font-bold font-body">MH</span>
                </div>
              )}
            </div>
          ))}

          {/* Typing indicator */}
          {isTyping && (
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-lg bg-fq-accent/10 flex items-center justify-center shrink-0">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-fq-accent">
                  <path d="M21 12c0 4.97-4.03 9-9 9-1.93 0-3.73-.6-5.2-1.64L3 21l1.64-3.8A8.96 8.96 0 013 12c0-4.97 4.03-9 9-9s9 4.03 9 9z"/>
                </svg>
              </div>
              <div className="bg-fq-card border border-fq-border rounded-2xl rounded-bl-md px-5 py-4">
                <div className="flex gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-fq-muted/30 animate-bounce [animation-delay:0ms]" />
                  <span className="w-2 h-2 rounded-full bg-fq-muted/30 animate-bounce [animation-delay:150ms]" />
                  <span className="w-2 h-2 rounded-full bg-fq-muted/30 animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEnd} />
        </div>
      </div>

      {/* Input */}
      {renderInputBar()}
    </div>
  );
}

/* ── Simulated responses for live demo ── */
function getSimulatedResponse(input: string): string {
  const lower = input.toLowerCase();

  if (lower.includes('overdue') || lower.includes('behind')) {
    return `Looking across all your active projects, here's the overdue summary:

**Julia & Frank** — 2 overdue
- Book hotel blocks for guests (was due Feb 12)
- Follow up with Julia on calligrapher Instagram handle (was due Mar 7)

**Elisabeth & JJ** — 4 overdue
- Send band options to Elisabeth (was due Mar 1)
- Follow up on venue deposit (was due Mar 5)
- Schedule florist consultation (was due Mar 10)
- Send save-the-date design concepts (was due Mar 18)

**Tippi & Justin** — 0 overdue (great shape!)

**Styled Shoots** — All on track

Want me to help prioritize or draft follow-up messages for any of these?`;
  }

  if (lower.includes('vendor') || lower.includes('contact')) {
    return `I can help with vendor information! Just let me know which project you're asking about, or upload a vendor sheet and I'll parse it and add the contacts to the right project.

You can also use **@** to reference a specific project, like "@Julia & Frank vendors" or "@Menorca florist contact."`;
  }

  if (lower.includes('task') || lower.includes('to do') || lower.includes('todo')) {
    return `I can help manage tasks! Here's what I can do:

- **View tasks** — for any project or across all projects
- **Create tasks** — just describe what needs to be done and I'll add it to the right project
- **Update tasks** — mark complete, change due dates, reassign
- **Break down tasks** — add subtasks to existing items

Which would you like to do?`;
  }

  return `I'd be happy to help with that! I have access to all your Fox & Quinn projects, including:

- **3 active client weddings** (Julia & Frank, Tippi & Justin, Elisabeth & JJ)
- **2 styled shoots** (Sun-Steeped, Menorca)
- **All call notes, tasks, vendors, and timelines**

Could you give me a bit more detail about what you need? I can search through call notes, manage tasks, look up vendor contacts, or do research — just let me know!`;
}

function getSimulatedTools(input: string): ToolUse[] {
  const lower = input.toLowerCase();
  const tools: ToolUse[] = [];

  if (lower.includes('overdue') || lower.includes('task') || lower.includes('behind')) {
    tools.push({ label: 'Scanning tasks across all projects', icon: 'tasks' });
  }
  if (lower.includes('vendor') || lower.includes('contact')) {
    tools.push({ label: 'Searching vendor contacts', icon: 'vendors' });
  }
  if (lower.includes('call') || lower.includes('note') || lower.includes('summar')) {
    tools.push({ label: 'Reviewing call notes', icon: 'notes' });
  }
  if (lower.includes('research') || lower.includes('find') || lower.includes('recommend')) {
    tools.push({ label: 'Searching the web', icon: 'web' });
  }

  return tools;
}
