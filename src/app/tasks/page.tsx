'use client';
/* Master task view — aggregates tasks from all projects */
import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useFullProjects } from '@/lib/hooks';
import { formatDate, formatMonthYear } from '@/data/seed';
import type { Task, SubTask, TeamMember } from '@/data/seed';

// Module-level variables — set by the main component after data loads
let getTeamMember: (id: string) => TeamMember | undefined = () => undefined;
let allAssignedTo: string[] = [];

/* ── Gather all tasks with project context ── */
type TaskWithProject = Task & { projectId: string; projectName: string };

/* ── Column Configuration ── */
type ColumnId = 'checkbox' | 'task' | 'notes' | 'category' | 'project' | 'status' | 'priority' | 'due_date' | 'person' | 'function_roles';

interface ColumnConfig {
  id: ColumnId;
  label: string;
  width: string;
  visible: boolean;
  resizable: boolean;
}

interface SavedView {
  name: string;
  columns: ColumnConfig[];
}

const DEFAULT_COLUMNS: ColumnConfig[] = [
  { id: 'checkbox', label: '', width: '20px', visible: true, resizable: false },
  { id: 'task', label: 'Task', width: '1fr', visible: true, resizable: false },
  { id: 'notes', label: 'Notes', width: '120px', visible: true, resizable: true },
  { id: 'category', label: 'Category', width: '120px', visible: true, resizable: true },
  { id: 'project', label: 'Project', width: '110px', visible: true, resizable: true },
  { id: 'status', label: 'Status', width: '100px', visible: true, resizable: true },
  { id: 'priority', label: 'Priority', width: '80px', visible: true, resizable: true },
  { id: 'due_date', label: 'Due Date', width: '90px', visible: true, resizable: true },
  { id: 'person', label: 'Person', width: '44px', visible: true, resizable: true },
  { id: 'function_roles', label: 'Function', width: '120px', visible: false, resizable: true },
];

function loadSavedViews(): SavedView[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem('fq_task_views') || '[]'); } catch { return []; }
}
function saveSavedViews(views: SavedView[]) {
  localStorage.setItem('fq_task_views', JSON.stringify(views));
}
function loadColumns(): ColumnConfig[] {
  if (typeof window === 'undefined') return DEFAULT_COLUMNS;
  try {
    const saved = localStorage.getItem('fq_task_columns');
    if (!saved) return DEFAULT_COLUMNS;
    const parsed = JSON.parse(saved) as ColumnConfig[];
    // Merge with defaults in case new columns were added
    const ids = new Set(parsed.map(c => c.id));
    const merged = [...parsed];
    DEFAULT_COLUMNS.forEach(dc => { if (!ids.has(dc.id)) merged.push(dc); });
    return merged;
  } catch { return DEFAULT_COLUMNS; }
}
function saveColumns(cols: ColumnConfig[]) {
  localStorage.setItem('fq_task_columns', JSON.stringify(cols));
}

/* ── Inline Cell Editor ── */
function InlineCell({ value, onSave, className = '', type = 'text', options, placeholder, displayValue }: {
  value: string;
  onSave: (v: string) => void;
  className?: string;
  type?: 'text' | 'date' | 'select';
  options?: { value: string; label: string }[];
  placeholder?: string;
  displayValue?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement | HTMLSelectElement>(null);
  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);

  if (!editing) {
    return (
      <span
        onClick={(e) => { e.stopPropagation(); setDraft(value); setEditing(true); }}
        className={`cursor-pointer select-none hover:ring-1 hover:ring-fq-accent/30 hover:rounded px-0.5 -mx-0.5 ${className}`}
      >
        {(displayValue || value) || <span className="text-fq-muted/30 italic text-[10px]">{placeholder || '—'}</span>}
      </span>
    );
  }

  const commit = () => { onSave(draft); setEditing(false); };
  const cancel = () => { setDraft(value); setEditing(false); };

  if (type === 'select' && options) {
    return (
      <select ref={ref as React.RefObject<HTMLSelectElement>} value={draft}
        onChange={(e) => { onSave(e.target.value); setEditing(false); }} onBlur={cancel}
        className="font-body text-[11px] bg-white border border-fq-accent/40 rounded px-1 py-0 outline-none w-full">
        <option value="">—</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  }

  return (
    <input ref={ref as React.RefObject<HTMLInputElement>} type={type} value={draft}
      onChange={(e) => setDraft(e.target.value)} onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel(); }}
      className="font-body text-[11px] bg-white border border-fq-accent/40 rounded px-1 py-0 outline-none w-full"
      placeholder={placeholder} />
  );
}

const FUNCTION_ROLES = ['Designer', 'Planner', 'Admin', 'Coordinator'] as const;

/* ── Function Roles Multiselect Cell ── */
function FunctionRolesCell({ value, onSave }: { value: string[]; onSave: (v: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);
  const toggle = (role: string) => {
    onSave(value.includes(role) ? value.filter(r => r !== role) : [...value, role]);
  };
  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      <div onClick={() => setOpen(v => !v)} className="cursor-pointer flex flex-wrap gap-0.5 min-h-[14px] hover:ring-1 hover:ring-fq-accent/30 hover:rounded px-0.5 -mx-0.5">
        {value.length > 0 ? value.map(r => (
          <span key={r} className="font-body text-[9px] font-medium bg-fq-light-accent text-fq-accent px-1 py-0 rounded-full">{r}</span>
        )) : <span className="text-fq-muted/30 italic text-[10px]">—</span>}
      </div>
      {open && (
        <div className="absolute left-0 top-full mt-0.5 z-50 bg-white border border-fq-border rounded-lg shadow-md p-1.5 min-w-[120px]">
          {FUNCTION_ROLES.map(role => (
            <label key={role} className="flex items-center gap-1.5 px-1.5 py-0.5 rounded hover:bg-fq-bg cursor-pointer">
              <input type="checkbox" checked={value.includes(role)} onChange={() => toggle(role)} className="w-3 h-3 accent-fq-accent" />
              <span className="font-body text-[11px] text-fq-dark">{role}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Column Settings Dropdown ── */
function ColumnSettings({ columns, onChange, savedViews, onSaveView, onLoadView, onDeleteView }: {
  columns: ColumnConfig[];
  onChange: (cols: ColumnConfig[]) => void;
  savedViews: SavedView[];
  onSaveView: (name: string) => void;
  onLoadView: (view: SavedView) => void;
  onDeleteView: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const toggleCol = (id: ColumnId) => {
    if (id === 'checkbox' || id === 'task') return;
    onChange(columns.map(c => c.id === id ? { ...c, visible: !c.visible } : c));
  };

  const setWidth = (id: ColumnId, w: string) => {
    onChange(columns.map(c => c.id === id ? { ...c, width: w } : c));
  };

  const handleDragStart = (idx: number) => { setDragIdx(idx); };
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    const reordered = [...columns];
    const [moved] = reordered.splice(dragIdx, 1);
    reordered.splice(idx, 0, moved);
    onChange(reordered);
    setDragIdx(idx);
  };

  const widthOptions = ['60px', '80px', '100px', '120px', '140px', '160px', '200px'];

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)}
        className="font-body text-[11px] text-fq-muted/60 hover:text-fq-dark bg-fq-bg border border-fq-border px-2 py-1 rounded-lg transition-colors flex items-center gap-1">
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 2h4M4 6h8M2 10h12M4 14h8"/></svg>
        Columns
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-fq-border rounded-xl shadow-lg w-[260px] py-2">
          <div className="px-3 py-1 mb-1">
            <p className="font-body text-[11px] font-semibold text-fq-dark/80 uppercase tracking-wide">Columns</p>
          </div>
          {columns.filter(c => c.id !== 'checkbox').map((col, idx) => (
            <div key={col.id}
              draggable={col.id !== 'task'}
              onDragStart={() => handleDragStart(idx + 1)}
              onDragOver={(e) => handleDragOver(e, idx + 1)}
              className="flex items-center gap-2 px-3 py-1 hover:bg-fq-bg/50 cursor-grab text-[12px] font-body">
              <span className="text-fq-muted/30 text-[10px]">⋮⋮</span>
              <label className="flex items-center gap-2 flex-1 cursor-pointer">
                <input type="checkbox" checked={col.visible} onChange={() => toggleCol(col.id)}
                  disabled={col.id === 'task'}
                  className="rounded border-fq-border text-fq-accent w-3 h-3" />
                <span className="text-fq-dark/80">{col.label || 'Task'}</span>
              </label>
              {col.resizable && (
                <select value={col.width} onChange={(e) => setWidth(col.id, e.target.value)}
                  className="text-[10px] text-fq-muted/60 bg-transparent border-none outline-none cursor-pointer">
                  {widthOptions.map(w => <option key={w} value={w}>{w}</option>)}
                </select>
              )}
            </div>
          ))}
          <div className="border-t border-fq-border mt-2 pt-2 px-3">
            <p className="font-body text-[10px] font-semibold text-fq-dark/70 uppercase tracking-wide mb-1">Saved Views</p>
            {savedViews.map(v => (
              <div key={v.name} className="flex items-center justify-between py-0.5 group/view">
                <button onClick={() => { onLoadView(v); setOpen(false); }} className="font-body text-[11px] text-fq-accent hover:text-fq-dark">{v.name}</button>
                <button onClick={() => onDeleteView(v.name)} className="text-fq-muted/30 hover:text-fq-alert text-[10px] opacity-0 group-hover/view:opacity-100">✕</button>
              </div>
            ))}
            <div className="flex items-center gap-1 mt-1">
              <input value={saveName} onChange={(e) => setSaveName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && saveName.trim()) { onSaveView(saveName.trim()); setSaveName(''); } }}
                placeholder="View name..."
                className="flex-1 font-body text-[10px] bg-fq-bg border border-fq-border rounded px-1.5 py-0.5 outline-none" />
              <button onClick={() => { if (saveName.trim()) { onSaveView(saveName.trim()); setSaveName(''); } }}
                className="font-body text-[10px] text-fq-accent hover:text-fq-dark">Save</button>
            </div>
          </div>
          <div className="border-t border-fq-border mt-2 pt-2 px-3">
            <button onClick={() => { onChange(DEFAULT_COLUMNS); setOpen(false); }}
              className="font-body text-[10px] text-fq-muted/60 hover:text-fq-dark">Reset to default</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Task Detail Panel ── */
function TaskDetailPanel({ task, onClose, onUpdate, categories }: {
  task: TaskWithProject;
  onClose: () => void;
  onUpdate: (updated: TaskWithProject) => void;
  categories: string[];
}) {
  const t = { heading: 'text-fq-dark/90', body: 'text-fq-muted/90', light: 'text-fq-muted/70' };
  const [notes, setNotes] = useState(task.notes || '');
  const [newSubtask, setNewSubtask] = useState('');

  useEffect(() => { setNotes(task.notes || ''); }, [task.id, task.notes]);

  const update = (patch: Partial<Task>) => onUpdate({ ...task, ...patch });

  const statusColors: Record<string, string> = {
    in_progress: 'bg-[#F5C242] text-white',
    delayed: 'bg-[#E8746A] text-white',
    completed: 'bg-[#4CAF6A] text-white',
  };
  const statusLabels: Record<string, string> = {
    in_progress: 'In Progress', delayed: 'Delayed', completed: 'Completed',
  };
  const taskStatus = task.status || '';

  const addSubtask = () => {
    if (!newSubtask.trim()) return;
    const st: SubTask = { id: `st-${Date.now()}`, text: newSubtask.trim(), completed: false };
    update({ subtasks: [...(task.subtasks || []), st] });
    setNewSubtask('');
  };
  const toggleSubtask = (stId: string) => {
    update({ subtasks: (task.subtasks || []).map(s => s.id === stId ? { ...s, completed: !s.completed } : s) });
  };
  const removeSubtask = (stId: string) => {
    update({ subtasks: (task.subtasks || []).filter(s => s.id !== stId) });
  };
  const saveNotes = () => update({ notes });
  const subtasks = task.subtasks || [];
  const stDone = subtasks.filter(s => s.completed).length;

  return (
    <div className="w-[340px] border-l border-fq-border bg-white p-4 overflow-y-auto flex flex-col gap-4 shrink-0 sticky top-0 max-h-screen">
      <div className="flex items-start justify-between gap-2">
        <InlineCell value={task.text} onSave={(v) => update({ text: v })}
          className={`font-body text-[14px] font-medium flex-1 ${taskStatus === 'completed' ? 'text-fq-muted/50 line-through' : t.heading}`}
          placeholder="Task name..." />
        <button onClick={onClose} className="text-fq-muted/40 hover:text-fq-dark text-[14px] shrink-0 mt-0.5">✕</button>
      </div>

      <div className="grid grid-cols-[80px_1fr] gap-y-2 gap-x-2 items-center">
        <span className={`font-body text-[10px] ${t.light} uppercase tracking-wide`}>Project</span>
        <span className="font-body text-[11px] text-fq-accent font-medium">{task.projectName}</span>

        <span className={`font-body text-[10px] ${t.light} uppercase tracking-wide`}>Status</span>
        <InlineCell value={taskStatus}
          onSave={(v) => update({ status: (v as Task['status']) || undefined, completed: v === 'completed' })}
          type="select" options={[{ value: '', label: '—' }, { value: 'in_progress', label: 'In Progress' }, { value: 'delayed', label: 'Delayed' }, { value: 'completed', label: 'Completed' }]}
          displayValue={statusLabels[taskStatus] || '—'}
          className={`font-body text-[10px] ${statusColors[taskStatus] || `${t.light} bg-fq-bg`} px-2 py-0.5 rounded-full inline-block`} />

        <span className={`font-body text-[10px] ${t.light} uppercase tracking-wide`}>Category</span>
        <InlineCell value={task.category || ''} onSave={(v) => update({ category: v || undefined })}
          type="select" options={categories.map(c => ({ value: c, label: c }))}
          className={`font-body text-[11px] ${t.body}`} placeholder="Select..." />

        <span className={`font-body text-[10px] ${t.light} uppercase tracking-wide`}>Due Date</span>
        <InlineCell value={task.due_date || ''} onSave={(v) => update({ due_date: v || undefined })}
          type="date" displayValue={task.due_date ? formatDate(task.due_date) : ''}
          className={`font-body text-[11px] ${t.body}`} placeholder="Set date..." />

        <span className={`font-body text-[10px] ${t.light} uppercase tracking-wide`}>Priority</span>
        <InlineCell value={task.priority || ''}
          onSave={(v) => update({ priority: (v as Task['priority']) || undefined })}
          type="select" options={[{ value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }]}
          className={`font-body text-[11px] ${t.body}`} placeholder="Set priority..." />

        <span className={`font-body text-[10px] ${t.light} uppercase tracking-wide`}>Assigned</span>
        <InlineCell value={task.assigned_to || ''}
          onSave={(v) => update({ assigned_to: v || undefined })}
          type="select" options={allAssignedTo.map(id => { const m = getTeamMember(id); return { value: id, label: m?.name || id }; })}
          displayValue={task.assigned_to ? (getTeamMember(task.assigned_to)?.name || task.assigned_to) : ''}
          className={`font-body text-[11px] ${t.body}`} placeholder="Assign..." />

        <span className={`font-body text-[10px] ${t.light} uppercase tracking-wide`}>Function</span>
        <div className="flex flex-wrap gap-1">
          {FUNCTION_ROLES.map(role => (
            <button key={role} onClick={() => {
              const current = task.function_roles || [];
              update({ function_roles: current.includes(role) ? current.filter(r => r !== role) : [...current, role] });
            }} className={`font-body text-[10px] px-1.5 py-0.5 rounded-full transition-colors ${(task.function_roles || []).includes(role) ? 'bg-fq-accent text-white' : 'bg-fq-light-accent text-fq-accent hover:bg-fq-border'}`}>
              {role}
            </button>
          ))}
        </div>
      </div>

      {/* Subtasks */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className={`font-body text-[11px] font-semibold ${t.heading}`}>
            Subtasks {subtasks.length > 0 && <span className={`font-normal ${t.light}`}>{stDone}/{subtasks.length}</span>}
          </span>
        </div>
        {subtasks.length > 0 && (
          <div className="mb-1.5 space-y-0.5">
            {subtasks.map(st => (
              <div key={st.id} className="flex items-center gap-1.5 group/st py-0.5 px-1 rounded hover:bg-fq-bg/50">
                <button onClick={() => toggleSubtask(st.id)}
                  className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors ${st.completed ? 'bg-fq-accent border-fq-accent text-white' : 'border-fq-border hover:border-fq-accent'}`}>
                  {st.completed && <svg width="7" height="7" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 5l2.5 2.5L8 3" /></svg>}
                </button>
                <span className={`font-body text-[11px] flex-1 ${st.completed ? 'text-fq-muted/50 line-through' : t.body}`}>{st.text}</span>
                <button onClick={() => removeSubtask(st.id)} className="text-fq-muted/30 hover:text-fq-alert text-[10px] opacity-0 group-hover/st:opacity-100 transition-opacity">✕</button>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <input value={newSubtask} onChange={(e) => setNewSubtask(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addSubtask(); }}
            placeholder="Add subtask..."
            className={`flex-1 font-body text-[11px] ${t.body} bg-fq-bg border border-fq-border rounded-lg px-2 py-1 outline-none focus:border-fq-accent/40 placeholder:text-fq-muted/40`} />
          <button onClick={addSubtask} disabled={!newSubtask.trim()} className="font-body text-[10px] text-fq-accent hover:text-fq-dark disabled:opacity-30 transition-colors">+ Add</button>
        </div>
      </div>

      {/* Notes */}
      <div>
        <span className={`font-body text-[11px] font-semibold ${t.heading} block mb-1.5`}>Notes</span>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={saveNotes}
          placeholder="Add notes..." rows={3}
          className={`w-full font-body text-[11px] ${t.body} bg-fq-bg border border-fq-border rounded-lg px-2.5 py-1.5 outline-none focus:border-fq-accent/40 resize-none placeholder:text-fq-muted/40`} />
      </div>
    </div>
  );
}

/* ═══════════════ Main Tasks Page ═══════════════ */
export default function TasksPage() {
  const { projects, team, getTeamMember: teamLookup, loading } = useFullProjects();

  // Update module-level lookups so sub-components can use them
  getTeamMember = teamLookup;

  // Compute all tasks from projects
  const allTasksFromProjects = useMemo(() => {
    const all: TaskWithProject[] = [];
    projects.forEach(p => {
      (p.tasks || []).forEach(tk => {
        all.push({ ...tk, projectId: p.id, projectName: p.name });
      });
    });
    return all;
  }, [projects]);

  const computedAssignedTo = useMemo(() => Array.from(new Set(projects.flatMap(p => p.assigned_to))), [projects]);
  allAssignedTo = computedAssignedTo;

  // Compute preset tabs
  const presetTabsMemo = useMemo(() => {
    const clientProjects = projects.filter(p => p.type === 'client' && p.status === 'active');
    const tabs: { id: string; label: string; filter: (tk: TaskWithProject) => boolean }[] = [
      { id: 'all-open', label: 'All Open', filter: (tk) => (tk.status || '') !== 'completed' },
    ];
    clientProjects.forEach(p => {
      tabs.push({ id: `project-${p.id}`, label: p.name, filter: (tk) => tk.projectId === p.id });
    });
    const allCategories = Array.from(new Set(allTasksFromProjects.map(tk => tk.category).filter(Boolean))) as string[];
    const categoryTabs = ['Entertainment', 'Florals & Decor', 'Stationery', 'Photography'].filter(c => allCategories.includes(c));
    categoryTabs.forEach(cat => {
      tabs.push({ id: `cat-${cat}`, label: cat, filter: (tk) => tk.category === cat });
    });
    // Function-based tabs
    tabs.push({ id: 'fn-designer', label: 'Design & Styling', filter: (tk) => !!(tk.function_roles?.includes('Designer')) });
    tabs.push({ id: 'fn-planner', label: 'Planning', filter: (tk) => !!(tk.function_roles?.includes('Planner')) });
    return tabs;
  }, [projects, allTasksFromProjects, team]);

  const [tasks, setTasks] = useState<TaskWithProject[]>([]);
  const [tasksInitialized, setTasksInitialized] = useState(false);
  const [activePreset, setActivePreset] = useState('all-open');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [teamFilter, setTeamFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [projectFilter, setProjectFilter] = useState('all');
  const [groupBy, setGroupBy] = useState<'category' | 'date' | 'project'>('date');
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const [kanbanGroupField, setKanbanGroupField] = useState<'category' | 'date' | 'assigned_to' | 'status' | 'project'>('category');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [expandedSubtasks, setExpandedSubtasks] = useState<Set<string>>(new Set());
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [addingSubtaskFor, setAddingSubtaskFor] = useState<string | null>(null);
  const [inlineSubtaskText, setInlineSubtaskText] = useState('');
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTaskText, setNewTaskText] = useState('');
  const [newTaskDue, setNewTaskDue] = useState('');
  const [newTaskCategory, setNewTaskCategory] = useState('');
  const [newTaskAssigned, setNewTaskAssigned] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState('');
  const [newTaskNotes, setNewTaskNotes] = useState('');
  const [newTaskStatus, setNewTaskStatus] = useState('in_progress');
  const [newTaskProject, setNewTaskProject] = useState('');

  // Column customization
  const [columns, setColumns] = useState<ColumnConfig[]>(DEFAULT_COLUMNS);
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [columnsLoaded, setColumnsLoaded] = useState(false);

  useEffect(() => {
    setColumns(loadColumns());
    setSavedViews(loadSavedViews());
    setColumnsLoaded(true);
  }, []);

  const handleColumnsChange = useCallback((cols: ColumnConfig[]) => {
    setColumns(cols);
    saveColumns(cols);
  }, []);

  const handleSaveView = useCallback((name: string) => {
    const views = [...savedViews.filter(v => v.name !== name), { name, columns }];
    setSavedViews(views);
    saveSavedViews(views);
  }, [savedViews, columns]);

  const handleLoadView = useCallback((view: SavedView) => {
    setColumns(view.columns);
    saveColumns(view.columns);
  }, []);

  const handleDeleteView = useCallback((name: string) => {
    const views = savedViews.filter(v => v.name !== name);
    setSavedViews(views);
    saveSavedViews(views);
  }, [savedViews]);

  // Initialize tasks from hook data
  useEffect(() => {
    if (!loading && allTasksFromProjects.length > 0 && !tasksInitialized) {
      setTasks(allTasksFromProjects);
      setNewTaskProject(projects[0]?.id || '');
      setTasksInitialized(true);
    }
  }, [loading, allTasksFromProjects, projects, tasksInitialized]);

  if (loading) {
    return (
      <div className="px-10 py-8">
        <p className="font-body text-[14px] text-fq-muted">Loading...</p>
      </div>
    );
  }

  const t = { heading: 'text-fq-dark/90', body: 'text-fq-muted/90', light: 'text-fq-muted/70', icon: 'text-fq-muted/60' };

  const statusColors: Record<string, string> = {
    in_progress: 'bg-[#F5C242] text-white',
    delayed: 'bg-[#E8746A] text-white',
    completed: 'bg-[#4CAF6A] text-white',
  };
  const statusLabels: Record<string, string> = {
    in_progress: 'In Progress', delayed: 'Delayed', completed: 'Completed',
  };

  const categoryColorPalette = [
    { text: 'text-fq-sage', bg: 'bg-fq-sage-light' },
    { text: 'text-fq-rose', bg: 'bg-fq-rose-light' },
    { text: 'text-fq-blue', bg: 'bg-fq-blue-light' },
    { text: 'text-fq-plum', bg: 'bg-fq-plum-light' },
    { text: 'text-fq-amber', bg: 'bg-fq-amber-light' },
    { text: 'text-fq-teal', bg: 'bg-fq-teal-light' },
    { text: 'text-fq-accent', bg: 'bg-fq-light-accent' },
    { text: 'text-fq-alert', bg: 'bg-fq-alert/10' },
  ];
  const categoryColorMap = new Map<string, typeof categoryColorPalette[0]>();
  const getCategoryColor = (cat: string) => {
    if (!categoryColorMap.has(cat)) {
      categoryColorMap.set(cat, categoryColorPalette[categoryColorMap.size % categoryColorPalette.length]);
    }
    return categoryColorMap.get(cat)!;
  };

  const presetTabs = presetTabsMemo;
  const activePresetTab = presetTabs.find(tab => tab.id === activePreset);

  const updateTask = (updated: TaskWithProject) => {
    setTasks(prev => prev.map(tk => tk.id === updated.id ? updated : tk));
    fetch('/api/tasks', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) });
  };

  const updateTaskField = (taskId: string, field: keyof Task, value: unknown) => {
    const dbValue = value === '' ? null : value;
    setTasks(prev => prev.map(tk => {
      if (tk.id !== taskId) return tk;
      const updated = { ...tk, [field]: dbValue };
      if (field === 'status') updated.completed = dbValue === 'completed';
      return updated;
    }));
    // Persist to database
    const updates: Record<string, unknown> = { [field]: dbValue };
    if (field === 'status') updates.completed = dbValue === 'completed';
    fetch('/api/tasks', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: taskId, ...updates }) });
  };

  const toggleTaskComplete = (taskId: string) => {
    const task = tasks.find(tk => tk.id === taskId);
    if (!task) return;
    const newStatus = task.status === 'completed' ? '' : 'completed';
    updateTaskField(taskId, 'status', newStatus);
  };

  const toggleSubtaskInline = (taskId: string, stId: string) => {
    setTasks(prev => prev.map(tk => tk.id === taskId ? { ...tk, subtasks: (tk.subtasks || []).map(s => s.id === stId ? { ...s, completed: !s.completed } : s) } : tk));
  };

  const addInlineSubtask = (taskId: string) => {
    if (!inlineSubtaskText.trim()) return;
    const st: SubTask = { id: `st-${Date.now()}`, text: inlineSubtaskText.trim(), completed: false };
    setTasks(prev => prev.map(tk => tk.id === taskId ? { ...tk, subtasks: [...(tk.subtasks || []), st] } : tk));
    setInlineSubtaskText('');
    setAddingSubtaskFor(null);
  };

  const addTask = async () => {
    if (!newTaskText.trim()) return;
    const proj = projects.find(p => p.id === newTaskProject);
    const taskData = {
      text: newTaskText.trim(),
      project_id: newTaskProject || undefined,
      completed: newTaskStatus === 'completed',
      status: (newTaskStatus as Task['status']) || undefined,
      due_date: newTaskDue || undefined,
      category: newTaskCategory || undefined,
      assigned_to: newTaskAssigned || undefined,
      priority: (newTaskPriority as Task['priority']) || undefined,
      notes: newTaskNotes || undefined,
    };
    const res = await fetch('/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(taskData) });
    const saved = await res.json();
    const newTask: TaskWithProject = { ...saved, subtasks: [], projectId: newTaskProject, projectName: proj?.name || '' };
    setTasks(prev => [...prev, newTask]);
    setNewTaskText(''); setNewTaskDue(''); setNewTaskCategory('');
    setNewTaskAssigned(''); setNewTaskPriority(''); setNewTaskNotes('');
    setNewTaskStatus('in_progress'); setShowAddTask(false);
  };

  const selectedTask = selectedTaskId ? tasks.find(tk => tk.id === selectedTaskId) : null;

  // Apply preset filter first
  let filtered = activePresetTab ? tasks.filter(activePresetTab.filter) : tasks;

  // Then apply additional filters
  if (search) filtered = filtered.filter(tk => tk.text.toLowerCase().includes(search.toLowerCase()));
  if (categoryFilter !== 'all') filtered = filtered.filter(tk => tk.category === categoryFilter);
  if (teamFilter !== 'all') filtered = filtered.filter(tk => tk.assigned_to === teamFilter);
  if (priorityFilter !== 'all') filtered = filtered.filter(tk => tk.priority === priorityFilter);
  if (statusFilter !== 'all') filtered = filtered.filter(tk => (tk.status || '') === statusFilter);
  if (projectFilter !== 'all') filtered = filtered.filter(tk => tk.projectId === projectFilter);

  const categories = Array.from(new Set(tasks.map(tk => tk.category).filter(Boolean))) as string[];
  const clientProjects = projects.filter(p => (p.type === 'client' || p.type === 'shoot') && p.status === 'active');

  // Sort helper for date groups
  const dateGroupSortKey = (key: string) => {
    if (key === 'No date') return '9999-99';
    const d = new Date(key + ' 1');
    return isNaN(d.getTime()) ? key : d.toISOString().slice(0, 7);
  };

  // Group tasks
  const grouped: Record<string, TaskWithProject[]> = {};
  if (groupBy === 'category') {
    filtered.forEach(tk => { const key = tk.category || 'Uncategorized'; if (!grouped[key]) grouped[key] = []; grouped[key].push(tk); });
  } else if (groupBy === 'project') {
    filtered.forEach(tk => { const key = tk.projectName || 'Unknown'; if (!grouped[key]) grouped[key] = []; grouped[key].push(tk); });
  } else {
    filtered.forEach(tk => { const key = tk.due_date ? formatMonthYear(tk.due_date) : 'No date'; if (!grouped[key]) grouped[key] = []; grouped[key].push(tk); });
  }

  const sortedGroupEntries = Object.entries(grouped);
  if (groupBy === 'date') {
    sortedGroupEntries.sort((a, b) => dateGroupSortKey(a[0]).localeCompare(dateGroupSortKey(b[0])));
    sortedGroupEntries.forEach(([, groupTasks]) => {
      groupTasks.sort((a, b) => {
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return a.due_date.localeCompare(b.due_date);
      });
    });
  }

  const hasActiveFilters = categoryFilter !== 'all' || teamFilter !== 'all' || priorityFilter !== 'all' || statusFilter !== 'all' || projectFilter !== 'all';
  const clearFilters = () => { setCategoryFilter('all'); setTeamFilter('all'); setPriorityFilter('all'); setStatusFilter('all'); setProjectFilter('all'); };

  // Build dynamic grid template from column config
  const visibleCols = columns.filter(c => c.visible);
  const gridTemplate = visibleCols.map(c => c.width).join(' ');

  const isColVisible = (id: ColumnId) => columns.find(c => c.id === id)?.visible ?? false;

  // Render a cell based on column type
  const renderCell = (col: ColumnConfig, task: TaskWithProject, taskStatus: string) => {
    const priorityColors: Record<string, string> = { high: 'text-fq-rose bg-fq-rose-light', medium: 'text-fq-amber bg-fq-amber-light', low: 'text-fq-sage bg-fq-sage-light' };
    const member = task.assigned_to ? getTeamMember(task.assigned_to) : null;
    const subtasks = task.subtasks || [];
    const stCount = subtasks.length;
    const stDone = subtasks.filter(s => s.completed).length;

    switch (col.id) {
      case 'checkbox':
        return (
          <div className="flex items-center gap-1">
            <button onClick={(e) => { e.stopPropagation(); toggleTaskComplete(task.id); }}
              className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors ${taskStatus === 'completed' ? 'bg-[#4CAF6A] border-[#4CAF6A] text-white' : 'border-fq-border hover:border-fq-accent'}`}>
              {taskStatus === 'completed' && <svg width="7" height="7" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 5l2.5 2.5L8 3" /></svg>}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setAddingSubtaskFor(task.id); setInlineSubtaskText(''); if (!expandedSubtasks.has(task.id)) setExpandedSubtasks(prev => { const n = new Set(prev); n.add(task.id); return n; }); }}
              className="text-[9px] text-fq-muted/40 hover:text-fq-accent opacity-0 group-hover/row:opacity-100 transition-opacity leading-none"
              title="Add subitem">+</button>
          </div>
        );
      case 'task':
        return (
          <div className="flex items-center gap-1 min-w-0">
            {stCount > 0 && (
              <button onClick={(e) => { e.stopPropagation(); setExpandedSubtasks(prev => { const n = new Set(prev); n.has(task.id) ? n.delete(task.id) : n.add(task.id); return n; }); }}
                className={`text-[9px] text-fq-muted/40 hover:text-fq-dark shrink-0 transition-transform ${expandedSubtasks.has(task.id) ? 'rotate-90' : ''}`}>
                ▶
              </button>
            )}
            <InlineCell value={task.text} onSave={(v) => updateTaskField(task.id, 'text', v)}
              className={`font-body text-[12px] truncate ${taskStatus === 'completed' ? 'text-fq-muted/50 line-through' : t.heading}`} />
            {stCount > 0 && <span className={`font-body text-[9px] ${t.light} shrink-0`}>{stDone}/{stCount}</span>}
          </div>
        );
      case 'notes':
        return (
          <span onClick={(e) => e.stopPropagation()}>
            <InlineCell value={task.notes || ''} onSave={(v) => updateTaskField(task.id, 'notes', v || undefined)}
              className={`font-body text-[10px] ${t.light} truncate block`}
              placeholder="—" />
          </span>
        );
      case 'category':
        return (
          <span className="truncate" onClick={(e) => e.stopPropagation()}>
            <InlineCell value={task.category || ''} onSave={(v) => updateTaskField(task.id, 'category', v || undefined)}
              type="select" options={categories.map(c => ({ value: c, label: c }))}
              className={`font-body text-[10px] ${task.category ? (() => { const cc = getCategoryColor(task.category!); return `${cc.text} ${cc.bg} px-1.5 py-0 rounded-full`; })() : t.light}`}
              placeholder="—" />
          </span>
        );
      case 'project':
        return <span className={`font-body text-[10px] ${t.light} truncate`}>{task.projectName}</span>;
      case 'status':
        return (
          <span onClick={(e) => e.stopPropagation()}>
            <InlineCell value={taskStatus} onSave={(v) => updateTaskField(task.id, 'status', v)}
              type="select" options={[{ value: '', label: '—' }, { value: 'in_progress', label: 'In Progress' }, { value: 'delayed', label: 'Delayed' }, { value: 'completed', label: 'Completed' }]}
              displayValue={statusLabels[taskStatus] || '—'}
              className={`font-body text-[10px] ${statusColors[taskStatus] || `${t.light} bg-fq-bg`} px-1.5 py-0 rounded-full inline-block`} />
          </span>
        );
      case 'priority':
        return (
          <span onClick={(e) => e.stopPropagation()}>
            <InlineCell value={task.priority || ''} onSave={(v) => updateTaskField(task.id, 'priority', v || undefined)}
              type="select" options={[{ value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }]}
              className={`font-body text-[10px] ${task.priority ? `${priorityColors[task.priority]} px-1.5 py-0 rounded-full` : t.light}`}
              placeholder="—" />
          </span>
        );
      case 'due_date':
        return (
          <span onClick={(e) => e.stopPropagation()}>
            <InlineCell value={task.due_date || ''} onSave={(v) => updateTaskField(task.id, 'due_date', v || undefined)}
              type="date" displayValue={task.due_date ? formatDate(task.due_date) : ''}
              className={`font-body text-[10px] ${t.light}`} placeholder="—" />
          </span>
        );
      case 'person':
        return (
          <span onClick={(e) => e.stopPropagation()}>
            <InlineCell value={task.assigned_to || ''} onSave={(v) => updateTaskField(task.id, 'assigned_to', v || undefined)}
              type="select" options={team.map(m => ({ value: m.id, label: m.initials }))}
              displayValue={member?.initials || ''}
              className={`font-body text-[9px] ${member ? 'font-semibold text-fq-accent' : t.light}`} placeholder="—" />
          </span>
        );
      case 'function_roles':
        return (
          <FunctionRolesCell
            value={task.function_roles || []}
            onSave={(v) => updateTaskField(task.id, 'function_roles', v.length ? v : undefined)}
          />
        );
      default: return null;
    }
  };

  // Render column header (with filter dropdowns)
  const renderHeader = (col: ColumnConfig) => {
    const filterClass = (active: boolean) => `font-body text-[10px] font-medium ${active ? 'text-fq-accent' : t.light} uppercase tracking-wide bg-transparent outline-none cursor-pointer w-full appearance-none`;
    switch (col.id) {
      case 'checkbox': return <span />;
      case 'task': return <span className={`font-body text-[10px] font-medium ${t.light} uppercase tracking-wide`}>Task</span>;
      case 'notes': return <span className={`font-body text-[10px] font-medium ${t.light} uppercase tracking-wide`}>Notes</span>;
      case 'category':
        return (
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className={filterClass(categoryFilter !== 'all')}>
            <option value="all">Category ▾</option>
            {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
          </select>
        );
      case 'project':
        return (
          <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} className={filterClass(projectFilter !== 'all')}>
            <option value="all">Project ▾</option>
            {clientProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        );
      case 'status':
        return (
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={filterClass(statusFilter !== 'all')}>
            <option value="all">Status ▾</option>
            <option value="in_progress">In Progress</option><option value="delayed">Delayed</option><option value="completed">Completed</option>
          </select>
        );
      case 'priority':
        return (
          <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className={filterClass(priorityFilter !== 'all')}>
            <option value="all">Priority ▾</option>
            <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
          </select>
        );
      case 'due_date': return <span className={`font-body text-[10px] font-medium ${t.light} uppercase tracking-wide`}>Due</span>;
      case 'function_roles': return <span className={`font-body text-[10px] font-medium ${t.light} uppercase tracking-wide`}>Function</span>;
      case 'person':
        return (
          <select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)} className={filterClass(teamFilter !== 'all')}>
            <option value="all">▾</option>
            {team.map(m => <option key={m.id} value={m.id}>{m.initials}</option>)}
          </select>
        );
      default: return null;
    }
  };

  return (
    <div className="px-10 py-6">
      {/* Page heading */}
      <h1 className="font-heading text-[24px] font-bold text-fq-dark/90 mb-4">Master Planning Checklist & Action</h1>

      {/* Preset filter tabs */}
      <div className="flex items-center gap-1 mb-4 border-b border-fq-border overflow-x-auto pb-0">
        {presetTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActivePreset(tab.id); clearFilters(); }}
            className={`font-body text-[12px] px-3 py-2 whitespace-nowrap transition-colors ${
              activePreset === tab.id
                ? 'text-fq-dark font-semibold border-b-2 border-fq-dark -mb-[1px]'
                : `${t.light} hover:text-fq-dark`
            }`}
          >
            {tab.id === 'all-open' && <span className="mr-1">✦</span>}
            {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-fq-card rounded-xl border border-fq-border shadow-sm p-4">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="relative">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-fq-muted/40 text-[11px]">🔍</span>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..."
                className={`pl-7 pr-3 py-1 font-body text-[11px] ${t.body} bg-fq-bg border border-fq-border rounded-lg outline-none focus:border-fq-accent/40 w-[180px]`} />
            </div>
            <span className={`font-body text-[11px] ${t.light}`}>{filtered.length} tasks</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setShowAddTask(true)}
              className="flex items-center gap-1 bg-fq-dark text-white font-body text-[11px] font-medium px-3 py-1 rounded-lg hover:bg-fq-dark/90 transition-colors">
              + Add
            </button>
            <div className="flex items-center gap-0.5 ml-1">
              <button onClick={() => setViewMode('list')}
                className={`font-body text-[10px] px-2 py-1 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-fq-dark text-white' : `${t.light} bg-fq-bg border border-fq-border hover:text-fq-dark`}`}>
                ☰ List
              </button>
              <button onClick={() => setViewMode('kanban')}
                className={`font-body text-[10px] px-2 py-1 rounded-lg transition-colors ${viewMode === 'kanban' ? 'bg-fq-dark text-white' : `${t.light} bg-fq-bg border border-fq-border hover:text-fq-dark`}`}>
                ▦ Board
              </button>
            </div>
            {viewMode === 'list' ? (
              <div className="flex items-center gap-0.5">
                {(['category', 'date', 'project'] as const).map(g => (
                  <button key={g} onClick={() => setGroupBy(g)}
                    className={`font-body text-[10px] px-2 py-1 rounded-lg transition-colors capitalize ${groupBy === g ? 'bg-fq-dark text-white' : `${t.light} bg-fq-bg border border-fq-border hover:text-fq-dark`}`}>
                    {g === 'category' ? '⊞ Cat' : g === 'date' ? '📅 Date' : '📁 Proj'}
                  </button>
                ))}
              </div>
            ) : (
              <select value={kanbanGroupField} onChange={(e) => setKanbanGroupField(e.target.value as typeof kanbanGroupField)}
                className={`font-body text-[10px] ${t.body} bg-fq-bg border border-fq-border rounded-lg px-1.5 py-1 outline-none cursor-pointer`}>
                <option value="category">Category</option><option value="date">Date</option>
                <option value="assigned_to">Team Member</option><option value="status">Status</option><option value="project">Project</option>
              </select>
            )}
            {viewMode === 'list' && columnsLoaded && (
              <ColumnSettings columns={columns} onChange={handleColumnsChange}
                savedViews={savedViews} onSaveView={handleSaveView} onLoadView={handleLoadView} onDeleteView={handleDeleteView} />
            )}
          </div>
        </div>

        {/* Add Task Form */}
        {showAddTask && (
          <div className="mb-4 border border-fq-accent/30 rounded-xl p-3 bg-fq-bg/30">
            <div className="flex items-center justify-between mb-2">
              <h4 className={`font-body text-[13px] font-semibold ${t.heading}`}>New Task</h4>
              <button onClick={() => setShowAddTask(false)} className={`font-body text-[11px] ${t.light} hover:text-fq-dark`}>Cancel</button>
            </div>
            <div className="space-y-2">
              <div className="grid grid-cols-[1fr_200px] gap-2">
                <div>
                  <label className={`font-body text-[10px] ${t.light} block mb-0.5`}>Task</label>
                  <input value={newTaskText} onChange={(e) => setNewTaskText(e.target.value)} placeholder="What needs to be done?"
                    className={`w-full font-body text-[12px] ${t.body} bg-white border border-fq-border rounded-lg px-2.5 py-1.5 outline-none focus:border-fq-accent/40`}
                    onKeyDown={(e) => { if (e.key === 'Enter') addTask(); }} autoFocus />
                </div>
                <div>
                  <label className={`font-body text-[10px] ${t.light} block mb-0.5`}>Project</label>
                  <select value={newTaskProject} onChange={(e) => setNewTaskProject(e.target.value)}
                    className={`w-full font-body text-[12px] ${t.body} bg-white border border-fq-border rounded-lg px-2.5 py-1.5 outline-none cursor-pointer`}>
                    {clientProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-5 gap-2">
                <div>
                  <label className={`font-body text-[10px] ${t.light} block mb-0.5`}>Due date</label>
                  <input type="date" value={newTaskDue} onChange={(e) => setNewTaskDue(e.target.value)}
                    className={`w-full font-body text-[12px] ${t.body} bg-white border border-fq-border rounded-lg px-2.5 py-1.5 outline-none`} />
                </div>
                <div>
                  <label className={`font-body text-[10px] ${t.light} block mb-0.5`}>Category</label>
                  <input value={newTaskCategory} onChange={(e) => setNewTaskCategory(e.target.value)} placeholder="Category..." list="task-categories-global"
                    className={`w-full font-body text-[12px] ${t.body} bg-white border border-fq-border rounded-lg px-2.5 py-1.5 outline-none`} />
                  <datalist id="task-categories-global">{categories.map(cat => <option key={cat} value={cat} />)}</datalist>
                </div>
                <div>
                  <label className={`font-body text-[10px] ${t.light} block mb-0.5`}>Assigned to</label>
                  <select value={newTaskAssigned} onChange={(e) => setNewTaskAssigned(e.target.value)}
                    className={`w-full font-body text-[12px] ${t.body} bg-white border border-fq-border rounded-lg px-2.5 py-1.5 outline-none cursor-pointer`}>
                    <option value="">Unassigned</option>
                    {team.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={`font-body text-[10px] ${t.light} block mb-0.5`}>Priority</label>
                  <select value={newTaskPriority} onChange={(e) => setNewTaskPriority(e.target.value)}
                    className={`w-full font-body text-[12px] ${t.body} bg-white border border-fq-border rounded-lg px-2.5 py-1.5 outline-none cursor-pointer`}>
                    <option value="">None</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
                  </select>
                </div>
                <div>
                  <label className={`font-body text-[10px] ${t.light} block mb-0.5`}>Status</label>
                  <select value={newTaskStatus} onChange={(e) => setNewTaskStatus(e.target.value)}
                    className={`w-full font-body text-[12px] ${t.body} bg-white border border-fq-border rounded-lg px-2.5 py-1.5 outline-none cursor-pointer`}>
                    <option value="in_progress">In Progress</option><option value="delayed">Delayed</option><option value="completed">Completed</option>
                  </select>
                </div>
              </div>
              <div>
                <label className={`font-body text-[10px] ${t.light} block mb-0.5`}>Notes</label>
                <textarea value={newTaskNotes} onChange={(e) => setNewTaskNotes(e.target.value)} placeholder="Optional notes..." rows={2}
                  className={`w-full font-body text-[12px] ${t.body} bg-white border border-fq-border rounded-lg px-2.5 py-1.5 outline-none focus:border-fq-accent/40 resize-none placeholder:text-fq-muted/40`} />
              </div>
              <div className="flex justify-end">
                <button onClick={addTask} disabled={!newTaskText.trim()}
                  className="bg-fq-dark text-white font-body text-[12px] font-medium px-4 py-1.5 rounded-lg hover:bg-fq-dark/90 transition-colors disabled:opacity-40">
                  Add Task
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main content */}
        <div className="flex gap-0">
          <div className="flex-1 min-w-0">
        {filtered.length === 0 ? (
          <p className={`font-body text-[12px] ${t.light} text-center py-6`}>
            {search ? 'No tasks match your search.' : 'No tasks found.'}
          </p>
        ) : viewMode === 'list' ? (
          <div>
            {/* Column headers with inline filters */}
            <div className="grid gap-1.5 px-2 pb-1.5 border-b border-fq-border mb-0.5"
              style={{ gridTemplateColumns: gridTemplate }}>
              {visibleCols.map(col => (
                <div key={col.id}>{renderHeader(col)}</div>
              ))}
            </div>

            {hasActiveFilters && (
              <div className="flex items-center gap-2 px-2 py-1">
                <span className={`font-body text-[10px] ${t.light}`}>Filtered</span>
                <button onClick={clearFilters} className="font-body text-[10px] text-fq-accent hover:text-fq-dark transition-colors">Clear all</button>
              </div>
            )}

            <div className="space-y-3 mt-1">
              {sortedGroupEntries.map(([group, groupTasks]) => {
                const groupDone = groupTasks.filter(tk => (tk.status || '') === 'completed').length;
                return (
                  <div key={group}>
                    <button
                      onClick={() => setCollapsedGroups(prev => { const n = new Set(prev); n.has(group) ? n.delete(group) : n.add(group); return n; })}
                      className="flex items-center gap-1.5 mb-0.5 px-2 w-full text-left">
                      <span className={`text-[9px] ${t.light} transition-transform ${collapsedGroups.has(group) ? '' : 'rotate-90'}`}>▶</span>
                      {(() => {
                        const gc = groupBy === 'category' ? getCategoryColor(group) : { text: 'text-fq-accent', bg: 'bg-fq-light-accent' };
                        return (<span className={`font-body text-[11px] font-medium ${gc.text} ${gc.bg} px-2 py-0 rounded-full`}>{group}</span>);
                      })()}
                      <span className={`font-body text-[10px] ${t.light}`}>{groupDone}/{groupTasks.length}</span>
                    </button>
                    {!collapsedGroups.has(group) && <div>
                      {groupTasks.map((task) => {
                        const subtasks = task.subtasks || [];
                        const taskStatus = task.status || '';
                        const isExpanded = expandedSubtasks.has(task.id);
                        return (
                          <div key={task.id} className="group/row">
                          <div onDoubleClick={() => setSelectedTaskId(task.id)}
                            className={`grid gap-1.5 items-center py-[3px] px-2 rounded hover:bg-fq-bg/50 transition-colors border-b border-fq-border/30 cursor-pointer ${
                              selectedTaskId === task.id ? 'bg-fq-blue-light/50 border-l-2 border-l-fq-blue' : ''
                            }`}
                            style={{ gridTemplateColumns: gridTemplate }}>
                            {visibleCols.map(col => (
                              <div key={col.id} className="min-w-0">{renderCell(col, task, taskStatus)}</div>
                            ))}
                          </div>

                          {isExpanded && subtasks.length > 0 && (
                            <div className="ml-8 border-l-2 border-fq-border/30 pl-2 py-0.5">
                              {subtasks.map(st => (
                                <div key={st.id} className="flex items-center gap-1.5 py-0.5 group/st">
                                  <button onClick={() => toggleSubtaskInline(task.id, st.id)}
                                    className={`w-3 h-3 rounded border flex items-center justify-center shrink-0 transition-colors ${st.completed ? 'bg-fq-accent border-fq-accent text-white' : 'border-fq-border hover:border-fq-accent'}`}>
                                    {st.completed && <svg width="6" height="6" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 5l2.5 2.5L8 3" /></svg>}
                                  </button>
                                  <span className={`font-body text-[11px] ${st.completed ? 'text-fq-muted/50 line-through' : t.body}`}>{st.text}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {addingSubtaskFor === task.id && (
                            <div className="flex items-center gap-1.5 ml-8 py-0.5 px-2">
                              <input value={inlineSubtaskText} onChange={(e) => setInlineSubtaskText(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') addInlineSubtask(task.id); if (e.key === 'Escape') { setAddingSubtaskFor(null); setInlineSubtaskText(''); } }}
                                placeholder="Subtask name..." autoFocus
                                className={`flex-1 font-body text-[11px] ${t.body} bg-white border border-fq-border rounded px-1.5 py-0.5 outline-none focus:border-fq-accent/40`} />
                              <button onClick={() => addInlineSubtask(task.id)} className="font-body text-[10px] text-fq-accent hover:text-fq-dark">Add</button>
                              <button onClick={() => { setAddingSubtaskFor(null); setInlineSubtaskText(''); }} className={`font-body text-[10px] ${t.light}`}>Cancel</button>
                            </div>
                          )}
                          {addingSubtaskFor !== task.id && (
                            <button onClick={(e) => { e.stopPropagation(); setAddingSubtaskFor(task.id); setInlineSubtaskText(''); }}
                              className={`font-body text-[9px] ${t.light} hover:text-fq-accent ml-8 px-2 py-0 opacity-0 group-hover/row:opacity-100 transition-opacity`}>
                              + subtask
                            </button>
                          )}
                          </div>
                        );
                      })}
                    </div>}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* ── Kanban View ── */
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-2 px-2">
            {Object.entries((() => {
              const kg: Record<string, TaskWithProject[]> = {};
              if (kanbanGroupField === 'category') {
                filtered.forEach(tk => { const k = tk.category || 'Uncategorized'; if (!kg[k]) kg[k] = []; kg[k].push(tk); });
              } else if (kanbanGroupField === 'date') {
                filtered.forEach(tk => { const k = tk.due_date ? formatMonthYear(tk.due_date) : 'No date'; if (!kg[k]) kg[k] = []; kg[k].push(tk); });
              } else if (kanbanGroupField === 'assigned_to') {
                filtered.forEach(tk => { const m = tk.assigned_to ? getTeamMember(tk.assigned_to) : null; const k = m ? m.name : 'Unassigned'; if (!kg[k]) kg[k] = []; kg[k].push(tk); });
              } else if (kanbanGroupField === 'project') {
                filtered.forEach(tk => { const k = tk.projectName; if (!kg[k]) kg[k] = []; kg[k].push(tk); });
              } else {
                filtered.forEach(tk => { const k = statusLabels[tk.status || ''] || 'No Status'; if (!kg[k]) kg[k] = []; kg[k].push(tk); });
              }
              return kg;
            })()).map(([column, columnTasks]) => {
              const colDone = columnTasks.filter(tk => (tk.status || '') === 'completed').length;
              return (
                <div key={column} className="flex-shrink-0 w-[240px]">
                  <div className="flex items-center justify-between mb-2 px-1">
                    <div className="flex items-center gap-1.5">
                      {(() => {
                        const gc = kanbanGroupField === 'category' ? getCategoryColor(column) : { text: 'text-fq-accent', bg: 'bg-fq-light-accent' };
                        return (<span className={`font-body text-[11px] font-medium ${gc.text} ${gc.bg} px-2 py-0 rounded-full`}>{column}</span>);
                      })()}
                      <span className={`font-body text-[10px] ${t.light}`}>{columnTasks.length}</span>
                    </div>
                    <span className={`font-body text-[9px] ${t.light}`}>{colDone}/{columnTasks.length}</span>
                  </div>
                  <div className="space-y-1.5">
                    {columnTasks.map(task => {
                      const member = task.assigned_to ? getTeamMember(task.assigned_to) : null;
                      const ts = task.status || '';
                      return (
                        <div key={task.id} onDoubleClick={() => setSelectedTaskId(task.id)}
                          className={`bg-white border rounded-lg p-2 shadow-sm hover:shadow-md transition-shadow cursor-pointer border-fq-border ${selectedTaskId === task.id ? 'ring-1 ring-fq-blue' : ''}`}>
                          <div className="flex items-start gap-1.5">
                            <button onClick={(e) => { e.stopPropagation(); toggleTaskComplete(task.id); }}
                              className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${ts === 'completed' ? 'bg-[#4CAF6A] border-[#4CAF6A] text-white' : 'border-fq-border hover:border-fq-accent'}`}>
                              {ts === 'completed' && <svg width="7" height="7" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 5l2.5 2.5L8 3" /></svg>}
                            </button>
                            <span className={`font-body text-[11px] leading-snug ${ts === 'completed' ? 'text-fq-muted/50 line-through' : t.heading}`}>{task.text}</span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                            {ts && <span className={`font-body text-[9px] ${statusColors[ts]} px-1 py-0 rounded`}>{statusLabels[ts]}</span>}
                            <span className={`font-body text-[9px] ${t.light} bg-fq-bg px-1 py-0 rounded`}>{task.projectName}</span>
                            {task.due_date && <span className={`font-body text-[9px] ${t.light} bg-fq-bg px-1 py-0 rounded`}>{formatDate(task.due_date)}</span>}
                            {member && (
                              <div className="w-4 h-4 rounded-full bg-fq-light-accent flex items-center justify-center shrink-0 ml-auto" title={member.name}>
                                <span className="font-body text-[7px] font-semibold text-fq-accent">{member.initials}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
          </div>
          {selectedTask && (
            <TaskDetailPanel task={selectedTask} onClose={() => setSelectedTaskId(null)} onUpdate={updateTask} categories={categories} />
          )}
        </div>
      </div>
    </div>
  );
}
