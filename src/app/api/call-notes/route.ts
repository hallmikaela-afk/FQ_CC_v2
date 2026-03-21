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

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { extracted_actions, ...noteData } = body;

  const { data: note, error } = await supabase.from('call_notes').insert(noteData).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (extracted_actions?.length) {
    await supabase.from('extracted_actions').insert(
      extracted_actions.map((a: any) => ({ ...a, call_note_id: note.id }))
    );
  }

  return NextResponse.json({ ...note, extracted_actions: extracted_actions || [] }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id, extracted_actions, ...updates } = body;

  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const { data, error } = await supabase.from('call_notes').update(updates).eq('id', id).select().single();
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
