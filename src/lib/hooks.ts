'use client';

import { useState, useEffect, useCallback } from 'react';
import type { ProjectRow, TaskRow, TeamMemberRow, VendorRow, CallNoteRow, TemplateTaskRow } from './database.types';

// Re-export types that match the seed.ts interfaces for compatibility
export interface ProjectWithCounts extends ProjectRow {
  assigned_to: string[];
  tasks_total: number;
  tasks_completed: number;
  overdue_count: number;
  vendors_count: number;
  call_notes_count: number;
}

export interface TaskWithSubtasks extends TaskRow {
  subtasks: { id: string; task_id: string; text: string; completed: boolean; sort_order: number }[];
}

const API_BASE = '';

export function useProjects() {
  const [projects, setProjects] = useState<ProjectWithCounts[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/projects`);
      if (!res.ok) throw new Error('Failed to fetch projects');
      const data = await res.json();
      setProjects(data);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetch_(); }, [fetch_]);

  return { projects, loading, error, refetch: fetch_ };
}

export function useTasks(projectId?: string) {
  const [tasks, setTasks] = useState<TaskWithSubtasks[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    try {
      const params = projectId ? `?project_id=${projectId}` : '';
      const res = await fetch(`${API_BASE}/api/tasks${params}`);
      if (!res.ok) throw new Error('Failed to fetch tasks');
      const data = await res.json();
      setTasks(data);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => { fetch_(); }, [fetch_]);

  const updateTask = useCallback(async (id: string, updates: Partial<TaskRow>) => {
    try {
      const res = await fetch(`${API_BASE}/api/tasks`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...updates }),
      });
      if (!res.ok) throw new Error('Failed to update task');
      // Optimistic update
      setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    } catch (e: any) {
      setError(e.message);
    }
  }, []);

  return { tasks, loading, error, refetch: fetch_, updateTask };
}

export function useTeam() {
  const [team, setTeam] = useState<TeamMemberRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/api/team`)
      .then(r => r.json())
      .then(data => { setTeam(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return { team, loading };
}

export function useVendors(projectId?: string) {
  const [vendors, setVendors] = useState<VendorRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = projectId ? `?project_id=${projectId}` : '';
    fetch(`${API_BASE}/api/vendors${params}`)
      .then(r => r.json())
      .then(data => { setVendors(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [projectId]);

  return { vendors, loading };
}

export function useTemplateTasks() {
  const [templates, setTemplates] = useState<TemplateTaskRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/api/template-tasks`)
      .then(r => r.json())
      .then(data => { setTemplates(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const generateForProject = useCallback(async (projectId: string, eventDate: string) => {
    const res = await fetch(`${API_BASE}/api/template-tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: projectId, event_date: eventDate }),
    });
    return res.json();
  }, []);

  return { templates, loading, generateForProject };
}
