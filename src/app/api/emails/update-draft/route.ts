/**
 * /api/emails/update-draft
 *
 * POST { action: 'update' | 'send', draft_message_id, body, email_id? }
 *
 *  action='update'  — PATCH the draft body in Outlook (auto-save debounce)
 *  action='send'    — PATCH body then POST .../send, mark email resolved in Supabase
 */

import { NextResponse } from 'next/server';
import { graphFetch } from '@/lib/microsoft-graph';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const { action, draft_message_id, body, email_id } = await request.json();

  if (!draft_message_id) {
    return NextResponse.json({ error: 'Missing draft_message_id' }, { status: 400 });
  }

  try {
    // Always update the draft body when provided
    if (body !== undefined) {
      await graphFetch(`/me/messages/${encodeURIComponent(draft_message_id)}`, {
        method: 'PATCH',
        body: JSON.stringify({
          body: { contentType: 'text', content: body },
        }),
      });
    }

    if (action === 'send') {
      // Send the draft
      await graphFetch(`/me/messages/${encodeURIComponent(draft_message_id)}/send`, {
        method: 'POST',
      });

      // Mark email as resolved in Supabase
      if (email_id) {
        const supabase = getServiceSupabase();
        await supabase
          .from('emails')
          .update({ resolved: true, draft_message_id: null })
          .eq('id', email_id);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = String(err);
    if (message.includes('NOT_CONNECTED')) {
      return NextResponse.json({ error: 'Microsoft account not connected' }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
