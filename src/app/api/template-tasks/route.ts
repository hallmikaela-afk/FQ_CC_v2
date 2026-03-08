import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// GET all template tasks
export async function GET() {
  const { data, error } = await supabase
    .from('template_tasks')
    .select('*')
    .eq('is_active', true)
    .order('sort_order');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST: Generate tasks from templates for a project
export async function POST(req: NextRequest) {
  const { project_id, event_date } = await req.json();

  if (!project_id || !event_date) {
    return NextResponse.json({ error: 'project_id and event_date required' }, { status: 400 });
  }

  // Fetch active templates
  const { data: templates, error: tErr } = await supabase
    .from('template_tasks')
    .select('*')
    .eq('is_active', true)
    .order('sort_order');

  if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 });

  const eventDateObj = new Date(event_date + 'T00:00:00');

  // Generate tasks from templates
  const tasks = (templates || []).map((tmpl, i) => {
    const dueDate = new Date(eventDateObj);
    dueDate.setDate(dueDate.getDate() - tmpl.weeks_before_event * 7);
    return {
      project_id,
      text: tmpl.text,
      completed: false,
      due_date: dueDate.toISOString().split('T')[0],
      category: tmpl.category,
      sort_order: i,
    };
  });

  const { data, error } = await supabase.from('tasks').insert(tasks).select();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ created: data?.length || 0, tasks: data }, { status: 201 });
}
