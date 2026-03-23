/**
 * POST /api/emails/initial-sync
 *
 * Fetches the last 90 days of emails from all Outlook folders using paginated
 * Graph API calls ($top=50, $skip increments per folder).  Progress is streamed
 * as SSE so the client can show a live "Loading email history… N emails loaded"
 * counter.
 *
 * The client should call this once, then store 'inbox_initial_sync_done' in
 * localStorage to avoid repeating it on subsequent page loads.
 */

import { getServiceSupabase } from '@/lib/supabase';
import {
  FOLDER_BATCH,
  buildSyncContext, upsertBatch, fetchMessages,
} from '@/lib/email-sync-helpers';
import type { GraphMessage } from '@/lib/microsoft-graph';

export const dynamic    = 'force-dynamic';
export const maxDuration = 60;

export async function POST() {
  const supabase = getServiceSupabase();
  const encoder  = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: object) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        } catch {
          // client disconnected
        }
      };

      try {
        const dateFrom = new Date(Date.now() - 90 * 24 * 60 * 60_000).toISOString();
        const ctx      = await buildSyncContext(supabase);

        // Per-folder pagination: track which folders still have more pages
        type Folder = (typeof ctx.foldersToSync)[number];
        let foldersRemaining: Folder[] = [...ctx.foldersToSync];
        let skip         = 0;
        let totalLoaded  = 0;
        const seen       = new Set<string>();

        while (foldersRemaining.length > 0) {
          const nextRemaining: Folder[] = [];

          // Process folders in parallel batches of FOLDER_BATCH
          for (let i = 0; i < foldersRemaining.length; i += FOLDER_BATCH) {
            const batch   = foldersRemaining.slice(i, i + FOLDER_BATCH);
            const results = await Promise.allSettled(
              batch.map(folder =>
                fetchMessages({ folderId: folder.id, top: 50, dateFrom, skip }, 'default').then(
                  ({ messages }) => ({ folder, messages }),
                ),
              ),
            );

            const pairs: Array<{ msg: GraphMessage; folderId: string }> = [];

            for (const result of results) {
              if (result.status !== 'fulfilled') continue;
              const { folder, messages } = result.value;

              for (const msg of messages) {
                if (seen.has(msg.id)) continue;
                seen.add(msg.id);
                pairs.push({ msg, folderId: folder.id });
              }

              // If we got a full page, this folder may have more
              if (messages.length === 50) nextRemaining.push(folder);
            }

            if (pairs.length > 0) {
              const count = await upsertBatch(
                pairs, supabase, ctx.preloaded, ctx.folderProjectMap,
                ctx.receiptsFolderId, ctx.vendorEmails, ctx.matchesHideRule, ctx.projectOutlookFolderMap,
              );
              totalLoaded += count;
              send({ count: totalLoaded });
            }
          }

          foldersRemaining = nextRemaining;
          skip += 50;
        }

        // Record the oldest email date as cursor for "Load more"
        const { data: oldest } = await supabase
          .from('emails')
          .select('received_at')
          .order('received_at', { ascending: true })
          .limit(1)
          .maybeSingle();

        send({ count: totalLoaded, done: true, oldest_date: oldest?.received_at ?? null });
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
