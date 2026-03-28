'use client';

import { useState, useEffect, useCallback } from 'react';
import { getISOWeek, offsetWeek, formatWeekLabel } from '@/lib/week';
import WeekChatPanel from '@/components/WeekChatPanel';

interface SprintTask {
  id: string;
  title: string;
  bucket: string;
  tag: string;
  done: boolean;
  sprint_week: string;
  sort_order: number;
  created_at: string;
}

const BUCKETS = [
  'Sun-Steeped Hamptons',
  'Menorca Editorial',
  'Elisabeth & JJ — LionRock Farm',
  'Julia & Frank — Wave Resort',
  'Tippi & Justin — Vanderbilt Museum',
  'Fox & Quinn — Operations',
  'Fox & Quinn — Marketing',
  'FQ Command Center',
];

const TAG_STYLES: Record<string, string> = {
  action:    'bg-fq-blue-light text-fq-blue',
  decision:  'bg-fq-amber-light text-fq-amber',
  creative:  'bg-fq-plum-light text-fq-plum',
  ops:       'bg-fq-bg text-fq-muted border border-fq-border',
  marketing: 'bg-fq-rose-light text-fq-rose',
  build:     'bg-fq-sage-light text-fq-sage',
  client:    'bg-fq-teal-light text-fq-teal',
  check:     'bg-fq-amber-light text-fq-amber',
  research:  'bg-fq-light-accent text-fq-accent',
  other:     'bg-fq-bg text-fq-muted border border-fq-border',
};

const TAG_LABELS: Record<string, string> = {
  action:    'email / outreach',
  decision:  'decision',
  creative:  'creative',
  ops:       'ops',
  marketing: 'marketing',
  build:     'build',
  client:    'client work',
  check:     'check',
  research:  'research',
  other:     'other',
};

export default function WeekPage() {
  const [week, setWeek] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search).get('week');
      if (p) return p;
    }
    return getISOWeek();
  });
  const [tasks, setTasks] = useState<SprintTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Add form state
  const [newTitle, setNewTitle] = useState('');
  const [newBucket, setNewBucket] = useState(BUCKETS[0]);
  const [newTag, setNewTag] = useState('action');
  const [submitting, setSubmitting] = useState(false);

  const currentWeek = getISOWeek();
  const isCurrentWeek = week === currentWeek;

  const fetchTasks = useCallback(() => {
    setLoading(true);
    fetch(`/api/sprint-tasks?week=${week}`)
      .then(r => r.json())
      .then(data => {
        setTasks(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [week]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('week', week);
    window.history.replaceState({}, '', url.toString());
  }, [week]);

  const toggleDone = async (task: SprintTask) => {
    // Optimistic update
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, done: !t.done } : t));
    await fetch('/api/sprint-tasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: task.id, done: !task.done }),
    });
  };

  const deleteTask = async (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    await fetch(`/api/sprint-tasks?id=${id}`, { method: 'DELETE' });
  };

  const pushToNextWeek = async (task: SprintTask) => {
    const nextWeek = offsetWeek(task.sprint_week, 1);
    await fetch('/api/sprint-tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: task.title,
        bucket: task.bucket,
        tag: task.tag,
        sprint_week: nextWeek,
        sort_order: task.sort_order,
      }),
    });
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setSubmitting(true);
    const res = await fetch('/api/sprint-tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: newTitle.trim(),
        bucket: newBucket,
        tag: newTag,
        sprint_week: week,
        sort_order: tasks.length,
      }),
    });
    if (res.ok) {
      const created = await res.json();
      setTasks(prev => [...prev, created]);
      setNewTitle('');
      setNewBucket(BUCKETS[0]);
      setNewTag('action');
      setShowAdd(false);
    }
    setSubmitting(false);
  };

  const totalTasks = tasks.length;
  const doneTasks = tasks.filter(t => t.done).length;
  const remaining = totalTasks - doneTasks;

  const activeBuckets = BUCKETS.filter(b => tasks.some(t => t.bucket === b));

  return (
    <div className="p-8">
    <div className="flex gap-6 items-start max-w-5xl mx-auto">
    <div className="flex-1 min-w-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="font-heading text-2xl font-semibold text-fq-dark">
            Week of {formatWeekLabel(week)}
          </h1>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setWeek(offsetWeek(week, -1))}
              className="p-1.5 rounded-lg text-fq-muted hover:text-fq-dark hover:bg-fq-light-accent transition-colors"
              aria-label="Previous week"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 12l-4-4 4-4" />
              </svg>
            </button>
            <button
              onClick={() => setWeek(offsetWeek(week, 1))}
              className="p-1.5 rounded-lg text-fq-muted hover:text-fq-dark hover:bg-fq-light-accent transition-colors"
              aria-label="Next week"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 4l4 4-4 4" />
              </svg>
            </button>
            {!isCurrentWeek && (
              <button
                onClick={() => setWeek(currentWeek)}
                className="ml-1 px-3 py-1 text-xs font-body text-fq-accent border border-fq-border rounded-lg hover:bg-fq-light-accent transition-colors"
              >
                Today
              </button>
            )}
          </div>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-2 px-4 py-2 bg-fq-accent text-white font-body text-sm rounded-lg hover:opacity-90 transition-opacity"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M7 2v10M2 7h10" />
          </svg>
          Add Task
        </button>
      </div>

      {/* Stats */}
      <div className="flex gap-3 mb-6">
        <div className="flex-1 bg-fq-bg border border-fq-border rounded-xl px-4 py-3">
          <p className="font-body text-xs text-fq-muted mb-0.5">Complete</p>
          <p className="font-heading text-xl text-fq-dark">{doneTasks} <span className="text-fq-muted font-body text-sm">/ {totalTasks}</span></p>
        </div>
        <div className="flex-1 bg-fq-bg border border-fq-border rounded-xl px-4 py-3">
          <p className="font-body text-xs text-fq-muted mb-0.5">Remaining</p>
          <p className="font-heading text-xl text-fq-dark">{remaining}</p>
        </div>
      </div>

      {/* Add Task Form */}
      {showAdd && (
        <div className="bg-fq-card border border-fq-border rounded-xl shadow-sm p-5 mb-6">
          <form onSubmit={handleAddSubmit} className="flex flex-col gap-3">
            <div>
              <label className="font-body text-xs text-fq-muted block mb-1">Title</label>
              <input
                type="text"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                placeholder="Task title..."
                className="w-full px-3 py-2 font-body text-sm text-fq-dark bg-fq-bg border border-fq-border rounded-lg focus:outline-none focus:border-fq-accent"
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="font-body text-xs text-fq-muted block mb-1">Bucket</label>
                <select
                  value={newBucket}
                  onChange={e => setNewBucket(e.target.value)}
                  className="w-full px-3 py-2 font-body text-sm text-fq-dark bg-fq-bg border border-fq-border rounded-lg focus:outline-none focus:border-fq-accent"
                >
                  {BUCKETS.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div className="w-40">
                <label className="font-body text-xs text-fq-muted block mb-1">Tag</label>
                <select
                  value={newTag}
                  onChange={e => setNewTag(e.target.value)}
                  className="w-full px-3 py-2 font-body text-sm text-fq-dark bg-fq-bg border border-fq-border rounded-lg focus:outline-none focus:border-fq-accent"
                >
                  {Object.keys(TAG_LABELS).map(t => (
                    <option key={t} value={t}>{TAG_LABELS[t]}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="px-4 py-2 font-body text-sm text-fq-muted hover:text-fq-dark transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !newTitle.trim()}
                className="px-4 py-2 font-body text-sm bg-fq-accent text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                Add to this sprint
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Task Groups */}
      {loading ? (
        <div className="text-center py-16 text-fq-muted font-body text-sm">Loading...</div>
      ) : activeBuckets.length === 0 ? (
        <div className="text-center py-16">
          <p className="font-body text-fq-muted text-sm">No tasks this week.</p>
          <p className="font-body text-fq-muted text-xs mt-1">Use "+ Add Task" to get started.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {activeBuckets.map(bucket => {
            const bucketTasks = tasks.filter(t => t.bucket === bucket);
            const bucketDone = bucketTasks.filter(t => t.done).length;
            return (
              <div key={bucket} className="bg-fq-card border border-fq-border rounded-xl shadow-sm overflow-hidden">
                {/* Bucket header */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-fq-border bg-fq-bg">
                  <h2 className="font-body text-xs font-medium text-fq-muted uppercase tracking-wider">
                    {bucket}
                  </h2>
                  <span className="font-body text-xs text-fq-muted">
                    {bucketDone}/{bucketTasks.length}
                  </span>
                </div>
                {/* Tasks */}
                <div className="divide-y divide-fq-border">
                  {bucketTasks.map(task => (
                    <div
                      key={task.id}
                      className={`flex items-center gap-3 px-5 py-3 group transition-opacity ${task.done ? 'opacity-50' : ''}`}
                      onMouseEnter={() => setHoveredId(task.id)}
                      onMouseLeave={() => setHoveredId(null)}
                    >
                      {/* Checkbox */}
                      <button
                        onClick={() => toggleDone(task)}
                        className={`flex-shrink-0 w-4 h-4 rounded border transition-colors ${
                          task.done
                            ? 'bg-fq-accent border-fq-accent'
                            : 'border-fq-border hover:border-fq-accent'
                        }`}
                        aria-label={task.done ? 'Mark incomplete' : 'Mark complete'}
                      >
                        {task.done && (
                          <svg viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 8l3 3 7-7" />
                          </svg>
                        )}
                      </button>
                      {/* Title */}
                      <span className={`flex-1 font-body text-sm text-fq-dark ${task.done ? 'line-through' : ''}`}>
                        {task.title}
                      </span>
                      {/* Push to next week (hover) */}
                      <button
                        onClick={() => pushToNextWeek(task)}
                        className={`flex-shrink-0 w-5 h-5 text-fq-muted hover:text-fq-accent transition-all ${hoveredId === task.id ? 'opacity-100' : 'opacity-0'}`}
                        aria-label="Push to next week"
                        title="Push to next week"
                      >
                        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M4 10h10M11 6l4 4-4 4" />
                        </svg>
                      </button>
                      {/* Delete button (hover) */}
                      <button
                        onClick={() => deleteTask(task.id)}
                        className={`flex-shrink-0 w-5 h-5 text-fq-muted hover:text-fq-alert transition-all ${hoveredId === task.id ? 'opacity-100' : 'opacity-0'}`}
                        aria-label="Delete task"
                      >
                        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                          <path d="M6 6l8 8M14 6l-8 8" />
                        </svg>
                      </button>
                      {/* Tag pill */}
                      <span className={`flex-shrink-0 px-2.5 py-0.5 rounded-full font-body text-[11px] font-medium ${TAG_STYLES[task.tag] || TAG_STYLES.action}`}>
                        {TAG_LABELS[task.tag] || task.tag}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>{/* end left column */}

    {/* Right — chat panel */}
    <div className="w-[320px] shrink-0 sticky top-6">
      <WeekChatPanel week={week} onTaskAdded={fetchTasks} />
    </div>
    </div>{/* end two-column flex */}
    </div>
  );
}
