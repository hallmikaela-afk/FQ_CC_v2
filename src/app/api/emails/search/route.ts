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
    projects:     null,
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q')?.trim();

  if (!query || query.length < 2) {
    return NextResponse.json({ emails: [], searchedGraph: false });
  }

  const supabase = getServiceSupabase();

  /* ── 1. Search Supabase cache ── */
  const { data: cached } = await supabase
    .from('emails')
    .select(`
      id, message_id, subject, from_name, from_email, body_preview, body,
      received_at, is_read, needs_followup, project_id, match_confidence,
      conversation_id, folder_id, is_meeting_summary, dismissed, resolved,
      draft_message_id, category,
      projects:project_id ( id, name, type, color, event_date )
    `)
    .or(
      `subject.ilike.%${query}%,` +
      `from_name.ilike.%${query}%,` +
      `from_email.ilike.%${query}%,` +
      `body_preview.ilike.%${query}%`
    )
    .eq('dismissed', false)
    .order('received_at', { ascending: false })
    .limit(20);

  const cachedEmails = cached ?? [];
  const cachedMessageIds = new Set(cachedEmails.map((e) => e.message_id));

  let graphEmails: ReturnType<typeof graphMessageToEmailRow>[] = [];
  let searchedGraph = false;

  /* ── 2. If cache has < 5 results, also query Graph API ── */
  if (cachedEmails.length < 5) {
    try {
      const safeQuery = query.replace(/"/g, '\\"');
      const data = (await graphFetch(
        `/me/messages?$search="${safeQuery}"&$top=20&$select=id,subject,bodyPreview,body,receivedDateTime,isRead,conversationId,parentFolderId,from`,
      )) as { value: GraphMessage[] };

      searchedGraph = true;

      graphEmails = (data.value ?? [])
        .filter((msg) => !cachedMessageIds.has(msg.id))
        .map(graphMessageToEmailRow);
    } catch {
      // Graph search failed (e.g. not connected) — return cache results only
    }
  }

  return NextResponse.json({
    emails: [...cachedEmails, ...graphEmails],
    searchedGraph,
  });
}
