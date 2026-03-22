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
import { fetchMessages, fetchAllFolders, markAsRead, deleteMessage, moveMessage } from '@/lib/microsoft-graph';
import { matchEmailToProject, type PreloadedMatchData } from '@/lib/email-matching';
import type { GraphMessage } from '@/lib/microsoft-graph';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const supabase = getServiceSupabase();
  const url = new URL(request.url);

  const folderId = url.searchParams.get('folder_id') ?? undefined;
  const skip = parseInt(url.searchParams.get('skip') ?? '0', 10);
  const top = parseInt(url.searchParams.get('top') ?? '25', 10);
  const dateFrom = url.searchParams.get('date_from') ?? undefined;
  const dateTo = url.searchParams.get('date_to') ?? undefined;
  const filter = url.searchParams.get('filter'); // 'all'|'tagged'|'untagged'|'followup'
  const projectId = url.searchParams.get('project_id');
  const doSync = url.searchParams.get('sync') !== 'false'; // default true

  // ── Sync from Graph API ──────────────────────────────────────────────────
  if (doSync) {
    try {
      await syncEmails({ top: 25, dateFrom, dateTo }, supabase);
    } catch (err) {
      // If NOT_CONNECTED, let caller handle it
      if (err instanceof Error && err.message === 'NOT_CONNECTED') {
        return NextResponse.json({ error: 'NOT_CONNECTED' }, { status: 401 });
      }
      // Other Graph errors: log but still return cached data
      console.error('[emails] Graph sync error:', err);
    }
  }

  // ── Query Supabase cache ─────────────────────────────────────────────────
  let query = supabase
    .from('emails')
    .select(
      `id, message_id, subject, from_name, from_email, body_preview, body,
       received_at, is_read, project_id, match_confidence, conversation_id,
       folder_id, needs_followup, followup_due_date, is_meeting_summary, created_at,
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

  if (filter === 'tagged') query = query.not('project_id', 'is', null);
  if (filter === 'untagged') query = query.is('project_id', null);
  if (filter === 'followup') query = query.eq('needs_followup', true);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ emails: data ?? [], synced_at: new Date().toISOString() });
}

// ─── PATCH ───────────────────────────────────────────────────────────────────

export async function PATCH(request: Request) {
  const supabase = getServiceSupabase();
  const body = await request.json();
  const { id, ...updates } = body;

  if (!id) return NextResponse.json({ error: 'Missing email id' }, { status: 400 });

  // If marking as read, also mark in Graph
  if (updates.is_read === true) {
    const { data: emailRow } = await supabase
      .from('emails')
      .select('message_id')
      .eq('id', id)
      .single();
    if (emailRow?.message_id) {
      markAsRead(emailRow.message_id).catch(() => {}); // fire-and-forget
    }
  }

  const allowedFields = [
    'project_id',
    'match_confidence',
    'needs_followup',
    'followup_due_date',
    'is_read',
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

const SYNC_BATCH = 10;   // parallel upserts per round
const FOLDER_BATCH = 5;  // parallel folder fetches per round

// Folders that contain no useful email for inbox purposes
const SKIP_FOLDERS = new Set([
  'conversation history',
  'rss feeds',
  'rss subscriptions',
  'clutter',
  'sync issues',
  'outbox',
  'junk email',
  'deleted items',
]);

async function syncEmails(
  opts: { top?: number; dateFrom?: string; dateTo?: string },
  supabase: ReturnType<typeof getServiceSupabase>,
) {
  const dateFrom =
    opts.dateFrom ??
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // ── 1. Fetch all folders + lookup data in parallel ───────────────────────
  const [allFolders, projectsRes, vendorsRes, rulesRes] = await Promise.all([
    fetchAllFolders('default'),
    supabase
      .from('projects')
      .select('id, type, name, client1_name, client2_name, client1_email, client2_email, venue_name, venue_location, location, event_date, photographer')
      .in('status', ['active', 'completed']),
    supabase.from('vendors').select('project_id, email'),
    supabase.from('inbox_rules').select('rule_type, value, action'),
  ]);

  const projects = (projectsRes.data ?? []) as PreloadedMatchData['projects'];

  // ── 2. Find Receipts folder + build folder → project map ────────────────
  const receiptsFolderId =
    allFolders.find(f => f.displayName.toLowerCase() === 'receipts')?.id ?? null;

  const folderProjectMap = new Map<string, string>(); // folder_id → project_id
  const NUMBER_PREFIX = /^\d+\s*-\s*/;

  for (const folder of allFolders) {
    if (!NUMBER_PREFIX.test(folder.displayName)) continue;
    const cleanName = folder.displayName.replace(NUMBER_PREFIX, '').trim().toLowerCase();
    const project = projects.find(p => p.name.toLowerCase() === cleanName);
    if (project) folderProjectMap.set(folder.id, project.id);
  }

  // ── 3. Filter to folders worth syncing ───────────────────────────────────
  const foldersToSync = allFolders.filter(
    f => !SKIP_FOLDERS.has(f.displayName.toLowerCase()),
  );

  // ── 4. Fetch messages from all folders in parallel batches ───────────────
  const allPairs: Array<{ msg: import('@/lib/microsoft-graph').GraphMessage; folderId: string }> = [];
  const seen = new Set<string>();

  for (let i = 0; i < foldersToSync.length; i += FOLDER_BATCH) {
    const folderBatch = foldersToSync.slice(i, i + FOLDER_BATCH);
    const results = await Promise.allSettled(
      folderBatch.map(folder =>
        fetchMessages({ folderId: folder.id, top: opts.top ?? 20, dateFrom }, 'default').then(
          ({ messages }) =>
            messages.map(msg => ({ msg, folderId: folder.id })),
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

  if (!allPairs.length) return;

  // ── 5. Load existing email records + build helpers ───────────────────────
  const hideRules: { type: string; value: string }[] = (rulesRes.data ?? [])
    .filter(r => r.action === 'hide')
    .map(r => ({ type: r.rule_type, value: (r.value as string).toLowerCase() }));

  function matchesHideRule(fromEmail: string): boolean {
    const email = fromEmail.toLowerCase();
    const domain = email.split('@')[1] ?? '';
    return hideRules.some(
      r =>
        (r.type === 'sender' && email === r.value) ||
        (r.type === 'domain' && domain === r.value),
    );
  }

  const existingRes = await supabase
    .from('emails')
    .select('message_id, project_id, match_confidence, category')
    .in('message_id', allPairs.map(({ msg }) => msg.id));

  const existingMap = new Map<
    string,
    { project_id: string | null; match_confidence: string | null; category: string | null }
  >();
  for (const row of existingRes.data ?? []) {
    existingMap.set(row.message_id, row);
  }

  const preloaded: PreloadedMatchData = {
    projects,
    vendors: (vendorsRes.data ?? []) as PreloadedMatchData['vendors'],
  };

  // Build vendor email set for receipt exclusion check
  const vendorEmails = new Set(
    (vendorsRes.data ?? []).map(v => (v.email as string).toLowerCase()),
  );

  // ── 6. Upsert in parallel batches ────────────────────────────────────────
  for (let i = 0; i < allPairs.length; i += SYNC_BATCH) {
    const batch = allPairs.slice(i, i + SYNC_BATCH);
    await Promise.allSettled(
      batch
        .filter(({ msg }) => !matchesHideRule(msg.from?.emailAddress?.address ?? ''))
        .map(({ msg, folderId }) =>
          upsertEmail(
            msg,
            folderId,
            supabase,
            preloaded,
            existingMap,
            folderProjectMap,
            receiptsFolderId,
            vendorEmails,
          ),
        ),
    );
  }
}

async function upsertEmail(
  msg: GraphMessage,
  folderId: string,
  supabase: ReturnType<typeof getServiceSupabase>,
  preloaded: PreloadedMatchData,
  existingMap: Map<
    string,
    { project_id: string | null; match_confidence: string | null; category: string | null }
  >,
  folderProjectMap: Map<string, string>,
  receiptsFolderId: string | null,
  vendorEmails: Set<string>,
) {
  const fromEmail = msg.from?.emailAddress?.address ?? '';
  const fromName = msg.from?.emailAddress?.name ?? '';
  const isMeetingSummary = detectMeetingSummary(fromEmail, msg.subject ?? '');

  const existing = existingMap.get(msg.id);
  let projectId: string | null = existing?.project_id ?? null;
  let confidence: string | null = existing?.match_confidence ?? null;

  // Folder-based match is the strongest signal — apply unless already confirmed
  const folderProjectId = folderProjectMap.get(folderId) ?? null;
  if (folderProjectId && existing?.match_confidence !== 'exact') {
    projectId = folderProjectId;
    confidence = 'exact';
  } else if (!projectId || confidence === 'suggested') {
    // Fall back to content-based matching
    const match = await matchEmailToProject(
      fromEmail,
      msg.subject ?? '',
      msg.body?.content ?? msg.bodyPreview ?? '',
      msg.conversationId,
      supabase,
      preloaded,
    );

    const shouldApply =
      !existing?.project_id ||
      (match.confidence === 'exact' && existing.match_confidence !== 'exact') ||
      (match.confidence === 'high' && !['exact'].includes(existing.match_confidence ?? '')) ||
      (match.confidence === 'thread' && !['exact', 'high'].includes(existing.match_confidence ?? ''));

    if (shouldApply && match.projectId) {
      projectId = match.projectId;
      confidence = match.confidence;
    }
  }

  // ── Receipt detection ────────────────────────────────────────────────────
  const alreadyReceipt = existing?.category === 'receipt';
  const isReceipt =
    alreadyReceipt ||
    (!projectId &&
      detectReceipt(fromEmail, msg.subject ?? '', vendorEmails));

  const extraFields: Record<string, unknown> = {};
  if (isReceipt) {
    extraFields.category = 'receipt';
    extraFields.dismissed = true;
  }

  await supabase.from('emails').upsert(
    {
      message_id: msg.id,
      subject: msg.subject,
      from_name: fromName,
      from_email: fromEmail,
      body_preview: msg.bodyPreview,
      body: msg.body?.content ?? null,
      received_at: msg.receivedDateTime,
      is_read: msg.isRead,
      conversation_id: msg.conversationId,
      folder_id: folderId,
      project_id: projectId,
      match_confidence: confidence,
      is_meeting_summary: isMeetingSummary,
      ...extraFields,
    },
    { onConflict: 'message_id' },
  );

  // Move to Receipts folder in Outlook (fire-and-forget, only if not already there)
  if (isReceipt && !alreadyReceipt && receiptsFolderId && folderId !== receiptsFolderId) {
    moveMessage(msg.id, receiptsFolderId).catch(err =>
      console.error('[emails] receipt move error:', err),
    );
  }
}

// ─── Receipt detection ────────────────────────────────────────────────────────

const RECEIPT_SENDER_DOMAINS = new Set([
  'anthropic.com',
  'vercel.com',
  'adobe.com',
  'canva.com',
  'notion.so',
  'figma.com',
  'zapier.com',
  'google.com',
  'microsoft.com',
  'flodesk.com',
  'honeybook.com',
  'aisle-planner.com',
]);

const RECEIPT_SUBJECT_BILLING_WORDS = ['renewal', 'renewed', 'billed', 'charge', 'receipt', 'confirmed'];

function detectReceipt(
  fromEmail: string,
  subject: string,
  vendorEmails: Set<string>,
): boolean {
  const email = fromEmail.toLowerCase();
  const subj = subject.toLowerCase();

  // Never treat vendor emails as receipts
  if (vendorEmails.has(email)) return false;

  // Never treat invoices as receipts
  if (subj.includes('invoice')) return false;

  // Sender-domain-based detection
  const domain = email.split('@')[1] ?? '';
  if (RECEIPT_SENDER_DOMAINS.has(domain)) return true;

  // Subject-based detection: must contain "subscription" + at least one billing word
  if (
    subj.includes('subscription') &&
    RECEIPT_SUBJECT_BILLING_WORDS.some(w => subj.includes(w))
  ) {
    return true;
  }

  return false;
}

// ─── Meeting summary detection ──────────────────────────────────────────────

const ZOOM_NOREPLY_PATTERNS = [
  'no-reply@zoom.us',
  'noreply@zoom.us',
  'no_reply@zoom.us',
];

function detectMeetingSummary(fromEmail: string, subject: string): boolean {
  const email = fromEmail.toLowerCase();
  const subj = subject.toLowerCase();

  // Zoom AI Companion summaries: from no-reply@zoom.us with "Meeting Summary:" prefix
  const isZoom = ZOOM_NOREPLY_PATTERNS.some(p => email.includes(p)) || email.endsWith('@zoom.us');
  if (isZoom && subj.includes('meeting summary')) return true;

  // Also catch generic meeting summary patterns from Zoom
  if (isZoom && (subj.includes('summary') || subj.includes('recap'))) return true;

  return false;
}
