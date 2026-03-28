import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// GET /api/chat/sessions/:id  — returns session + messages
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = getServiceSupabase();
    const [sessionRes, messagesRes] = await Promise.all([
      supabase.from('chat_sessions').select('*').eq('id', params.id).single(),
      supabase.from('chat_messages').select('*').eq('session_id', params.id).order('created_at'),
    ]);

    if (sessionRes.error) return NextResponse.json({ error: sessionRes.error.message }, { status: 404 });
    return NextResponse.json({ ...sessionRes.data, messages: messagesRes.data || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH /api/chat/sessions/:id  — update title / updated_at
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from('chat_sessions')
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', params.id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE /api/chat/sessions/:id
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = getServiceSupabase();
    const { error } = await supabase.from('chat_sessions').delete().eq('id', params.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
