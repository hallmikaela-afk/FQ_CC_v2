/**
 * POST /api/projects/sync-outlook-folders
 *
 * Fetches the Inbox child folders from Outlook, matches each one to a project
 * by stripping the number prefix ("1 - Julia & Frank" → "Julia & Frank"), and
 * updates projects.outlook_folder_id for every match.
 *
 * Safe to call repeatedly — only updates rows where the value has changed.
 * Returns: { updated: number; mappings: Array<{ project_name, folder_id }> }
 */

import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { fetchChildFolders } from '@/lib/microsoft-graph';

export const dynamic    = 'force-dynamic';
export const maxDuration = 30;

const NUMBER_PREFIX = /^\d+\s*[-–]\s*/;

export async function POST() {
  const supabase = getServiceSupabase();

  try {
    // ── 1. Fetch Outlook inbox child folders ────────────────────────────────
    const inboxFolders = await fetchChildFolders('inbox', 'default');

    // ── 2. Fetch all active/completed projects ──────────────────────────────
    const { data: projects, error: projectsErr } = await supabase
      .from('projects')
      .select('id, name, outlook_folder_id')
      .in('status', ['active', 'completed', 'planning']);

    if (projectsErr) {
      return NextResponse.json({ error: projectsErr.message }, { status: 500 });
    }

    // ── 3. Match folders to projects ─────────────────────────────────────────
    const mappings: Array<{ project_name: string; project_id: string; folder_id: string }> = [];

    for (const folder of inboxFolders) {
      const cleanName = folder.displayName.replace(NUMBER_PREFIX, '').trim().toLowerCase();
      const match = (projects ?? []).find(p => p.name.trim().toLowerCase() === cleanName);
      if (match && match.outlook_folder_id !== folder.id) {
        mappings.push({ project_name: match.name, project_id: match.id, folder_id: folder.id });
      }
    }

    // ── 4. Update projects in DB ──────────────────────────────────────────────
    await Promise.all(
      mappings.map(({ project_id, folder_id }) =>
        supabase
          .from('projects')
          .update({ outlook_folder_id: folder_id })
          .eq('id', project_id),
      ),
    );

    return NextResponse.json({
      updated:  mappings.length,
      mappings: mappings.map(m => ({ project_name: m.project_name, folder_id: m.folder_id })),
    });
  } catch (err) {
    // NOT_CONNECTED — Outlook not linked yet, silently ignore
    if (err instanceof Error && err.message === 'NOT_CONNECTED') {
      return NextResponse.json({ updated: 0, mappings: [] });
    }
    console.error('[sync-outlook-folders]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
