import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { graphFetch } from '@/lib/microsoft-graph';
import type { GraphMessage } from '@/lib/microsoft-graph';

export const dynamic = 'force-dynamic';

/* ── Normalise a raw Graph message into the shape the inbox expects ── */
function graphMessageToEmailRow(msg: GraphMessage) {
  return {
    id:           `graph-${msg.id}`,
    message_id:   msg.id,
    subject:      msg.subject,
    from_name:    msg.from?.emailAddress?.name ?? null,
    from_email:   msg.from?.emailAddress?.address ?? null,
    body_preview: msg.bodyPreview,
    body:         msg.body?.content ?? null,
    received_at:  msg.receivedDateTime,
    is_read:      msg.isRead,
    conversation_id: msg.conversationId,
    folder_id:    msg.parentFolderId,
    project_id:   null,
    match_confidence: null,
    needs_followup: false,
    is_meeting_summary: false,
    dismissed:    false,
    resolved:     false,
    draft_message_id: null,
    category:     null,
    has_attachments: msg.hasAttachments ?? false,
    needs_response: false,
    projects:     null,
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query         = searchParams.get('q')?.trim() ?? '';
  const fromFilter    = searchParams.get('from')?.trim() ?? '';
  const hasAttachment = searchParams.get('has_attachment') === 'true';

  const hasTextQuery = query.length >= 2;
  const hasFilters   = fromFilter.length >= 1 || hasAttachment;

  if (!hasTextQuery && !hasFilters) {
    return NextResponse.json({ emails: [], searchedGraph: false });
  }

  const supabase = getServiceSupabase();

  /* ── 1. Search Supabase cache ── */
  let q = supabase
    .from('emails')
    .select(`
      id, message_id, subject, from_name, from_email, body_preview, body,
      received_at, is_read, needs_followup, needs_response, project_id, match_confidence,
      conversation_id, folder_id, is_meeting_summary, dismissed, resolved,
      draft_message_id, category, has_attachments,
      projects:project_id ( id, name, type, color, event_date )
    `)
    .eq('dismissed', false)
    .order('received_at', { ascending: false })
    .limit(30);

  if (hasTextQuery) {
    q = q.or(
      `subject.ilike.%${query}%,` +
      `from_name.ilike.%${query}%,` +
      `from_email.ilike.%${query}%,` +
      `body_preview.ilike.%${query}%`,
    );
  }

  if (fromFilter) {
    q = q.or(`from_name.ilike.%${fromFilter}%,from_email.ilike.%${fromFilter}%`);
  }

  if (hasAttachment) {
    q = q.eq('has_attachments', true);
  }

  const { data: cached } = await q;

  const cachedEmails = cached ?? [];
  const cachedMessageIds = new Set(cachedEmails.map((e) => e.message_id));

  let graphEmails: ReturnType<typeof graphMessageToEmailRow>[] = [];
  let searchedGraph = false;

  /* ── 2. If cache has < 5 results and there's a text query, also query Graph API ── */
  if (cachedEmails.length < 5 && hasTextQuery) {
    try {
      const safeQuery = query.replace(/"/g, '\\"');
      const data = (await graphFetch(
        `/me/messages?$search="${safeQuery}"&$top=20&$select=id,subject,bodyPreview,body,receivedDateTime,isRead,conversationId,parentFolderId,from,hasAttachments`,
      )) as { value: GraphMessage[] };

      searchedGraph = true;

      graphEmails = (data.value ?? [])
        .filter((msg) => !cachedMessageIds.has(msg.id))
        .map(graphMessageToEmailRow);

      // Apply from filter to Graph results client-side
      if (fromFilter) {
        const fl = fromFilter.toLowerCase();
        graphEmails = graphEmails.filter(
          (e) =>
            (e.from_name ?? '').toLowerCase().includes(fl) ||
            (e.from_email ?? '').toLowerCase().includes(fl),
        );
      }
      // Apply has_attachment filter to Graph results
      if (hasAttachment) {
        graphEmails = graphEmails.filter((e) => e.has_attachments);
      }
    } catch {
      // Graph search failed (e.g. not connected) — return cache results only
    }
  }

  return NextResponse.json({
    emails: [...cachedEmails, ...graphEmails],
    searchedGraph,
  });
}
