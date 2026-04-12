import { NextRequest, NextResponse } from 'next/server';
import { downloadDriveFileAsBuffer } from '@/lib/google-drive';

export const dynamic = 'force-dynamic';

const MAX_CHARS = 60_000;

async function bufferToText(buffer: Buffer, mimeType: string, fileName: string): Promise<string> {
  const nameLower = fileName.toLowerCase();

  // Plain text (Google Docs export, CSV, Google Sheets export)
  if (
    mimeType === 'text/plain' ||
    mimeType === 'text/csv' ||
    nameLower.endsWith('.csv') ||
    nameLower.endsWith('.txt')
  ) {
    return buffer.toString('utf-8');
  }

  // PDF — extract text with pdf-parse (Node.js-native, no worker/bundling issues)
  if (mimeType === 'application/pdf' || nameLower.endsWith('.pdf')) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse');
    const data = await pdfParse(buffer);
    return data.text?.trim() || '';
  }

  // DOCX / DOC
  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimeType === 'application/msword' ||
    nameLower.endsWith('.docx') ||
    nameLower.endsWith('.doc')
  ) {
    const mammoth = await import('mammoth');
    const result = await mammoth.default.extractRawText({ buffer });
    return result.value;
  }

  // XLSX / XLS
  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mimeType === 'application/vnd.ms-excel' ||
    nameLower.endsWith('.xlsx') ||
    nameLower.endsWith('.xls')
  ) {
    const XLSX = await import('xlsx');
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const parts: string[] = [];
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const csv = XLSX.utils.sheet_to_csv(sheet);
      parts.push(`[Sheet: ${sheetName}]\n${csv}`);
    }
    return parts.join('\n\n');
  }

  return '';
}

export async function POST(req: NextRequest) {
  try {
    const { fileId, mimeType, fileName } = await req.json();
    if (!fileId || !mimeType || !fileName) {
      return NextResponse.json({ error: 'fileId, mimeType, and fileName are required' }, { status: 400 });
    }

    const { buffer, effectiveMimeType } = await downloadDriveFileAsBuffer(fileId, mimeType);

    let rawText = '';
    let parseError = '';
    try {
      rawText = await bufferToText(buffer, effectiveMimeType, fileName);
    } catch (parseErr: any) {
      parseError = parseErr.message || 'Text extraction failed';
      console.error('[drive/file-content] parse error:', parseErr);
    }

    if (!rawText) {
      return NextResponse.json({
        text: '',
        truncated: false,
        parseError: parseError || `No extractable text in ${fileName} (may be a scanned/image-based PDF).`,
      });
    }

    const truncated = rawText.length > MAX_CHARS;
    const text = truncated
      ? rawText.slice(0, MAX_CHARS) + '\n\n[Note: File content was truncated due to length.]'
      : rawText;

    return NextResponse.json({ text, truncated });
  } catch (err: any) {
    if (err.message === 'NOT_CONNECTED') {
      return NextResponse.json({ error: 'Google Drive is not connected.' }, { status: 401 });
    }
    console.error('[drive/file-content] error:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch file content' }, { status: 500 });
  }
}
