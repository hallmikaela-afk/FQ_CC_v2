/**
 * /api/emails/folders
 *
 * GET — Fetches mail folders from Graph, stores/updates in Supabase, returns list.
 */

import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { fetchFolders, fetchChildFolders } from '@/lib/microsoft-graph';
import type { GraphFolder } from '@/lib/microsoft-graph';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = getServiceSupabase();

  let topLevel: GraphFolder[];
  try {
    topLevel = await fetchFolders('default');
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

  // Always fetch Inbox child folders using the well-known name 'inbox'.
  // This reliably returns client project folders and Receipts even when
  // Graph reports childFolderCount = 0 on the Inbox row.
  let inboxChildren: GraphFolder[] = [];
  try {
    inboxChildren = await fetchChildFolders('inbox', 'default');
  } catch {
    // Non-fatal — top-level folders still returned
  }

  // Deduplicate: inboxChildren may overlap with topLevel if Graph already
  // included them there (unlikely but safe to guard against).
  const topLevelIds = new Set(topLevel.map(f => f.id));
  const newChildren = inboxChildren.filter(f => !topLevelIds.has(f.id));

  const allFolders = [...topLevel, ...newChildren];

  // Upsert into Supabase cache
  const rows = allFolders.map(f => ({
    folder_id:        f.id,
    display_name:     f.displayName,
    total_count:      f.totalItemCount  ?? 0,
    unread_count:     f.unreadItemCount ?? 0,
    parent_folder_id: f.parentFolderId  ?? null,
  }));

  await supabase
    .from('mail_folders')
    .upsert(rows, { onConflict: 'folder_id' });

  return NextResponse.json({ folders: rows });
}
