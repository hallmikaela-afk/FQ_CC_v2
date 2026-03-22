/**
 * /api/emails
 *
 * GET  — Returns emails from Supabase cache. Triggers a Graph sync if stale.
 *        Query params: folder_id, skip, top, date_from, date_to, filter, project_id
 * PATCH — Update a single email (project assignment, needs_followup, is_read)
 */

import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { fetchMessages, markAsRead } from '@/lib/microsoft-graph';
import { matchEmailToProject } from '@/lib/email-matching';
import type { GraphMessage } from '@/lib/microsoft-graph';

export const dynamic = 'force-dynamic';

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const supabase = getServiceSupabase();
  const url = new URL(request.url);

  const folderId = url.searchParams.get('folder_id') ?? undefined;
  const skip = parseInt(url.searchParams.get('skip') ?? '0', 10);
  const top = parseInt(url.searchParams.get('top') ?? '50', 10);
  const dateFrom = url.searchParams.get('date_from') ?? undefined;
  const dateTo = url.searchParams.get('date_to') ?? undefined;
  const filter = url.searchParams.get('filter'); // 'all'|'tagged'|'untagged'|'followup'
  const projectId = url.searchParams.get('project_id');
  const doSync = url.searchParams.get('sync') !== 'false'; // default true

  // ── Sync from Graph API ──────────────────────────────────────────────────
  if (doSync) {
    try {
      await syncEmails({ folderId, top: 50, dateFrom, dateTo }, supabase);
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

// ─── Sync helper ──────────────────────────────────────────────────────────────

async function syncEmails(
  opts: { folderId?: string; top?: number; dateFrom?: string; dateTo?: string },
  supabase: ReturnType<typeof getServiceSupabase>,
) {
  // Default: last 90 days for initial sync if no date specified
  const dateFrom =
    opts.dateFrom ??
    new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  const { messages } = await fetchMessages(
    { ...opts, dateFrom, top: opts.top ?? 50 },
    'default',
  );

  if (!messages.length) return;

  // Upsert each message
  for (const msg of messages) {
    await upsertEmail(msg, opts.folderId ?? msg.parentFolderId, supabase);
  }
}

async function upsertEmail(
  msg: GraphMessage,
  folderId: string,
  supabase: ReturnType<typeof getServiceSupabase>,
) {
  const fromEmail = msg.from?.emailAddress?.address ?? '';
  const fromName = msg.from?.emailAddress?.name ?? '';

  // Detect Zoom AI Companion meeting summaries
  const isMeetingSummary = detectMeetingSummary(fromEmail, msg.subject ?? '');

  // Check if already tagged (don't overwrite manual assignments)
  const { data: existing } = await supabase
    .from('emails')
    .select('project_id, match_confidence')
    .eq('message_id', msg.id)
    .single();

  let projectId: string | null = existing?.project_id ?? null;
  let confidence: string | null = existing?.match_confidence ?? null;

  // Only run matching if not already manually tagged
  if (!projectId || confidence === 'suggested') {
    const match = await matchEmailToProject(
      fromEmail,
      msg.subject ?? '',
      msg.body?.content ?? msg.bodyPreview ?? '',
      msg.conversationId,
      supabase,
    );

    // Only auto-apply if confidence is better than what we have
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
    },
    { onConflict: 'message_id' },
  );
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
