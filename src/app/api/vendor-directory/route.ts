import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const supabase = getServiceSupabase();
  const category = req.nextUrl.searchParams.get('category');
  const search = req.nextUrl.searchParams.get('search');

  let query = supabase.from('vendor_directory').select('*').order('name');

  if (category) {
    query = query.eq('category', category);
  }
  if (search) {
    query = query.or(`name.ilike.%${search}%,company.ilike.%${search}%`);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const supabase = getServiceSupabase();
  const body = await req.json();
  const rows = Array.isArray(body) ? body : [body];

  const { data, error } = await supabase.from('vendor_directory').insert(rows).select();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(Array.isArray(body) ? data : data[0], { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const supabase = getServiceSupabase();
  const body = await req.json();
  const { id, ...updates } = body;

  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const { data, error } = await supabase
    .from('vendor_directory')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const supabase = getServiceSupabase();
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const { error } = await supabase.from('vendor_directory').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
