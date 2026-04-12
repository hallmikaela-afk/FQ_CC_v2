import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const supabase = getServiceSupabase();
  const body = await req.json();
  const { vendor_id, name, title, email, phone, is_primary } = body;

  if (!vendor_id || !name) {
    return NextResponse.json({ error: 'vendor_id and name are required' }, { status: 400 });
  }

  // If setting as primary, clear all other primaries for this vendor first
  if (is_primary) {
    await supabase
      .from('vendor_contacts')
      .update({ is_primary: false })
      .eq('vendor_id', vendor_id);
  }

  const { data, error } = await supabase
    .from('vendor_contacts')
    .insert({ vendor_id, name, title: title || null, email: email || null, phone: phone || null, is_primary: is_primary ?? false })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const supabase = getServiceSupabase();
  const body = await req.json();
  const { id, vendor_id, is_primary, ...updates } = body;

  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  // Enforce single-primary: clear others before setting this one
  if (is_primary && vendor_id) {
    await supabase
      .from('vendor_contacts')
      .update({ is_primary: false })
      .eq('vendor_id', vendor_id)
      .neq('id', id);
  }

  const { data, error } = await supabase
    .from('vendor_contacts')
    .update({ ...updates, ...(is_primary !== undefined ? { is_primary } : {}) })
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

  const { error } = await supabase.from('vendor_contacts').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
