import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// POST /api/chat/sessions/:id/messages
// Body: { role, content, metadata? }
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { role, content, metadata } = await req.json();
    if (!role || content == null) return NextResponse.json({ error: 'role and content required' }, { status: 400 });

    const supabase = getServiceSupabase();

    // Save message and bump session.updated_at in parallel
    const [msgRes] = await Promise.all([
      supabase
        .from('chat_messages')
        .insert({ session_id: params.id, role, content, metadata: metadata || {} })
        .select()
        .single(),
      supabase
        .from('chat_sessions')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', params.id),
    ]);

    if (msgRes.error) return NextResponse.json({ error: msgRes.error.message }, { status: 500 });
    return NextResponse.json(msgRes.data, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
