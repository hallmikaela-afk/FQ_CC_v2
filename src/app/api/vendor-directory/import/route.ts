import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

interface VendorImportRow {
  name: string;
  company?: string;
  category: string;
  email?: string;
  phone?: string;
  instagram?: string;
  website?: string;
  notes?: string;
}

export async function POST(req: NextRequest) {
  const supabase = getServiceSupabase();
  const body = await req.json();
  const rows: VendorImportRow[] = body.rows;

  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'rows array is required' }, { status: 400 });
  }

  let inserted = 0;
  let updated = 0;
  const errors: { row: number; error: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    if (!row.name?.trim() || !row.category?.trim()) {
      errors.push({ row: i, error: 'name and category are required' });
      continue;
    }

    const payload = {
      name: row.name.trim(),
      company: row.company?.trim() || null,
      category: row.category.trim(),
      email: row.email?.trim() || null,
      phone: row.phone?.trim() || null,
      instagram: row.instagram?.trim() || null,
      website: row.website?.trim() || null,
      notes: row.notes?.trim() || null,
    };

    // Upsert by name + category — re-importing the same AP export updates rather than duplicates
    const { data: existing } = await supabase
      .from('vendor_directory')
      .select('id')
      .eq('name', payload.name)
      .eq('category', payload.category)
      .maybeSingle();

    if (existing?.id) {
      const { error } = await supabase
        .from('vendor_directory')
        .update(payload)
        .eq('id', existing.id);
      if (error) {
        errors.push({ row: i, error: error.message });
      } else {
        updated++;
      }
    } else {
      const { error } = await supabase.from('vendor_directory').insert(payload);
      if (error) {
        errors.push({ row: i, error: error.message });
      } else {
        inserted++;
      }
    }
  }

  return NextResponse.json({ inserted, updated, errors });
}
