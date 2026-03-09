import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get('project_id');

  let query = supabase.from('call_notes').select(`*, extracted_actions(*)`).order('date', { ascending: false });
  if (projectId) query = query.eq('project_id', projectId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  // Delete associated extracted_actions first
  await supabase.from('extracted_actions').delete().eq('call_note_id', id);

  const { error } = await supabase.from('call_notes').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
