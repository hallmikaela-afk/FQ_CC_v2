import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// GET /api/chat/sessions?context=assistant&limit=25
export async function GET(req: NextRequest) {
  const context = req.nextUrl.searchParams.get('context');
  const pageContext = req.nextUrl.searchParams.get('page_context');
  const limit = parseInt(req.nextUrl.searchParams.get('limit') || '25', 10);

  try {
    const supabase = getServiceSupabase();
    let query = supabase
      .from('chat_sessions')
      .select('id, context, project_id, page_context, title, created_at, updated_at')
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (context) query = query.eq('context', context);
    if (pageContext) query = query.eq('page_context', pageContext);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/chat/sessions
// Body: { context, project_id?, page_context?, title? }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { context, project_id, page_context, title } = body;
    if (!context) return NextResponse.json({ error: 'context required' }, { status: 400 });

    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from('chat_sessions')
      .insert({ context, project_id: project_id || null, page_context: page_context || null, title: title || null })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
