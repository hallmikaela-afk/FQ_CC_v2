import { NextRequest, NextResponse } from 'next/server';
import { graphFetch } from '@/lib/microsoft-graph';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

interface Recipient {
  emailAddress: { address: string; name?: string };
}

interface ComposeBody {
  action: 'send' | 'draft';
  to: Recipient[];
  cc?: Recipient[];
  subject: string;
  body: string;          // HTML
  project_id?: string | null;
}

export async function POST(req: NextRequest) {
  let payload: ComposeBody;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { action, to, cc = [], subject, body, project_id } = payload;

  if (!to?.length) {
    return NextResponse.json({ error: 'At least one recipient is required' }, { status: 400 });
  }

  /* ── Build Graph message object ── */
  const message = {
    subject,
    body: { contentType: 'HTML', content: body },
    toRecipients: to,
    ...(cc.length > 0 ? { ccRecipients: cc } : {}),
  };

  /* ── Send ── */
  if (action === 'send') {
    try {
      await graphFetch('/me/sendMail', {
        method: 'POST',
        body: JSON.stringify({ message, saveToSentItems: true }),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('NOT_CONNECTED')) {
        return NextResponse.json({ error: 'Outlook not connected' }, { status: 401 });
      }
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    /* Save to Supabase if project is tagged */
    if (project_id) {
      try {
        const supabase = getServiceSupabase();
        await supabase.from('emails').insert({
          message_id:      `sent-${Date.now()}`,
          subject,
          from_name:       'Mikaela Hall',
          from_email:      'Mikaela@foxandquinn.co',
          body_preview:    body.replace(/<[^>]+>/g, '').slice(0, 255),
          body,
          received_at:     new Date().toISOString(),
          is_read:         true,
          needs_followup:  false,
          project_id,
          match_confidence: 'exact',
          is_meeting_summary: false,
          dismissed:       false,
          resolved:        false,
        });
      } catch {
        // Non-critical — email was sent, just couldn't cache it
      }
    }

    return NextResponse.json({ success: true });
  }

  /* ── Save Draft ── */
  if (action === 'draft') {
    let draftMessageId: string | null = null;

    try {
      const created = (await graphFetch('/me/messages', {
        method: 'POST',
        body: JSON.stringify({ ...message, isDraft: true }),
      })) as { id: string };
      draftMessageId = created?.id ?? null;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('NOT_CONNECTED')) {
        return NextResponse.json({ error: 'Outlook not connected' }, { status: 401 });
      }
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    /* Persist draft_message_id if project is tagged */
    if (project_id && draftMessageId) {
      try {
        const supabase = getServiceSupabase();
        await supabase.from('emails').upsert({
          message_id:       draftMessageId,
          subject,
          from_name:        'Mikaela Hall',
          from_email:       'Mikaela@foxandquinn.co',
          body_preview:     body.replace(/<[^>]+>/g, '').slice(0, 255),
          body,
          received_at:      new Date().toISOString(),
          is_read:          true,
          needs_followup:   false,
          project_id,
          match_confidence: 'exact',
          draft_message_id: draftMessageId,
          is_meeting_summary: false,
          dismissed:        false,
          resolved:         false,
        }, { onConflict: 'message_id' });
      } catch {}
    }

    return NextResponse.json({ success: true, draft_message_id: draftMessageId });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
