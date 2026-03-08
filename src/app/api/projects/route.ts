import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { data: projects, error } = await supabase
    .from('projects')
    .select(`
      *,
      project_assignments(team_member_id),
      tasks(id, completed, due_date),
      vendors(id),
      call_notes(id)
    `)
    .order('event_date');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Compute task counts for each project
  const enriched = projects.map((p: any) => {
    const tasks = p.tasks || [];
    const today = new Date().toISOString().split('T')[0];
    return {
      ...p,
      assigned_to: (p.project_assignments || []).map((a: any) => a.team_member_id),
      tasks_total: tasks.length,
      tasks_completed: tasks.filter((t: any) => t.completed).length,
      overdue_count: tasks.filter((t: any) => !t.completed && t.due_date && t.due_date < today).length,
      vendors_count: (p.vendors || []).length,
      call_notes_count: (p.call_notes || []).length,
      // Remove nested arrays from response to keep it clean
      project_assignments: undefined,
      tasks: undefined,
      vendors: undefined,
      call_notes: undefined,
    };
  });

  return NextResponse.json(enriched);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { assigned_to, ...projectData } = body;

  const { data: project, error } = await supabase
    .from('projects')
    .insert(projectData)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Create assignments
  if (assigned_to?.length) {
    await supabase.from('project_assignments').insert(
      assigned_to.map((teamMemberId: string) => ({
        project_id: project.id,
        team_member_id: teamMemberId,
      }))
    );
  }

  return NextResponse.json(project, { status: 201 });
}
