import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = getServiceSupabase();
  const { id } = params;

  const { data, error } = await supabase
    .from('vendor_directory')
    .select(`
      *,
      vendor_contacts(*),
      vendor_documents(*),
      vendor_project_links(*, projects(id, name, slug, color))
    `)
    .eq('id', id)
    .single();

  if (error) {
    const status = error.code === 'PGRST116' ? 404 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }

  return NextResponse.json(data);
}
