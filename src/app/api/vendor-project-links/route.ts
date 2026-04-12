import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

async function resolveProjectId(supabase: ReturnType<typeof getServiceSupabase>, projectId: string): Promise<string | null> {
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId);
  if (isUUID) return projectId;
  const { data } = await supabase.from('projects').select('id').eq('slug', projectId).single();
  return data?.id ?? null;
}

export async function POST(req: NextRequest) {
  const supabase = getServiceSupabase();
  const body = await req.json();
  const { vendor_id, project_id, role_notes } = body;

  if (!vendor_id || !project_id) {
    return NextResponse.json({ error: 'vendor_id and project_id are required' }, { status: 400 });
  }

  const resolvedProjectId = await resolveProjectId(supabase, project_id);
  if (!resolvedProjectId) {
    return NextResponse.json({ error: 'project not found' }, { status: 404 });
  }

  const { data, error } = await supabase
    .from('vendor_project_links')
    .insert({ vendor_id, project_id: resolvedProjectId, role_notes: role_notes || null })
    .select('*, projects(id, name, slug, color)')
    .single();

  if (error) {
    // Unique constraint violation — already linked
    if (error.code === '23505') {
      return NextResponse.json({ error: 'vendor is already linked to this project' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const supabase = getServiceSupabase();
  const vendorId = req.nextUrl.searchParams.get('vendor_id');
  const projectId = req.nextUrl.searchParams.get('project_id');
  const id = req.nextUrl.searchParams.get('id');

  if (id) {
    const { error } = await supabase.from('vendor_project_links').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (!vendorId || !projectId) {
    return NextResponse.json({ error: 'id or (vendor_id + project_id) required' }, { status: 400 });
  }

  const resolvedProjectId = await resolveProjectId(supabase, projectId);
  if (!resolvedProjectId) {
    return NextResponse.json({ error: 'project not found' }, { status: 404 });
  }

  const { error } = await supabase
    .from('vendor_project_links')
    .delete()
    .eq('vendor_id', vendorId)
    .eq('project_id', resolvedProjectId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
