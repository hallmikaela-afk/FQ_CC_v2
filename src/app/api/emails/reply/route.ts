/**
 * /api/emails/reply
 *
 * POST — Send a reply to an email via Microsoft Graph.
 */

import { NextResponse } from 'next/server';
import { sendReply } from '@/lib/microsoft-graph';

export const dynamic = 'force-dynamic';

interface ReplyBody {
  message_id: string;  // Graph message id
  reply_text: string;
}

export async function POST(request: Request) {
  const body: ReplyBody = await request.json();
  const { message_id, reply_text } = body;

  if (!message_id || !reply_text?.trim()) {
    return NextResponse.json({ error: 'Missing message_id or reply_text' }, { status: 400 });
  }

  try {
    await sendReply(message_id, reply_text, 'default');
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'NOT_CONNECTED') {
      return NextResponse.json({ error: 'NOT_CONNECTED' }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
