/**
 * Shared helpers for email sync operations.
 * Used by /api/emails, /api/emails/initial-sync, and /api/emails/load-more.
 */

import { fetchMessages, fetchAllFolders, moveMessage } from '@/lib/microsoft-graph';
import { matchEmailToProject, type PreloadedMatchData } from '@/lib/email-matching';
import { getServiceSupabase } from '@/lib/supabase';
import type { GraphMessage } from '@/lib/microsoft-graph';

export const SYNC_BATCH  = 10;  // parallel upserts per round
export const FOLDER_BATCH = 5;  // parallel folder fetches per round

export const SKIP_FOLDERS = new Set([
  'conversation history',
  'rss feeds',
  'rss subscriptions',
  'clutter',
  'sync issues',
  'outbox',
  'junk email',
  'deleted items',
  'drafts',
]);

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

export function detectReceipt(
  fromEmail: string,
  subject: string,
  vendorEmails: Set<string>,
): boolean {
  const email = fromEmail.toLowerCase();
  const subj  = subject.toLowerCase();

  if (vendorEmails.has(email)) return false;
  if (subj.includes('invoice')) return false;

  const domain = email.split('@')[1] ?? '';
  if (RECEIPT_SENDER_DOMAINS.has(domain)) return true;

  if (
    subj.includes('subscription') &&
    RECEIPT_SUBJECT_BILLING_WORDS.some(w => subj.includes(w))
  ) return true;

  return false;
}

// ─── Meeting summary detection ───────────────────────────────────────────────

const ZOOM_NOREPLY_PATTERNS = ['no-reply@zoom.us', 'noreply@zoom.us', 'no_reply@zoom.us'];

export function detectMeetingSummary(fromEmail: string, subject: string): boolean {
  const email = fromEmail.toLowerCase();
  const subj  = subject.toLowerCase();
  const isZoom = ZOOM_NOREPLY_PATTERNS.some(p => email.includes(p)) || email.endsWith('@zoom.us');
  if (isZoom && (subj.includes('meeting summary') || subj.includes('summary') || subj.includes('recap'))) return true;
  return false;
}

// ─── Single-email upsert ──────────────────────────────────────────────────────

export async function upsertEmail(
  msg: GraphMessage,
  folderId: string,
  supabase: ReturnType<typeof getServiceSupabase>,
  preloaded: PreloadedMatchData,
  existingMap: Map<string, { project_id: string | null; match_confidence: string | null; category: string | null }>,
  folderProjectMap: Map<string, string>,
  receiptsFolderId: string | null,
  vendorEmails: Set<string>,
  projectOutlookFolderMap: Map<string, string> = new Map(),
) {
  const fromEmail = msg.from?.emailAddress?.address ?? '';
  const fromName  = msg.from?.emailAddress?.name ?? '';
  const isMeetingSummary = detectMeetingSummary(fromEmail, msg.subject ?? '');
  const existing = existingMap.get(msg.id);

  const isAutoReceipt   = detectReceipt(fromEmail, msg.subject ?? '', vendorEmails);
  const isManualReceipt = existing?.category === 'receipt';
  const isReceipt       = isAutoReceipt || isManualReceipt;

  if (isReceipt) {
    await supabase.from('emails').upsert(
      {
        message_id: msg.id, subject: msg.subject, from_name: fromName, from_email: fromEmail,
        body_preview: msg.bodyPreview, body: msg.body?.content ?? null,
        received_at: msg.receivedDateTime, is_read: msg.isRead,
        conversation_id: msg.conversationId, folder_id: folderId,
        project_id: null, match_confidence: null,
        is_meeting_summary: isMeetingSummary, category: 'receipt', dismissed: true,
      },
      { onConflict: 'message_id' },
    );
    if (isAutoReceipt && !isManualReceipt && receiptsFolderId && folderId !== receiptsFolderId) {
      moveMessage(msg.id, receiptsFolderId).catch(err =>
        console.error('[emails] receipt move error:', err),
      );
    }
    return;
  }

  let projectId: string | null = existing?.project_id ?? null;
  let confidence: string | null = existing?.match_confidence ?? null;

  const folderProjectId = folderProjectMap.get(folderId) ?? null;
  if (folderProjectId && existing?.match_confidence !== 'exact') {
    projectId  = folderProjectId;
    confidence = 'exact';
  } else if (!projectId || confidence === 'suggested') {
    const toEmails = (msg.toRecipients ?? []).map(r => r.emailAddress.address);
    const match = await matchEmailToProject(
      fromEmail, msg.subject ?? '', msg.body?.content ?? msg.bodyPreview ?? '',
      msg.conversationId, supabase, preloaded, toEmails,
    );
    const shouldApply =
      !existing?.project_id ||
      (match.confidence === 'exact'  && existing.match_confidence !== 'exact') ||
      (match.confidence === 'high'   && !['exact'].includes(existing.match_confidence ?? '')) ||
      (match.confidence === 'thread' && !['exact', 'high'].includes(existing.match_confidence ?? ''));
    if (shouldApply && match.projectId) {
      projectId  = match.projectId;
      confidence = match.confidence;
    }
  }

  // Auto-move to the project's Outlook folder if it differs from current folder
  let effectiveFolderId = folderId;
  if (projectId) {
    const targetFolderId = projectOutlookFolderMap.get(projectId);
    if (targetFolderId && folderId !== targetFolderId) {
      moveMessage(msg.id, targetFolderId).catch(err =>
        console.error('[emails] auto-move error:', err),
      );
      effectiveFolderId = targetFolderId;
    }
  }

  await supabase.from('emails').upsert(
    {
      message_id: msg.id, subject: msg.subject, from_name: fromName, from_email: fromEmail,
      body_preview: msg.bodyPreview, body: msg.body?.content ?? null,
      received_at: msg.receivedDateTime, is_read: msg.isRead,
      conversation_id: msg.conversationId, folder_id: effectiveFolderId,
      project_id: projectId, match_confidence: confidence,
      is_meeting_summary: isMeetingSummary, category: null,
      dismissed: projectId ? false : true,
    },
    { onConflict: 'message_id' },
  );
}

// ─── Shared folder + lookup setup ────────────────────────────────────────────

export async function buildSyncContext(supabase: ReturnType<typeof getServiceSupabase>) {
  const [allFolders, projectsRes, vendorsRes, rulesRes] = await Promise.all([
    fetchAllFolders('default'),
    supabase
      .from('projects')
      .select('id, type, name, client1_name, client2_name, client1_email, client2_email, venue_name, venue_location, location, event_date, photographer, outlook_folder_id')
      .in('status', ['active', 'completed']),
    supabase.from('vendors').select('project_id, email'),
    supabase.from('inbox_rules').select('rule_type, value, action'),
  ]);

  const projects = (projectsRes.data ?? []) as PreloadedMatchData['projects'];

  const receiptsFolderId = allFolders.find(f => f.displayName.toLowerCase() === 'receipts')?.id ?? null;

  // folder_id → project_id (from number-prefix Outlook folder names)
  const folderProjectMap = new Map<string, string>();
  // project_id → outlook_folder_id (for auto-move when email is matched)
  const projectOutlookFolderMap = new Map<string, string>();

  const NUMBER_PREFIX = /^\d+\s*-\s*/;
  for (const folder of allFolders) {
    if (!NUMBER_PREFIX.test(folder.displayName)) continue;
    const cleanName = folder.displayName.replace(NUMBER_PREFIX, '').trim().toLowerCase();
    const project = projects.find(p => p.name.toLowerCase() === cleanName);
    if (project) folderProjectMap.set(folder.id, project.id);
  }

  for (const p of (projectsRes.data ?? [])) {
    if (p.outlook_folder_id) projectOutlookFolderMap.set(p.id, p.outlook_folder_id);
  }

  const hideRules: { type: string; value: string }[] = (rulesRes.data ?? [])
    .filter(r => r.action === 'hide')
    .map(r => ({ type: r.rule_type, value: (r.value as string).toLowerCase() }));

  const vendorEmails = new Set(
    (vendorsRes.data ?? []).map(v => (v.email as string).toLowerCase()),
  );

  const preloaded: PreloadedMatchData = {
    projects,
    vendors: (vendorsRes.data ?? []) as PreloadedMatchData['vendors'],
  };

  const foldersToSync = allFolders.filter(
    f => !SKIP_FOLDERS.has(f.displayName.toLowerCase()),
  );

  function matchesHideRule(fromEmail: string): boolean {
    const email  = fromEmail.toLowerCase();
    const domain = email.split('@')[1] ?? '';
    return hideRules.some(
      r =>
        (r.type === 'sender' && email === r.value) ||
        (r.type === 'domain' && domain === r.value),
    );
  }

  return { foldersToSync, preloaded, folderProjectMap, projectOutlookFolderMap, receiptsFolderId, vendorEmails, matchesHideRule };
}

// ─── Upsert a batch of msg+folder pairs ──────────────────────────────────────

export async function upsertBatch(
  pairs: Array<{ msg: GraphMessage; folderId: string }>,
  supabase: ReturnType<typeof getServiceSupabase>,
  preloaded: PreloadedMatchData,
  folderProjectMap: Map<string, string>,
  receiptsFolderId: string | null,
  vendorEmails: Set<string>,
  matchesHideRule: (email: string) => boolean,
  projectOutlookFolderMap: Map<string, string> = new Map(),
): Promise<number> {
  if (!pairs.length) return 0;

  const existingRes = await supabase
    .from('emails')
    .select('message_id, project_id, match_confidence, category')
    .in('message_id', pairs.map(p => p.msg.id));

  const existingMap = new Map<string, { project_id: string | null; match_confidence: string | null; category: string | null }>();
  for (const row of existingRes.data ?? []) {
    existingMap.set(row.message_id, row);
  }

  const filtered = pairs.filter(({ msg }) => !matchesHideRule(msg.from?.emailAddress?.address ?? ''));
  let count = 0;
  for (let i = 0; i < filtered.length; i += SYNC_BATCH) {
    const chunk = filtered.slice(i, i + SYNC_BATCH);
    await Promise.allSettled(
      chunk.map(({ msg, folderId }) =>
        upsertEmail(msg, folderId, supabase, preloaded, existingMap, folderProjectMap, receiptsFolderId, vendorEmails, projectOutlookFolderMap),
      ),
    );
    count += chunk.length;
  }
  return count;
}

export { fetchMessages, fetchAllFolders };
