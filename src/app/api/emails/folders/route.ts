/**
 * /api/emails/folders
 *
 * GET — Fetches mail folders from Graph, stores/updates in Supabase, returns list.
 */

import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { fetchFolders } from '@/lib/microsoft-graph';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = getServiceSupabase();

  let graphFolders;
  try {
    graphFolders = await fetchFolders('default');
  } catch (err) {
    if (err instanceof Error && err.message === 'NOT_CONNECTED') {
      return NextResponse.json({ error: 'NOT_CONNECTED' }, { status: 401 });
    }
    // Return cached folders if Graph fails
    const { data } = await supabase
      .from('mail_folders')
      .select('*')
      .order('display_name');
    return NextResponse.json({ folders: data ?? [], cached: true });
  }

  // Upsert folders into Supabase
  const rows = graphFolders.map(f => ({
    folder_id: f.id,
    display_name: f.displayName,
    total_count: f.totalItemCount ?? 0,
    unread_count: f.unreadItemCount ?? 0,
    parent_folder_id: f.parentFolderId ?? null,
  }));

  await supabase
    .from('mail_folders')
    .upsert(rows, { onConflict: 'folder_id' });

  return NextResponse.json({ folders: rows });
}
