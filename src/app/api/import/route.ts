import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { table, rows } = body;

  const allowedTables = ['projects', 'tasks', 'vendors', 'team_members', 'call_notes', 'template_tasks'] as const;
  type AllowedTable = typeof allowedTables[number];

  if (!allowedTables.includes(table as AllowedTable)) {
    return NextResponse.json({ error: `Invalid table: ${table}. Allowed: ${allowedTables.join(', ')}` }, { status: 400 });
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'rows must be a non-empty array' }, { status: 400 });
  }

  const supabase = getServiceSupabase();

  // Insert in batches of 500
  const batchSize = 500;
  let totalInserted = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { data, error } = await supabase.from(table).insert(batch as any).select();

    if (error) {
      errors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${error.message}`);
    } else {
      totalInserted += data?.length || 0;
    }
  }

  if (errors.length > 0) {
    return NextResponse.json({ inserted: totalInserted, errors }, { status: 207 });
  }

  return NextResponse.json({ inserted: totalInserted }, { status: 201 });
}
