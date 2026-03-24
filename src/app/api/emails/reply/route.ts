/**
 * /api/emails/reply
 *
 * POST — Send a reply to an email via Microsoft Graph (HTML body).
 */

import { NextResponse } from 'next/server';
import { sendReply } from '@/lib/microsoft-graph';
import { buildReplyHtml } from '@/lib/emailSignature';

export const dynamic = 'force-dynamic';

interface GraphRecipient {
  emailAddress: { address: string; name?: string };
}

interface ReplyBody {
  message_id: string;
  /** Preferred: caller-built HTML (contenteditable innerHTML + quote). */
  reply_html?: string;
  /** Legacy plain text — will be wrapped in HTML template. */
  reply_text?: string;
  /** Original email metadata for quoting (used with reply_text path). */
  original_date?: string;
  original_sender?: string;
  original_body?: string;
  /** Optional CC and BCC recipients. */
  cc?: GraphRecipient[];
  bcc?: GraphRecipient[];
  /** When true, uses Graph replyAll endpoint to include all original recipients. */
  reply_all?: boolean;
}

export async function POST(request: Request) {
  const body: ReplyBody = await request.json();
  const { message_id, reply_html, reply_text, original_date = '', original_sender = '', original_body = '', cc = [], bcc = [], reply_all = false } = body;

  if (!message_id || (!reply_html?.trim() && !reply_text?.trim())) {
    return NextResponse.json({ error: 'Missing message_id or reply body' }, { status: 400 });
  }

  // Build final HTML: prefer caller-provided HTML, else convert plain text
  const htmlBody = reply_html ?? buildReplyHtml(
    (reply_text ?? '').replace(/\n/g, '<br>'),
    original_date,
    original_sender,
    original_body,
  );

  try {
    await sendReply(message_id, htmlBody, 'default', cc, bcc, reply_all);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'NOT_CONNECTED' || message.includes('NOT_CONNECTED')) {
      return NextResponse.json({ error: 'NOT_CONNECTED' }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
