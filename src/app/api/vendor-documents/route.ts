import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const supabase = getServiceSupabase();
  const vendorId = req.nextUrl.searchParams.get('vendor_id');
  const docType = req.nextUrl.searchParams.get('doc_type');

  if (!vendorId) return NextResponse.json({ error: 'vendor_id required' }, { status: 400 });

  let query = supabase
    .from('vendor_documents')
    .select('*')
    .eq('vendor_id', vendorId)
    .order('created_at', { ascending: false });

  if (docType) {
    query = query.eq('doc_type', docType);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const supabase = getServiceSupabase();
  const body = await req.json();
  const { vendor_id, display_name, drive_url, drive_file_id, doc_type, status, date, notes } = body;

  if (!vendor_id || !display_name) {
    return NextResponse.json({ error: 'vendor_id and display_name are required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('vendor_documents')
    .insert({
      vendor_id,
      display_name,
      drive_url: drive_url || null,
      drive_file_id: drive_file_id || null,
      doc_type: doc_type || 'Other',
      status: status || 'Unsigned',
      date: date || null,
      notes: notes || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const supabase = getServiceSupabase();
  const body = await req.json();
  const { id, ...updates } = body;

  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const { data, error } = await supabase
    .from('vendor_documents')
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

  const { error } = await supabase.from('vendor_documents').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
