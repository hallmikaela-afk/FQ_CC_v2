/**
 * POST /api/emails/load-more
 *
 * Fetches up to 50 emails per folder that are older than the given cursor date,
 * upserts them into Supabase, and returns the new oldest date.
 *
 * Body:  { before_date: string }  – ISO date string (the current sync cursor)
 * Returns: { loaded_count: number; oldest_date: string | null; done: boolean }
 */

import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import {
  FOLDER_BATCH,
  buildSyncContext, upsertBatch, fetchMessages,
} from '@/lib/email-sync-helpers';
import type { GraphMessage } from '@/lib/microsoft-graph';

export const dynamic     = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: Request) {
  const supabase = getServiceSupabase();

  const body = await request.json().catch(() => ({}));
  const beforeDate: string | undefined = body?.before_date;

  if (!beforeDate) {
    return NextResponse.json({ error: 'before_date is required' }, { status: 400 });
  }

  try {
    // Use dateTo = 1 ms before the cursor so we don't re-fetch the cursor email
    const dateTo  = new Date(new Date(beforeDate).getTime() - 1).toISOString();
    const ctx     = await buildSyncContext(supabase);
    const seen    = new Set<string>();
    const allPairs: Array<{ msg: GraphMessage; folderId: string }> = [];

    for (let i = 0; i < ctx.foldersToSync.length; i += FOLDER_BATCH) {
      const batch   = ctx.foldersToSync.slice(i, i + FOLDER_BATCH);
      const results = await Promise.allSettled(
        batch.map(folder =>
          fetchMessages({ folderId: folder.id, top: 50, dateTo }, 'default').then(
            ({ messages }) => messages.map(msg => ({ msg, folderId: folder.id })),
          ),
        ),
      );
      for (const result of results) {
        if (result.status !== 'fulfilled') continue;
        for (const pair of result.value) {
          if (seen.has(pair.msg.id)) continue;
          seen.add(pair.msg.id);
          allPairs.push(pair);
        }
      }
    }

    const loadedCount = await upsertBatch(
      allPairs, supabase, ctx.preloaded, ctx.folderProjectMap,
      ctx.receiptsFolderId, ctx.vendorEmails, ctx.matchesHideRule,
    );

    // Find the new oldest date across the fetched batch
    let oldestDate: string | null = null;
    if (allPairs.length > 0) {
      const dates = allPairs.map(p => p.msg.receivedDateTime).filter(Boolean);
      if (dates.length > 0) {
        oldestDate = dates.reduce((a, b) => (a < b ? a : b));
      }
    }

    return NextResponse.json({
      loaded_count: loadedCount,
      oldest_date:  oldestDate,
      done:         allPairs.length === 0,
    });
  } catch (err) {
    console.error('[load-more] error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
