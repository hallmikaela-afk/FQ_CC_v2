import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

async function resolveProjectId(supabase: ReturnType<typeof getServiceSupabase>, projectId: string): Promise<string | null> {
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId);
  if (isUUID) return projectId;
  const { data } = await supabase.from('projects').select('id').eq('slug', projectId).single();
  return data?.id ?? null;
}

export async function GET(req: NextRequest) {
  const supabase = getServiceSupabase();
  const projectId = req.nextUrl.searchParams.get('project_id');
  const eventDayId = req.nextUrl.searchParams.get('event_day_id');

  let query = supabase.from('vendors').select('*').order('category');

  if (projectId) {
    const uuid = await resolveProjectId(supabase, projectId);
    if (uuid) query = query.eq('project_id', uuid);
  }
  if (eventDayId) {
    query = query.eq('event_day_id', eventDayId);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const supabase = getServiceSupabase();
  const body = await req.json();
  const rows = Array.isArray(body) ? body : [body];

  // Resolve slug-based project_id to UUID for all rows
  const resolved = await Promise.all(rows.map(async (row) => {
    if (!row.project_id) return row;
    const uuid = await resolveProjectId(supabase, row.project_id);
    return uuid ? { ...row, project_id: uuid } : row;
  }));

  const { data, error } = await supabase.from('vendors').insert(resolved).select();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const supabase = getServiceSupabase();
  const body = await req.json();
  const { id, ...updates } = body;

  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const { data, error } = await supabase.from('vendors').update(updates).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const supabase = getServiceSupabase();
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const { error } = await supabase.from('vendors').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
