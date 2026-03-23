/**
 * /api/emails/reassign
 *
 * POST — Reassign an email to a different project (or un-tag it).
 *        Updates Supabase and moves the email to the project's Outlook folder.
 *
 * Body: { email_id: string; project_id: string | null }
 */

import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { moveMessage } from '@/lib/microsoft-graph';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const supabase = getServiceSupabase();
  const body = await request.json();
  const { email_id, project_id } = body as { email_id: string; project_id: string | null };

  if (!email_id) {
    return NextResponse.json({ error: 'Missing email_id' }, { status: 400 });
  }

  // ── 1. Fetch the email's message_id and current folder_id ─────────────────
  const { data: emailRow } = await supabase
    .from('emails')
    .select('message_id, folder_id')
    .eq('id', email_id)
    .single();

  // ── 2. Update Supabase ────────────────────────────────────────────────────
  const { error: updateError } = await supabase
    .from('emails')
    .update({
      project_id:       project_id ?? null,
      match_confidence: project_id ? 'exact' : null,
      dismissed:        false,
    })
    .eq('id', email_id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // ── 3. Move email in Outlook (fire-and-forget) ────────────────────────────
  if (emailRow?.message_id) {
    (async () => {
      try {
        if (project_id) {
          // Use the project's stored outlook_folder_id — no name-matching needed
          const { data: project } = await supabase
            .from('projects')
            .select('outlook_folder_id')
            .eq('id', project_id)
            .single();

          const targetFolderId = project?.outlook_folder_id;
          if (targetFolderId && emailRow.folder_id !== targetFolderId) {
            await moveMessage(emailRow.message_id, targetFolderId);
            // Keep folder_id in sync with where the email actually lives
            await supabase
              .from('emails')
              .update({ folder_id: targetFolderId })
              .eq('id', email_id);
          }
        } else {
          // Un-tagged → move back to Inbox
          await moveMessage(emailRow.message_id, 'inbox');
          await supabase
            .from('emails')
            .update({ folder_id: 'inbox' })
            .eq('id', email_id);
        }
      } catch (err) {
        console.error('[reassign] Graph move error:', err);
      }
    })();
  }

  return NextResponse.json({ success: true });
}
