/**
 * /api/emails
 *
 * GET    — Returns emails from Supabase cache. Triggers a Graph sync if stale.
 *          Query params: folder_id, skip, top, date_from, date_to, filter, project_id
 * PATCH  — Update a single email (project assignment, needs_followup, is_read)
 * DELETE — Remove an email from Supabase and optionally from Outlook
 */

import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { markAsRead, markAsUnread, deleteMessage } from '@/lib/microsoft-graph';
import {
  FOLDER_BATCH,
  buildSyncContext, upsertBatch,
  fetchMessages,
} from '@/lib/email-sync-helpers';
import type { GraphMessage } from '@/lib/microsoft-graph';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const supabase = getServiceSupabase();
  const url = new URL(request.url);

  const folderId = url.searchParams.get('folder_id') ?? undefined;
  const skip = parseInt(url.searchParams.get('skip') ?? '0', 10);
  const top = parseInt(url.searchParams.get('top') ?? '200', 10);
  const dateFrom = url.searchParams.get('date_from') ?? undefined;
  const dateTo = url.searchParams.get('date_to') ?? undefined;
  const filter = url.searchParams.get('filter'); // 'all'|'tagged'|'untagged'|'followup'
  const projectId = url.searchParams.get('project_id');
  const doSync = url.searchParams.get('sync') !== 'false'; // default true

  // ── Sync from Graph API ──────────────────────────────────────────────────
  let syncOk: boolean | null = null;   // null = sync not attempted
  let syncError: string | null = null;

  if (doSync) {
    syncOk = true;
    try {
      await syncEmails({ top: 50, dateFrom, dateTo }, supabase);
    } catch (err) {
      syncOk = false;
      // If NOT_CONNECTED, let caller handle it
      if (err instanceof Error && err.message === 'NOT_CONNECTED') {
        return NextResponse.json({ error: 'NOT_CONNECTED' }, { status: 401 });
      }
      // Surface a meaningful error to the client
      const errMsg = err instanceof Error ? err.message : String(err);
      if (errMsg.includes('GRAPH_ERROR_401')) {
        syncError = 'Microsoft authentication expired — please reconnect your account';
      } else if (errMsg.includes('GRAPH_ERROR_429')) {
        syncError = 'Microsoft rate limit hit — will retry shortly';
      } else if (errMsg.includes('GRAPH_ERROR_5')) {
        syncError = 'Microsoft servers temporarily unavailable';
      } else {
        syncError = `Sync error: ${errMsg}`;
      }
      console.error('[emails] Graph sync error:', err);
    }
  }

  // ── Purge any Outlook draft emails that slipped into the DB ─────────────
  // Find the Drafts folder id and delete matching rows (fire-and-forget).
  supabase
    .from('mail_folders')
    .select('folder_id')
    .ilike('display_name', 'drafts')
    .then(({ data: draftFolders }) => {
      const draftFolderIds = (draftFolders ?? []).map((f: { folder_id: string }) => f.folder_id);
      if (draftFolderIds.length > 0) {
        supabase.from('emails').delete().in('folder_id', draftFolderIds).then(() => {});
      }
    });

  // ── Query Supabase cache ─────────────────────────────────────────────────
  // Also look up draft folder IDs to exclude them from results
  const { data: draftFolderRows } = await supabase
    .from('mail_folders')
    .select('folder_id')
    .ilike('display_name', 'drafts');
  const draftFolderIds = (draftFolderRows ?? []).map((f: { folder_id: string }) => f.folder_id);

  let query = supabase
    .from('emails')
    .select(
      `id, message_id, subject, from_name, from_email, body_preview, body,
       received_at, is_read, project_id, match_confidence, conversation_id,
       folder_id, needs_followup, followup_due_date, is_meeting_summary, created_at,
       category, dismissed, resolved, draft_message_id,
       projects(id, name, type, color, event_date)`,
    )
    .order('received_at', { ascending: false })
    .range(skip, skip + top - 1);

  if (folderId) query = query.eq('folder_id', folderId);
  if (dateFrom) query = query.gte('received_at', dateFrom);
  if (dateTo) query = query.lte('received_at', dateTo);
  if (projectId) query = query.eq('project_id', projectId);

  // Never surface receipts in the main inbox view
  query = query.or('category.is.null,category.neq.receipt');

  // Dismissed filter: show dismissed emails only when explicitly requested
  if (filter === 'dismissed') {
    query = query.eq('dismissed', true);
  } else {
    query = query.or('dismissed.is.null,dismissed.eq.false');
  }

  // Exclude Outlook draft emails that may have been synced before the skip-folder fix
  if (draftFolderIds.length > 0 && !folderId) {
    query = query.not('folder_id', 'in', `(${draftFolderIds.join(',')})`);
  }

  if (filter === 'tagged') query = query.not('project_id', 'is', null);
  if (filter === 'untagged') query = query.is('project_id', null);
  if (filter === 'followup') query = query.eq('needs_followup', true);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    emails: data ?? [],
    synced_at: new Date().toISOString(),
    sync_ok: syncOk,
    sync_error: syncError,
  });
}

// ─── PATCH ───────────────────────────────────────────────────────────────────

export async function PATCH(request: Request) {
  const supabase = getServiceSupabase();
  const body = await request.json();
  const { id, ...updates } = body;

  if (!id) return NextResponse.json({ error: 'Missing email id' }, { status: 400 });

  // If changing read status, sync to Graph
  if (updates.is_read === true || updates.is_read === false) {
    const { data: emailRow } = await supabase
      .from('emails')
      .select('message_id')
      .eq('id', id)
      .single();
    if (emailRow?.message_id) {
      if (updates.is_read) {
        markAsRead(emailRow.message_id).catch(() => {}); // fire-and-forget
      } else {
        markAsUnread(emailRow.message_id).catch(() => {}); // fire-and-forget
      }
    }
  }

  const allowedFields = [
    'project_id',
    'match_confidence',
    'needs_followup',
    'followup_due_date',
    'is_read',
    'resolved',
    'dismissed',
    'category',
  ];
  const safeUpdates: Record<string, unknown> = {};
  for (const key of allowedFields) {
    if (key in updates) safeUpdates[key] = updates[key];
  }

  const { data, error } = await supabase
    .from('emails')
    .update(safeUpdates)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ email: data });
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function DELETE(request: Request) {
  const supabase = getServiceSupabase();
  const body = await request.json();
  const { id, delete_from_outlook } = body;

  if (!id) return NextResponse.json({ error: 'Missing email id' }, { status: 400 });

  // Look up message_id before deleting (needed for Graph API call)
  const { data: emailRow } = await supabase
    .from('emails')
    .select('message_id')
    .eq('id', id)
    .single();

  // Remove from Supabase
  const { error } = await supabase.from('emails').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Optionally delete from Outlook (fire-and-forget — don't fail if Graph errors)
  if (delete_from_outlook && emailRow?.message_id) {
    deleteMessage(emailRow.message_id).catch(err =>
      console.error('[emails] Graph delete error:', err),
    );
  }

  return NextResponse.json({ deleted: true });
}

// ─── Sync helper ──────────────────────────────────────────────────────────────

async function syncEmails(
  opts: { top?: number; dateFrom?: string; dateTo?: string },
  supabase: ReturnType<typeof getServiceSupabase>,
) {
  // Incremental sync: only fetch emails newer than the most recent one in DB.
  // Falls back to 30 days on first run (before initial-sync completes).
  let dateFrom = opts.dateFrom;
  if (!dateFrom) {
    const { data: newest } = await supabase
      .from('emails')
      .select('received_at')
      .order('received_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    dateFrom = newest?.received_at
      ? new Date(new Date(newest.received_at).getTime() - 48 * 60 * 60_000).toISOString()
      : new Date(Date.now() - 30 * 24 * 60 * 60_000).toISOString();
  }

  const ctx = await buildSyncContext(supabase);
  const seen = new Set<string>();
  const allPairs: Array<{ msg: GraphMessage; folderId: string }> = [];
  let totalAttempts = 0;
  let totalFailed = 0;

  for (let i = 0; i < ctx.foldersToSync.length; i += FOLDER_BATCH) {
    const batch = ctx.foldersToSync.slice(i, i + FOLDER_BATCH);
    const results = await Promise.allSettled(
      batch.map(folder =>
        fetchMessages({ folderId: folder.id, top: opts.top ?? 25, dateFrom }, 'default').then(
          ({ messages }) => messages.map(msg => ({ msg, folderId: folder.id })),
        ),
      ),
    );
    totalAttempts += results.length;
    for (const result of results) {
      if (result.status !== 'fulfilled') {
        totalFailed++;
        continue;
      }
      for (const pair of result.value) {
        if (seen.has(pair.msg.id)) continue;
        seen.add(pair.msg.id);
        allPairs.push(pair);
      }
    }
  }

  // If every folder fetch failed, surface the error instead of silently returning 0 results
  if (totalFailed > 0 && totalFailed === totalAttempts) {
    throw new Error(`All ${totalFailed} folder fetches failed — check Microsoft connection`);
  }

  if (!allPairs.length) return;

  await upsertBatch(
    allPairs, supabase, ctx.preloaded, ctx.folderProjectMap,
    ctx.receiptsFolderId, ctx.inquiriesFolderId, ctx.vendorEmails, ctx.matchesHideRule, ctx.projectOutlookFolderMap,
  );
}
