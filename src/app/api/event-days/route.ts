import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// Resolve a project_id that may be a slug or UUID into the real UUID
async function resolveProjectId(supabase: ReturnType<typeof getServiceSupabase>, projectId: string): Promise<string | null> {
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId);
  if (isUUID) return projectId;
  const { data } = await supabase.from('projects').select('id').eq('slug', projectId).single();
  return data?.id ?? null;
}

export async function GET(req: NextRequest) {
  const supabase = getServiceSupabase();
  const projectId = req.nextUrl.searchParams.get('project_id');

  let query = supabase.from('event_days').select('*').order('sort_order');
  if (projectId) {
    const uuid = await resolveProjectId(supabase, projectId);
    if (!uuid) return NextResponse.json([]);
    query = query.eq('project_id', uuid);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const supabase = getServiceSupabase();
  const body = await req.json();

  const uuid = await resolveProjectId(supabase, body.project_id);
  if (!uuid) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const { data, error } = await supabase
    .from('event_days')
    .insert({ ...body, project_id: uuid })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const supabase = getServiceSupabase();
  const body = await req.json();
  const { id, ...updates } = body;
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const { data, error } = await supabase
    .from('event_days')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const supabase = getServiceSupabase();
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const { error } = await supabase.from('event_days').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
