import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get('project_id');

  let query = supabase
    .from('tasks')
    .select(`*, subtasks(*)`)
    .order('sort_order')
    .order('due_date');

  if (projectId) {
    query = query.eq('project_id', projectId);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  // Support bulk insert (array) or single
  if (Array.isArray(body)) {
    const { data, error } = await supabase.from('tasks').insert(body).select();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
  }

  const { subtasks, ...taskData } = body;
  const { data: task, error } = await supabase.from('tasks').insert(taskData).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (subtasks?.length) {
    await supabase.from('subtasks').insert(
      subtasks.map((st: any, i: number) => ({ task_id: task.id, text: st.text, completed: st.completed || false, sort_order: i }))
    );
  }

  return NextResponse.json(task, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id, ...updates } = body;

  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const { data, error } = await supabase.from('tasks').update(updates).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}
