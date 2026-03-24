/**
 * /api/emails/draft-content
 *
 * GET ?draft_message_id=xxx
 *   Fetches the body of a draft message from Microsoft Graph.
 *   Returns { body: string } with HTML stripped if needed.
 */

import { NextResponse } from 'next/server';
import { graphFetch } from '@/lib/microsoft-graph';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const draftMessageId = searchParams.get('draft_message_id');

  if (!draftMessageId) {
    return NextResponse.json({ error: 'Missing draft_message_id' }, { status: 400 });
  }

  try {
    const msg = await graphFetch(
      `/me/messages/${encodeURIComponent(draftMessageId)}?$select=body`,
    ) as { body?: { contentType: string; content: string } };

    const rawContent = msg?.body?.content ?? '';
    const contentType = (msg?.body?.contentType ?? 'text').toLowerCase();

    let text = rawContent;
    if (contentType === 'html') {
      // Remove the FQ signature block before stripping so it isn't shown
      // in the editor (the DraftCard renders the signature separately below).
      // The signature div is identified by its distinctive border-top style.
      text = rawContent.replace(
        /<div[^>]*border-top:\s*1px solid #E8E4DF[^>]*>[\s\S]*?<\/div>/gi,
        '',
      );

      // Strip remaining HTML tags for plain-text display in textarea
      text = text
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    }

    return NextResponse.json({ body: text });
  } catch (err) {
    const message = String(err);
    if (message.includes('NOT_CONNECTED')) {
      return NextResponse.json({ error: 'Microsoft account not connected' }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
