/**
 * /api/emails/update-draft
 *
 * POST { action: 'update' | 'send' | 'delete', draft_message_id, body?, email_id? }
 *
 *  action='update'  — PATCH the draft body in Outlook (auto-save debounce)
 *  action='send'    — PATCH body then POST .../send, mark email resolved in Supabase
 *  action='delete'  — DELETE the draft from Outlook, clear draft_message_id in Supabase
 */

import { NextResponse } from 'next/server';
import { graphFetch } from '@/lib/microsoft-graph';
import { getServiceSupabase } from '@/lib/supabase';
import { buildOutgoingHtml } from '@/lib/emailSignature';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const { action, draft_message_id, body, body_is_html, email_id } = await request.json();

  if (!draft_message_id) {
    return NextResponse.json({ error: 'Missing draft_message_id' }, { status: 400 });
  }

  try {
    // Always update the draft body when provided, wrapped in HTML template
    if (body !== undefined) {
      // body_is_html=true means the body is already HTML (from contentEditable);
      // otherwise it's plain text and needs \n→<br> conversion first.
      const htmlContent = buildOutgoingHtml(
        body_is_html ? body : body.replace(/\n/g, '<br>'),
      );
      await graphFetch(`/me/messages/${encodeURIComponent(draft_message_id)}`, {
        method: 'PATCH',
        body: JSON.stringify({
          body: { contentType: 'HTML', content: htmlContent },
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

    if (action === 'delete') {
      // Delete the draft from Outlook
      await graphFetch(`/me/messages/${encodeURIComponent(draft_message_id)}`, {
        method: 'DELETE',
      });

      // Clear draft_message_id in Supabase
      if (email_id) {
        const supabase = getServiceSupabase();
        await supabase
          .from('emails')
          .update({ draft_message_id: null })
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
