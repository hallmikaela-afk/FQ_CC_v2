/**
 * /api/emails/reassign
 *
 * POST — Reassign an email to a different project (or untagge it).
 *        Updates Supabase and moves the email to the matching Outlook folder.
 */

import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { moveMessage } from '@/lib/microsoft-graph';

export const dynamic = 'force-dynamic';

const NUMBER_PREFIX = /^\d+\s*-\s*/;

export async function POST(request: Request) {
  const supabase = getServiceSupabase();
  const body = await request.json();
  const { email_id, project_id } = body as { email_id: string; project_id: string | null };

  if (!email_id) {
    return NextResponse.json({ error: 'Missing email_id' }, { status: 400 });
  }

  // ── 1. Fetch email's message_id from Supabase ─────────────────────────────
  const { data: emailRow } = await supabase
    .from('emails')
    .select('message_id')
    .eq('id', email_id)
    .single();

  // ── 2. Update Supabase ────────────────────────────────────────────────────
  const { error: updateError } = await supabase
    .from('emails')
    .update({
      project_id: project_id ?? null,
      match_confidence: project_id ? 'exact' : null,
      dismissed: false,          // always surface after explicit reassignment
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
          // Look up the project name
          const { data: project } = await supabase
            .from('projects')
            .select('name')
            .eq('id', project_id)
            .single();

          if (project) {
            // Find the matching Outlook folder by the number-prefix naming convention
            const { data: folders } = await supabase
              .from('mail_folders')
              .select('folder_id, display_name');

            const target = folders?.find((f) => {
              const cleanName = f.display_name
                .replace(NUMBER_PREFIX, '')
                .trim()
                .toLowerCase();
              return cleanName === project.name.toLowerCase();
            });

            if (target) {
              await moveMessage(emailRow.message_id, target.folder_id);
            }
          }
        } else {
          // Untagged → move back to Inbox well-known folder
          await moveMessage(emailRow.message_id, 'inbox');
        }
      } catch (err) {
        console.error('[reassign] Graph move error:', err);
      }
    })();
  }

  return NextResponse.json({ success: true });
}
