import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { task_id, text, completed = false, sort_order = 0 } = body;

  if (!task_id || !text) {
    return NextResponse.json({ error: 'task_id and text required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('subtasks')
    .insert({ task_id, text, completed, sort_order })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
