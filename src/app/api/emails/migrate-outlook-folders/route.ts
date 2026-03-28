/**
 * POST /api/emails/migrate-outlook-folders
 *
 * One-time SSE migration: finds every email that has a project_id but whose
 * current folder_id does not match the project's outlook_folder_id, then moves
 * each one in Outlook and updates the DB record.
 *
 * Streams progress events:
 *   data: { total: number; moved: number }        — progress
 *   data: { total: number; moved: number; done: true }  — complete
 *   data: { error: string }                        — fatal error
 */

import { getServiceSupabase } from '@/lib/supabase';
import { moveMessage } from '@/lib/microsoft-graph';

export const dynamic     = 'force-dynamic';
export const maxDuration = 300;

export async function POST() {
  const supabase = getServiceSupabase();
  const encoder  = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: object) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        } catch { /* client disconnected */ }
      };

      try {
        // ── 1. Load all projects with an outlook_folder_id ──────────────────
        const { data: projects } = await supabase
          .from('projects')
          .select('id, outlook_folder_id')
          .not('outlook_folder_id', 'is', null);

        if (!projects?.length) {
          send({ total: 0, moved: 0, done: true });
          controller.close();
          return;
        }

        // Build project_id → outlook_folder_id map
        const projectFolderMap = new Map<string, string>();
        for (const p of projects) {
          if (p.outlook_folder_id) projectFolderMap.set(p.id, p.outlook_folder_id);
        }

        // ── 2. Find emails that are mismatched ───────────────────────────────
        const { data: emails } = await supabase
          .from('emails')
          .select('id, message_id, project_id, folder_id')
          .not('project_id', 'is', null)
          .not('message_id', 'is', null);

        const mismatched = (emails ?? []).filter(e => {
          const targetFolder = projectFolderMap.get(e.project_id!);
          return targetFolder && e.folder_id !== targetFolder;
        });

        const total = mismatched.length;
        let moved = 0;
        send({ total, moved });

        // ── 3. Move each mismatched email ────────────────────────────────────
        const BATCH = 5;
        for (let i = 0; i < mismatched.length; i += BATCH) {
          const batch = mismatched.slice(i, i + BATCH);
          await Promise.allSettled(
            batch.map(async (email) => {
              const targetFolderId = projectFolderMap.get(email.project_id!)!;
              try {
                await moveMessage(email.message_id!, targetFolderId);
                await supabase
                  .from('emails')
                  .update({ folder_id: targetFolderId })
                  .eq('id', email.id);
              } catch (err) {
                console.error('[migrate-outlook-folders] move error:', err);
              }
            }),
          );
          moved += batch.length;
          send({ total, moved });
        }

        send({ total, moved, done: true });
      } catch (err) {
        send({ error: String(err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
    },
  });
}
