'use client';
/* Master task view — aggregates tasks from all projects */
import { useState, useRef, useEffect, useMemo } from 'react';
import { useFullProjects } from '@/lib/hooks';
import { formatDate, formatMonthYear } from '@/data/seed';
import type { Task, SubTask, TeamMember } from '@/data/seed';

// Module-level variables — set by the main component after data loads
let getTeamMember: (id: string) => TeamMember | undefined = () => undefined;
let allAssignedTo: string[] = [];

/* ── Gather all tasks with project context ── */
type TaskWithProject = Task & { projectId: string; projectName: string };

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
        {(displayValue || value) || <span className="text-fq-muted/30 italic">{placeholder || '—'}</span>}
      </span>
    );
  }

  const commit = () => { onSave(draft); setEditing(false); };
  const cancel = () => { setDraft(value); setEditing(false); };

  if (type === 'select' && options) {
    return (
      <select ref={ref as React.RefObject<HTMLSelectElement>} value={draft}
        onChange={(e) => { onSave(e.target.value); setEditing(false); }} onBlur={cancel}
        className="font-body text-[12px] bg-white border border-fq-accent/40 rounded px-1 py-0.5 outline-none w-full">
        <option value="">—</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  }

  return (
    <input ref={ref as React.RefObject<HTMLInputElement>} type={type} value={draft}
      onChange={(e) => setDraft(e.target.value)} onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel(); }}
      className="font-body text-[12px] bg-white border border-fq-accent/40 rounded px-1 py-0.5 outline-none w-full"
      placeholder={placeholder} />
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
    <div className="w-[380px] border-l border-fq-border bg-white p-5 overflow-y-auto flex flex-col gap-5 shrink-0">
      <div className="flex items-start justify-between gap-2">
        <InlineCell value={task.text} onSave={(v) => update({ text: v })}
          className={`font-body text-[15px] font-medium flex-1 ${taskStatus === 'completed' ? 'text-fq-muted/50 line-through' : t.heading}`}
          placeholder="Task name..." />
        <button onClick={onClose} className="text-fq-muted/40 hover:text-fq-dark text-[16px] shrink-0 mt-0.5">✕</button>
      </div>

      <div className="grid grid-cols-[90px_1fr] gap-y-3 gap-x-2 items-center">
        <span className={`font-body text-[11px] ${t.light} uppercase tracking-wide`}>Project</span>
        <span className="font-body text-[12px] text-fq-accent font-medium">{task.projectName}</span>

        <span className={`font-body text-[11px] ${t.light} uppercase tracking-wide`}>Status</span>
        <InlineCell value={taskStatus}
          onSave={(v) => update({ status: (v as Task['status']) || undefined, completed: v === 'completed' })}
          type="select" options={[{ value: '', label: '—' }, { value: 'in_progress', label: 'In Progress' }, { value: 'delayed', label: 'Delayed' }, { value: 'completed', label: 'Completed' }]}
          displayValue={statusLabels[taskStatus] || '—'}
          className={`font-body text-[11px] ${statusColors[taskStatus] || `${t.light} bg-fq-bg`} px-2.5 py-0.5 rounded-full inline-block`} />

        <span className={`font-body text-[11px] ${t.light} uppercase tracking-wide`}>Category</span>
        <InlineCell value={task.category || ''} onSave={(v) => update({ category: v || undefined })}
          type="select" options={categories.map(c => ({ value: c, label: c }))}
          className={`font-body text-[12px] ${t.body}`} placeholder="Select..." />

        <span className={`font-body text-[11px] ${t.light} uppercase tracking-wide`}>Due Date</span>
        <InlineCell value={task.due_date || ''} onSave={(v) => update({ due_date: v || undefined })}
          type="date" displayValue={task.due_date ? formatDate(task.due_date) : ''}
          className={`font-body text-[12px] ${t.body}`} placeholder="Set date..." />

        <span className={`font-body text-[11px] ${t.light} uppercase tracking-wide`}>Priority</span>
        <InlineCell value={task.priority || ''}
          onSave={(v) => update({ priority: (v as Task['priority']) || undefined })}
          type="select" options={[{ value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }]}
          className={`font-body text-[12px] ${t.body}`} placeholder="Set priority..." />

        <span className={`font-body text-[11px] ${t.light} uppercase tracking-wide`}>Assigned</span>
        <InlineCell value={task.assigned_to || ''}
          onSave={(v) => update({ assigned_to: v || undefined })}
          type="select" options={allAssignedTo.map(id => { const m = getTeamMember(id); return { value: id, label: m?.name || id }; })}
          displayValue={task.assigned_to ? (getTeamMember(task.assigned_to)?.name || task.assigned_to) : ''}
          className={`font-body text-[12px] ${t.body}`} placeholder="Assign..." />
      </div>

      {/* Subtasks */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className={`font-body text-[12px] font-semibold ${t.heading}`}>
            Subtasks {subtasks.length > 0 && <span className={`font-normal ${t.light}`}>{stDone}/{subtasks.length}</span>}
          </span>
        </div>
        {subtasks.length > 0 && (
          <div className="mb-2 space-y-1">
            {subtasks.map(st => (
              <div key={st.id} className="flex items-center gap-2 group/st py-1 px-1 rounded hover:bg-fq-bg/50">
                <button onClick={() => toggleSubtask(st.id)}
                  className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${st.completed ? 'bg-fq-accent border-fq-accent text-white' : 'border-fq-border hover:border-fq-accent'}`}>
                  {st.completed && <svg width="8" height="8" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 5l2.5 2.5L8 3" /></svg>}
                </button>
                <span className={`font-body text-[12px] flex-1 ${st.completed ? 'text-fq-muted/50 line-through' : t.body}`}>{st.text}</span>
                <button onClick={() => removeSubtask(st.id)} className="text-fq-muted/30 hover:text-fq-alert text-[10px] opacity-0 group-hover/st:opacity-100 transition-opacity">✕</button>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <input value={newSubtask} onChange={(e) => setNewSubtask(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addSubtask(); }}
            placeholder="Add subtask..."
            className={`flex-1 font-body text-[12px] ${t.body} bg-fq-bg border border-fq-border rounded-lg px-2.5 py-1.5 outline-none focus:border-fq-accent/40 placeholder:text-fq-muted/40`} />
          <button onClick={addSubtask} disabled={!newSubtask.trim()} className="font-body text-[11px] text-fq-accent hover:text-fq-dark disabled:opacity-30 transition-colors">+ Add</button>
        </div>
      </div>

      {/* Notes */}
      <div>
        <span className={`font-body text-[12px] font-semibold ${t.heading} block mb-2`}>Notes</span>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={saveNotes}
          placeholder="Add notes..." rows={4}
          className={`w-full font-body text-[12px] ${t.body} bg-fq-bg border border-fq-border rounded-lg px-3 py-2 outline-none focus:border-fq-accent/40 resize-none placeholder:text-fq-muted/40`} />
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
    const categoryTabs = ['Logistics', 'Entertainment', 'Florals & Decor', 'Stationery', 'Photography'].filter(c => allCategories.includes(c));
    categoryTabs.forEach(cat => {
      tabs.push({ id: `cat-${cat}`, label: cat, filter: (tk) => tk.category === cat });
    });
    return tabs;
  }, [projects, allTasksFromProjects]);

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

  const addTask = () => {
    if (!newTaskText.trim()) return;
    const proj = projects.find(p => p.id === newTaskProject);
    const newTask: TaskWithProject = {
      id: `task-${Date.now()}`,
      text: newTaskText.trim(),
      completed: newTaskStatus === 'completed',
      status: (newTaskStatus as Task['status']) || undefined,
      due_date: newTaskDue || undefined,
      category: newTaskCategory || undefined,
      assigned_to: newTaskAssigned || undefined,
      priority: (newTaskPriority as Task['priority']) || undefined,
      notes: newTaskNotes || undefined,
      subtasks: [],
      projectId: newTaskProject,
      projectName: proj?.name || '',
    };
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
  if (groupBy === 'date') sortedGroupEntries.sort((a, b) => dateGroupSortKey(a[0]).localeCompare(dateGroupSortKey(b[0])));

  const hasActiveFilters = categoryFilter !== 'all' || teamFilter !== 'all' || priorityFilter !== 'all' || statusFilter !== 'all' || projectFilter !== 'all';
  const clearFilters = () => { setCategoryFilter('all'); setTeamFilter('all'); setPriorityFilter('all'); setStatusFilter('all'); setProjectFilter('all'); };

  const gridCols = 'grid-cols-[24px_1fr_140px_120px_110px_90px_100px_50px]';

  return (
    <div className="px-10 py-8">
      {/* Page heading */}
      <h1 className="font-heading text-[28px] font-bold text-fq-dark/90 mb-6">Master Planning Checklist & Action</h1>

      {/* Preset filter tabs */}
      <div className="flex items-center gap-1 mb-6 border-b border-fq-border overflow-x-auto pb-0">
        {presetTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActivePreset(tab.id); clearFilters(); }}
            className={`font-body text-[13px] px-4 py-2.5 whitespace-nowrap transition-colors ${
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

      <div className="bg-fq-card rounded-xl border border-fq-border shadow-sm p-6">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fq-muted/40 text-[12px]">🔍</span>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..."
                className={`pl-8 pr-3 py-1.5 font-body text-[12px] ${t.body} bg-fq-bg border border-fq-border rounded-lg outline-none focus:border-fq-accent/40 w-[200px]`} />
            </div>
            <span className={`font-body text-[12px] ${t.light}`}>{filtered.length} tasks</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowAddTask(true)}
              className="flex items-center gap-1.5 bg-fq-dark text-white font-body text-[12px] font-medium px-3.5 py-1.5 rounded-lg hover:bg-fq-dark/90 transition-colors">
              + Add Task
            </button>
            <div className="flex items-center gap-1 ml-2">
              <button onClick={() => setViewMode('list')}
                className={`font-body text-[11px] px-2.5 py-1.5 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-fq-dark text-white' : `${t.light} bg-fq-bg border border-fq-border hover:text-fq-dark`}`}>
                ☰ List
              </button>
              <button onClick={() => setViewMode('kanban')}
                className={`font-body text-[11px] px-2.5 py-1.5 rounded-lg transition-colors ${viewMode === 'kanban' ? 'bg-fq-dark text-white' : `${t.light} bg-fq-bg border border-fq-border hover:text-fq-dark`}`}>
                ▦ Board
              </button>
            </div>
            {viewMode === 'list' ? (
              <div className="flex items-center gap-1">
                {(['category', 'date', 'project'] as const).map(g => (
                  <button key={g} onClick={() => setGroupBy(g)}
                    className={`font-body text-[11px] px-2.5 py-1.5 rounded-lg transition-colors capitalize ${groupBy === g ? 'bg-fq-dark text-white' : `${t.light} bg-fq-bg border border-fq-border hover:text-fq-dark`}`}>
                    {g === 'category' ? '⊞ Category' : g === 'date' ? '📅 Date' : '📁 Project'}
                  </button>
                ))}
              </div>
            ) : (
              <select value={kanbanGroupField} onChange={(e) => setKanbanGroupField(e.target.value as typeof kanbanGroupField)}
                className={`font-body text-[11px] ${t.body} bg-fq-bg border border-fq-border rounded-lg px-2 py-1.5 outline-none cursor-pointer`}>
                <option value="category">Category</option><option value="date">Date</option>
                <option value="assigned_to">Team Member</option><option value="status">Status</option><option value="project">Project</option>
              </select>
            )}
          </div>
        </div>

        {/* Add Task Form */}
        {showAddTask && (
          <div className="mb-5 border border-fq-accent/30 rounded-xl p-4 bg-fq-bg/30">
            <div className="flex items-center justify-between mb-3">
              <h4 className={`font-body text-[14px] font-semibold ${t.heading}`}>New Task</h4>
              <button onClick={() => setShowAddTask(false)} className={`font-body text-[12px] ${t.light} hover:text-fq-dark`}>Cancel</button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-[1fr_200px] gap-3">
                <div>
                  <label className={`font-body text-[11px] ${t.light} block mb-1`}>Task</label>
                  <input value={newTaskText} onChange={(e) => setNewTaskText(e.target.value)} placeholder="What needs to be done?"
                    className={`w-full font-body text-[13px] ${t.body} bg-white border border-fq-border rounded-lg px-3 py-2 outline-none focus:border-fq-accent/40`}
                    onKeyDown={(e) => { if (e.key === 'Enter') addTask(); }} autoFocus />
                </div>
                <div>
                  <label className={`font-body text-[11px] ${t.light} block mb-1`}>Project</label>
                  <select value={newTaskProject} onChange={(e) => setNewTaskProject(e.target.value)}
                    className={`w-full font-body text-[13px] ${t.body} bg-white border border-fq-border rounded-lg px-3 py-2 outline-none cursor-pointer`}>
                    {clientProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-5 gap-3">
                <div>
                  <label className={`font-body text-[11px] ${t.light} block mb-1`}>Due date</label>
                  <input type="date" value={newTaskDue} onChange={(e) => setNewTaskDue(e.target.value)}
                    className={`w-full font-body text-[13px] ${t.body} bg-white border border-fq-border rounded-lg px-3 py-2 outline-none`} />
                </div>
                <div>
                  <label className={`font-body text-[11px] ${t.light} block mb-1`}>Category</label>
                  <input value={newTaskCategory} onChange={(e) => setNewTaskCategory(e.target.value)} placeholder="Category..." list="task-categories-global"
                    className={`w-full font-body text-[13px] ${t.body} bg-white border border-fq-border rounded-lg px-3 py-2 outline-none`} />
                  <datalist id="task-categories-global">{categories.map(cat => <option key={cat} value={cat} />)}</datalist>
                </div>
                <div>
                  <label className={`font-body text-[11px] ${t.light} block mb-1`}>Assigned to</label>
                  <select value={newTaskAssigned} onChange={(e) => setNewTaskAssigned(e.target.value)}
                    className={`w-full font-body text-[13px] ${t.body} bg-white border border-fq-border rounded-lg px-3 py-2 outline-none cursor-pointer`}>
                    <option value="">Unassigned</option>
                    {team.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={`font-body text-[11px] ${t.light} block mb-1`}>Priority</label>
                  <select value={newTaskPriority} onChange={(e) => setNewTaskPriority(e.target.value)}
                    className={`w-full font-body text-[13px] ${t.body} bg-white border border-fq-border rounded-lg px-3 py-2 outline-none cursor-pointer`}>
                    <option value="">None</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
                  </select>
                </div>
                <div>
                  <label className={`font-body text-[11px] ${t.light} block mb-1`}>Status</label>
                  <select value={newTaskStatus} onChange={(e) => setNewTaskStatus(e.target.value)}
                    className={`w-full font-body text-[13px] ${t.body} bg-white border border-fq-border rounded-lg px-3 py-2 outline-none cursor-pointer`}>
                    <option value="in_progress">In Progress</option><option value="delayed">Delayed</option><option value="completed">Completed</option>
                  </select>
                </div>
              </div>
              <div>
                <label className={`font-body text-[11px] ${t.light} block mb-1`}>Notes</label>
                <textarea value={newTaskNotes} onChange={(e) => setNewTaskNotes(e.target.value)} placeholder="Optional notes..." rows={2}
                  className={`w-full font-body text-[13px] ${t.body} bg-white border border-fq-border rounded-lg px-3 py-2 outline-none focus:border-fq-accent/40 resize-none placeholder:text-fq-muted/40`} />
              </div>
              <div className="flex justify-end">
                <button onClick={addTask} disabled={!newTaskText.trim()}
                  className="bg-fq-dark text-white font-body text-[13px] font-medium px-5 py-2 rounded-lg hover:bg-fq-dark/90 transition-colors disabled:opacity-40">
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
          <p className={`font-body text-[13px] ${t.light} text-center py-8`}>
            {search ? 'No tasks match your search.' : 'No tasks found.'}
          </p>
        ) : viewMode === 'list' ? (
          <div>
            {/* Column headers with inline filters */}
            <div className={`grid ${gridCols} gap-2 px-3 pb-2 border-b border-fq-border mb-1`}>
              <span />
              <span className={`font-body text-[11px] font-medium ${t.light} uppercase tracking-wide`}>Task</span>
              <div>
                <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
                  className={`font-body text-[11px] font-medium ${categoryFilter !== 'all' ? 'text-fq-accent' : t.light} uppercase tracking-wide bg-transparent outline-none cursor-pointer w-full appearance-none`}>
                  <option value="all">Category ▾</option>
                  {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
              <div>
                <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}
                  className={`font-body text-[11px] font-medium ${projectFilter !== 'all' ? 'text-fq-accent' : t.light} uppercase tracking-wide bg-transparent outline-none cursor-pointer w-full appearance-none`}>
                  <option value="all">Project ▾</option>
                  {clientProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                  className={`font-body text-[11px] font-medium ${statusFilter !== 'all' ? 'text-fq-accent' : t.light} uppercase tracking-wide bg-transparent outline-none cursor-pointer w-full appearance-none`}>
                  <option value="all">Status ▾</option>
                  <option value="in_progress">In Progress</option><option value="delayed">Delayed</option><option value="completed">Completed</option>
                </select>
              </div>
              <div>
                <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}
                  className={`font-body text-[11px] font-medium ${priorityFilter !== 'all' ? 'text-fq-accent' : t.light} uppercase tracking-wide bg-transparent outline-none cursor-pointer w-full appearance-none`}>
                  <option value="all">Priority ▾</option>
                  <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
                </select>
              </div>
              <span className={`font-body text-[11px] font-medium ${t.light} uppercase tracking-wide`}>Due Date</span>
              <div>
                <select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)}
                  className={`font-body text-[11px] font-medium ${teamFilter !== 'all' ? 'text-fq-accent' : t.light} uppercase tracking-wide bg-transparent outline-none cursor-pointer w-full appearance-none`}>
                  <option value="all">Person ▾</option>
                  {team.map(m => <option key={m.id} value={m.id}>{m.initials}</option>)}
                </select>
              </div>
            </div>

            {hasActiveFilters && (
              <div className="flex items-center gap-2 px-3 py-1.5">
                <span className={`font-body text-[11px] ${t.light}`}>Filtered</span>
                <button onClick={clearFilters} className="font-body text-[11px] text-fq-accent hover:text-fq-dark transition-colors">Clear all</button>
              </div>
            )}

            <div className="space-y-5 mt-3">
              {sortedGroupEntries.map(([group, groupTasks]) => {
                const groupDone = groupTasks.filter(tk => (tk.status || '') === 'completed').length;
                return (
                  <div key={group}>
                    <button
                      onClick={() => setCollapsedGroups(prev => { const n = new Set(prev); n.has(group) ? n.delete(group) : n.add(group); return n; })}
                      className="flex items-center gap-2 mb-1.5 px-3 w-full text-left">
                      <span className={`text-[10px] ${t.light} transition-transform ${collapsedGroups.has(group) ? '' : 'rotate-90'}`}>▶</span>
                      {(() => {
                        const gc = groupBy === 'category' ? getCategoryColor(group) : { text: 'text-fq-accent', bg: 'bg-fq-light-accent' };
                        return (<span className={`font-body text-[12px] font-medium ${gc.text} ${gc.bg} px-2.5 py-0.5 rounded-full`}>{group}</span>);
                      })()}
                      <span className={`font-body text-[11px] ${t.light}`}>{groupDone}/{groupTasks.length}</span>
                    </button>
                    {!collapsedGroups.has(group) && <div>
                      {groupTasks.map((task) => {
                        const member = task.assigned_to ? getTeamMember(task.assigned_to) : null;
                        const subtasks = task.subtasks || [];
                        const stCount = subtasks.length;
                        const stDone = subtasks.filter(s => s.completed).length;
                        const taskStatus = task.status || '';
                        const isExpanded = expandedSubtasks.has(task.id);
                        const priorityColors: Record<string, string> = { high: 'text-fq-rose bg-fq-rose-light', medium: 'text-fq-amber bg-fq-amber-light', low: 'text-fq-sage bg-fq-sage-light' };
                        return (
                          <div key={task.id} className="group/row">
                          <div onClick={() => setSelectedTaskId(task.id)}
                            className={`grid ${gridCols} gap-2 items-center py-2 px-3 rounded-lg hover:bg-fq-bg/50 transition-colors border-b border-fq-border/40 cursor-pointer ${
                              selectedTaskId === task.id ? 'bg-fq-blue-light/50 border-l-2 border-l-fq-blue' : ''
                            }`}>
                            <div className="flex items-center">
                              <button onClick={(e) => { e.stopPropagation(); toggleTaskComplete(task.id); }}
                                className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${taskStatus === 'completed' ? 'bg-[#4CAF6A] border-[#4CAF6A] text-white' : 'border-fq-border hover:border-fq-accent'}`}>
                                {taskStatus === 'completed' && <svg width="8" height="8" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 5l2.5 2.5L8 3" /></svg>}
                              </button>
                            </div>
                            <div className="flex items-center gap-1.5 min-w-0">
                              <InlineCell value={task.text} onSave={(v) => updateTaskField(task.id, 'text', v)}
                                className={`font-body text-[13px] truncate ${taskStatus === 'completed' ? 'text-fq-muted/50 line-through' : t.heading}`} />
                              {stCount > 0 && <span className={`font-body text-[10px] ${t.light} shrink-0`}>{stDone}/{stCount}</span>}
                            </div>
                            <span className="truncate" onClick={(e) => e.stopPropagation()}>
                              <InlineCell value={task.category || ''} onSave={(v) => updateTaskField(task.id, 'category', v || undefined)}
                                type="select" options={categories.map(c => ({ value: c, label: c }))}
                                className={`font-body text-[11px] ${task.category ? (() => { const cc = getCategoryColor(task.category!); return `${cc.text} ${cc.bg} px-2 py-0.5 rounded-full`; })() : t.light}`}
                                placeholder="—" />
                            </span>
                            <span className={`font-body text-[11px] ${t.light} truncate`}>{task.projectName}</span>
                            <span onClick={(e) => e.stopPropagation()}>
                              <InlineCell value={taskStatus} onSave={(v) => updateTaskField(task.id, 'status', v)}
                                type="select" options={[{ value: '', label: '—' }, { value: 'in_progress', label: 'In Progress' }, { value: 'delayed', label: 'Delayed' }, { value: 'completed', label: 'Completed' }]}
                                displayValue={statusLabels[taskStatus] || '—'}
                                className={`font-body text-[11px] ${statusColors[taskStatus] || `${t.light} bg-fq-bg`} px-2 py-0.5 rounded-full inline-block`} />
                            </span>
                            <span onClick={(e) => e.stopPropagation()}>
                              <InlineCell value={task.priority || ''} onSave={(v) => updateTaskField(task.id, 'priority', v || undefined)}
                                type="select" options={[{ value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }]}
                                className={`font-body text-[11px] ${task.priority ? `${priorityColors[task.priority]} px-2 py-0.5 rounded-full` : t.light}`}
                                placeholder="—" />
                            </span>
                            <span onClick={(e) => e.stopPropagation()}>
                              <InlineCell value={task.due_date || ''} onSave={(v) => updateTaskField(task.id, 'due_date', v || undefined)}
                                type="date" displayValue={task.due_date ? formatDate(task.due_date) : ''}
                                className={`font-body text-[12px] ${t.light}`} placeholder="—" />
                            </span>
                            <span onClick={(e) => e.stopPropagation()}>
                              <InlineCell value={task.assigned_to || ''} onSave={(v) => updateTaskField(task.id, 'assigned_to', v || undefined)}
                                type="select" options={team.map(m => ({ value: m.id, label: m.initials }))}
                                displayValue={member?.initials || ''}
                                className={`font-body text-[10px] ${member ? 'font-semibold text-fq-accent' : t.light}`} placeholder="—" />
                            </span>
                          </div>

                          {isExpanded && subtasks.length > 0 && (
                            <div className="ml-10 border-l-2 border-fq-border/40 pl-3 py-1">
                              {subtasks.map(st => (
                                <div key={st.id} className="flex items-center gap-2 py-1 group/st">
                                  <button onClick={() => toggleSubtaskInline(task.id, st.id)}
                                    className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors ${st.completed ? 'bg-fq-accent border-fq-accent text-white' : 'border-fq-border hover:border-fq-accent'}`}>
                                    {st.completed && <svg width="7" height="7" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 5l2.5 2.5L8 3" /></svg>}
                                  </button>
                                  <span className={`font-body text-[12px] ${st.completed ? 'text-fq-muted/50 line-through' : t.body}`}>{st.text}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {addingSubtaskFor === task.id && (
                            <div className="flex items-center gap-2 ml-10 py-1 px-3">
                              <input value={inlineSubtaskText} onChange={(e) => setInlineSubtaskText(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') addInlineSubtask(task.id); if (e.key === 'Escape') { setAddingSubtaskFor(null); setInlineSubtaskText(''); } }}
                                placeholder="Subtask name..." autoFocus
                                className={`flex-1 font-body text-[12px] ${t.body} bg-white border border-fq-border rounded px-2 py-1 outline-none focus:border-fq-accent/40`} />
                              <button onClick={() => addInlineSubtask(task.id)} className="font-body text-[11px] text-fq-accent hover:text-fq-dark">Add</button>
                              <button onClick={() => { setAddingSubtaskFor(null); setInlineSubtaskText(''); }} className={`font-body text-[11px] ${t.light}`}>Cancel</button>
                            </div>
                          )}
                          {addingSubtaskFor !== task.id && (
                            <button onClick={(e) => { e.stopPropagation(); setAddingSubtaskFor(task.id); setInlineSubtaskText(''); }}
                              className={`font-body text-[10px] ${t.light} hover:text-fq-accent ml-10 px-3 py-0.5 opacity-0 group-hover/row:opacity-100 transition-opacity`}>
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
          <div className="flex gap-4 overflow-x-auto pb-2 -mx-2 px-2">
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
                <div key={column} className="flex-shrink-0 w-[260px]">
                  <div className="flex items-center justify-between mb-3 px-1">
                    <div className="flex items-center gap-2">
                      {(() => {
                        const gc = kanbanGroupField === 'category' ? getCategoryColor(column) : { text: 'text-fq-accent', bg: 'bg-fq-light-accent' };
                        return (<span className={`font-body text-[12px] font-medium ${gc.text} ${gc.bg} px-2.5 py-0.5 rounded-full`}>{column}</span>);
                      })()}
                      <span className={`font-body text-[11px] ${t.light}`}>{columnTasks.length}</span>
                    </div>
                    <span className={`font-body text-[10px] ${t.light}`}>{colDone}/{columnTasks.length}</span>
                  </div>
                  <div className="space-y-2">
                    {columnTasks.map(task => {
                      const member = task.assigned_to ? getTeamMember(task.assigned_to) : null;
                      const ts = task.status || '';
                      return (
                        <div key={task.id} onClick={() => setSelectedTaskId(task.id)}
                          className={`bg-white border rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer border-fq-border ${selectedTaskId === task.id ? 'ring-1 ring-fq-blue' : ''}`}>
                          <div className="flex items-start gap-2">
                            <button onClick={(e) => { e.stopPropagation(); toggleTaskComplete(task.id); }}
                              className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${ts === 'completed' ? 'bg-[#4CAF6A] border-[#4CAF6A] text-white' : 'border-fq-border hover:border-fq-accent'}`}>
                              {ts === 'completed' && <svg width="8" height="8" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 5l2.5 2.5L8 3" /></svg>}
                            </button>
                            <span className={`font-body text-[12px] leading-snug ${ts === 'completed' ? 'text-fq-muted/50 line-through' : t.heading}`}>{task.text}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            {ts && <span className={`font-body text-[10px] ${statusColors[ts]} px-1.5 py-0.5 rounded`}>{statusLabels[ts]}</span>}
                            <span className={`font-body text-[10px] ${t.light} bg-fq-bg px-1.5 py-0.5 rounded`}>{task.projectName}</span>
                            {task.due_date && <span className={`font-body text-[10px] ${t.light} bg-fq-bg px-1.5 py-0.5 rounded`}>{formatDate(task.due_date)}</span>}
                            {member && (
                              <div className="w-5 h-5 rounded-full bg-fq-light-accent flex items-center justify-center shrink-0 ml-auto" title={member.name}>
                                <span className="font-body text-[8px] font-semibold text-fq-accent">{member.initials}</span>
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
