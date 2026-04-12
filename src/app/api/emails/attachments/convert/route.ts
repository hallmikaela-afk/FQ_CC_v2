/**
 * /api/emails/attachments/convert
 *
 * GET ?message_id=X&attachment_id=Y
 * Fetches an email attachment from Microsoft Graph and converts it to a
 * previewable format:
 *   - DOCX/DOC  → { type: 'html',  content: '<p>…</p>' }
 *   - XLSX/XLS/CSV → { type: 'table', sheets: [{ name, rows }] }
 *
 * Auth: no explicit Supabase session check — matches the pattern used by
 * /api/emails/attachments/route.ts. Both routes rely on the Microsoft Graph
 * token (managed by fetchAttachmentContent in microsoft-graph.ts) which will
 * return a 401/500 if the token is absent or expired. This is consistent
 * across all email attachment endpoints.
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchAttachmentContent } from '@/lib/microsoft-graph';
import mammoth from 'mammoth';
import * as xlsx from 'xlsx';

export const dynamic = 'force-dynamic';

function isDocx(contentType: string, name: string) {
  const ct = contentType.toLowerCase();
  const ext = (name.split('.').pop() ?? '').toLowerCase();
  return ct.includes('wordprocessingml') || ct.includes('msword') || ext === 'docx' || ext === 'doc';
}

function isSpreadsheet(contentType: string, name: string) {
  const ct = contentType.toLowerCase();
  const ext = (name.split('.').pop() ?? '').toLowerCase();
  return (
    ct.includes('spreadsheetml') ||
    ct.includes('ms-excel') ||
    ct === 'text/csv' ||
    ['xlsx', 'xls', 'csv'].includes(ext)
  );
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const messageId    = searchParams.get('message_id');
  const attachmentId = searchParams.get('attachment_id');

  if (!messageId || !attachmentId) {
    return NextResponse.json({ error: 'message_id and attachment_id required' }, { status: 400 });
  }

  try {
    const att    = await fetchAttachmentContent(messageId, attachmentId);
    const buffer = Buffer.from(att.contentBytes, 'base64');

    if (isDocx(att.contentType, att.name)) {
      const result = await mammoth.convertToHtml({ buffer });
      return NextResponse.json({ type: 'html', content: result.value });
    }

    if (isSpreadsheet(att.contentType, att.name)) {
      const workbook = xlsx.read(buffer, { type: 'buffer' });
      const sheets = workbook.SheetNames.map((name) => {
        const sheet = workbook.Sheets[name];
        // header:1 gives array-of-arrays; first row is headers
        const rows = xlsx.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
        return { name, rows };
      });
      return NextResponse.json({ type: 'table', sheets });
    }

    return NextResponse.json({ error: 'unsupported_type' }, { status: 415 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
