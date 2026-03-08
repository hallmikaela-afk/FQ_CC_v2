'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { ProjectRow, TaskRow, TeamMemberRow, VendorRow, CallNoteRow, TemplateTaskRow } from './database.types';
import type { Project, Task, Vendor, CallNote, TeamMember } from '@/data/seed';

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

export function useCallNotes(projectId?: string) {
  const [callNotes, setCallNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    const params = projectId ? `?project_id=${projectId}` : '';
    try {
      const res = await fetch(`${API_BASE}/api/call-notes${params}`);
      if (res.ok) {
        const data = await res.json();
        setCallNotes(data);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [projectId]);

  useEffect(() => { fetch_(); }, [fetch_]);

  return { callNotes, loading, refetch: fetch_ };
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

// ─── Composite hook: fetches all data and returns full Project objects ───

export function useFullProjects() {
  const { projects: rawProjects, loading: pLoading, error: pError, refetch: refetchProjects } = useProjects();
  const { tasks: allTasks, loading: tLoading } = useTasks();
  const { vendors: allVendors, loading: vLoading } = useVendors();
  const { callNotes: allCallNotes, loading: cnLoading } = useCallNotes();
  const { team, loading: tmLoading } = useTeam();

  const loading = pLoading || tLoading || vLoading || cnLoading || tmLoading;

  const projects: Project[] = useMemo(() => {
    if (loading) return [];
    return rawProjects.map((p) => {
      const projectTasks: Task[] = allTasks
        .filter(t => t.project_id === p.id)
        .map(t => ({
          id: t.id,
          text: t.text,
          completed: t.completed,
          status: t.status || undefined,
          due_date: t.due_date || undefined,
          category: t.category || undefined,
          assigned_to: t.assigned_to || undefined,
          priority: t.priority || undefined,
          notes: t.notes || undefined,
          subtasks: (t.subtasks || []).map(st => ({
            id: st.id,
            text: st.text,
            completed: st.completed,
          })),
        }));

      const projectVendors: Vendor[] = allVendors
        .filter(v => v.project_id === p.id)
        .map(v => ({
          id: v.id,
          category: v.category,
          vendor_name: v.vendor_name,
          contact_name: v.contact_name || undefined,
          email: v.email || undefined,
          phone: v.phone || undefined,
          website: v.website || undefined,
          instagram: v.instagram || undefined,
        }));

      const projectCallNotes: CallNote[] = allCallNotes
        .filter(cn => cn.project_id === p.id)
        .map((cn: any) => ({
          id: cn.id,
          date: cn.date,
          title: cn.title || undefined,
          summary: cn.summary || undefined,
          raw_text: cn.raw_text,
          extracted_actions: (cn.extracted_actions || []).map((ea: any) => ({
            id: ea.id,
            text: ea.text,
            due_date: ea.due_date || '',
            accepted: ea.accepted,
            dismissed: ea.dismissed,
          })),
        }));

      const today = new Date().toISOString().split('T')[0];

      return {
        id: p.slug || p.id,
        type: p.type,
        name: p.name,
        status: p.status,
        event_date: p.event_date || '',
        contract_signed_date: p.contract_signed_date || undefined,
        color: p.color,
        concept: p.concept || undefined,
        assigned_to: p.assigned_to || [],
        service_tier: p.service_tier || undefined,
        client1_name: p.client1_name || undefined,
        client2_name: p.client2_name || undefined,
        venue_name: p.venue_name || undefined,
        venue_location: p.venue_location || undefined,
        venue_street: p.venue_street || undefined,
        venue_city_state_zip: p.venue_city_state_zip || undefined,
        client_street: p.client_street || undefined,
        client_city_state_zip: p.client_city_state_zip || undefined,
        guest_count: p.guest_count || undefined,
        estimated_budget: p.estimated_budget || undefined,
        photographer: p.photographer || undefined,
        florist: p.florist || undefined,
        location: p.location || undefined,
        location_street: p.location_street || undefined,
        location_city_state_zip: p.location_city_state_zip || undefined,
        design_board_link: p.design_board_link || undefined,
        canva_link: p.canva_link || undefined,
        internal_file_share: p.internal_file_share || undefined,
        client_shared_folder: p.client_shared_folder || undefined,
        client_portal_link: p.client_portal_link || undefined,
        client_website: p.client_website || undefined,
        sharepoint_folder: p.sharepoint_folder || undefined,
        project_colors: p.project_colors || undefined,
        next_call_agenda: p.next_call_agenda || undefined,
        tasks_total: projectTasks.length,
        tasks_completed: projectTasks.filter(t => t.completed).length,
        overdue_count: projectTasks.filter(t => !t.completed && t.due_date && t.due_date < today).length,
        tasks: projectTasks,
        vendors: projectVendors,
        call_notes: projectCallNotes,
        // Store the real UUID for API calls
        _supabaseId: p.id,
      } as Project & { _supabaseId: string };
    });
  }, [rawProjects, allTasks, allVendors, allCallNotes, loading]);

  const teamMembers: TeamMember[] = useMemo(() => {
    return team.map(t => ({
      id: t.id,
      name: t.name,
      initials: t.initials,
      role: t.role,
    }));
  }, [team]);

  const getTeamMember = useCallback((id: string): TeamMember | undefined => {
    return teamMembers.find(m => m.id === id);
  }, [teamMembers]);

  return {
    projects,
    team: teamMembers,
    getTeamMember,
    loading,
    error: pError,
    refetch: refetchProjects,
  };
}
