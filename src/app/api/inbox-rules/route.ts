/**
 * /api/inbox-rules
 *
 * GET    — Return all inbox hide rules
 * POST   — Create a new rule (sender or domain)
 * DELETE — Remove a rule by id
 */

import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from('inbox_rules')
    .select('id, rule_type, value, action, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    // Table may not exist yet (migration not run) — return empty gracefully
    if (error.code === '42P01') return NextResponse.json({ rules: [] });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ rules: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = getServiceSupabase();
  const body = await request.json();
  const { rule_type, value } = body;

  if (!rule_type || !value) {
    return NextResponse.json({ error: 'rule_type and value required' }, { status: 400 });
  }
  if (!['sender', 'domain'].includes(rule_type)) {
    return NextResponse.json({ error: 'rule_type must be sender or domain' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('inbox_rules')
    .upsert({ rule_type, value: value.toLowerCase().trim(), action: 'hide' }, { onConflict: 'rule_type,value' })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ rule: data });
}

export async function DELETE(request: Request) {
  const supabase = getServiceSupabase();
  const { id } = await request.json();

  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const { error } = await supabase.from('inbox_rules').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ deleted: true });
}
