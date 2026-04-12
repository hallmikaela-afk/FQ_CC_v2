import { NextRequest, NextResponse } from 'next/server';
import { fetchAttachments, fetchAttachmentContent } from '@/lib/microsoft-graph';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// GET /api/emails/attachments?message_id=xxx
// GET /api/emails/attachments?message_id=xxx&attachment_id=yyy  → download
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const messageId = searchParams.get('message_id');
  const attachmentId = searchParams.get('attachment_id');

  if (!messageId) {
    return NextResponse.json({ error: 'message_id required' }, { status: 400 });
  }

  // Download mode
  if (attachmentId) {
    try {
      const att = await fetchAttachmentContent(messageId, attachmentId);
      const buffer = Buffer.from(att.contentBytes, 'base64');
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': att.contentType || 'application/octet-stream',
          'Content-Disposition': `inline; filename="${encodeURIComponent(att.name)}"`,
          'Content-Length': String(buffer.length),
        },
      });
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  }

  // List mode
  try {
    const attachments = await fetchAttachments(messageId);
    // Lazy-update has_attachments in DB so the card badge reflects reality
    if (attachments.length > 0) {
      const supabase = getServiceSupabase();
      supabase.from('emails').update({ has_attachments: true }).eq('message_id', messageId).then(() => {});
    }
    return NextResponse.json({ attachments });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
