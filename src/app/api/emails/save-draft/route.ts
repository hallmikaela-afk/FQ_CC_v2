/**
 * /api/emails/save-draft
 *
 * POST — Step 2 of 2: Save an AI-generated draft to Outlook via Graph API,
 *        then record the draft_message_id on the email row in Supabase.
 *        Called immediately after /api/emails/quick-draft returns draft_text.
 */

import { NextResponse } from 'next/server';
import { graphFetch } from '@/lib/microsoft-graph';
import { getServiceSupabase } from '@/lib/supabase';
import { buildOutgoingHtml } from '@/lib/emailSignature';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const { email_id, draft_text } = await request.json();
  if (!email_id || !draft_text) {
    return NextResponse.json({ error: 'Missing email_id or draft_text' }, { status: 400 });
  }

  const supabase = getServiceSupabase();

  // ── Look up the Outlook message_id ────────────────────────────────────────
  const { data: email, error: emailError } = await supabase
    .from('emails')
    .select('message_id')
    .eq('id', email_id)
    .single();

  if (emailError || !email?.message_id) {
    return NextResponse.json({ error: 'Email not found' }, { status: 404 });
  }

  // ── Create reply draft in Outlook, patch body, record ID ─────────────────
  const draft = await graphFetch(
    `/me/messages/${encodeURIComponent(email.message_id)}/createReply`,
    { method: 'POST', body: JSON.stringify({}) },
  ) as { id: string } | null;

  if (!draft?.id) {
    return NextResponse.json({ error: 'Failed to create Outlook draft' }, { status: 502 });
  }

  const draftMessageId = draft.id;
  const draftHtml = buildOutgoingHtml(draft_text.replace(/\n/g, '<br>'));

  await graphFetch(`/me/messages/${encodeURIComponent(draftMessageId)}`, {
    method: 'PATCH',
    body: JSON.stringify({
      body: { contentType: 'HTML', content: draftHtml },
    }),
  });

  await supabase
    .from('emails')
    .update({ draft_message_id: draftMessageId })
    .eq('id', email_id);

  return NextResponse.json({ draft_message_id: draftMessageId });
}
