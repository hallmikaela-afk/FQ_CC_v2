import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function parseHtmlTables(html: string): Record<string, string>[] {
  const tableMatch = html.match(/<table[^>]*>([\s\S]*?)<\/table>/i);
  if (!tableMatch) return [];

  const rowMatches = [...tableMatch[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
  const allRows: string[][] = rowMatches.map(rm => {
    return [...rm[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)]
      .map(m => m[1].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#\d+;/g, ' ').trim());
  });

  if (allRows.length < 2) return [];
  const headers = allRows[0];
  return allRows.slice(1).map(row => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = row[i] || ''; });
    return obj;
  }).filter(row => Object.values(row).some(v => v.length > 0));
}

function parseTextAsRows(text: string): Record<string, string>[] {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length < 2) return lines.map(l => ({ text: l }));

  const firstLine = lines[0];
  const delimiter = firstLine.includes('\t') ? '\t' : firstLine.includes(',') ? ',' : null;

  if (delimiter) {
    const headers = firstLine.split(delimiter).map(h => h.trim());
    return lines.slice(1).map(line => {
      const values = line.split(delimiter!);
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => { obj[h] = values[i]?.trim() || ''; });
      return obj;
    });
  }

  // Each line as a text entry
  return lines.map(l => ({ text: l }));
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const name = file.name.toLowerCase();

    let rows: Record<string, string>[] = [];

    if (name.endsWith('.docx') || name.endsWith('.doc')) {
      const mammoth = await import('mammoth');
      const result = await mammoth.default.convertToHtml({ buffer });
      rows = parseHtmlTables(result.value);
      if (rows.length === 0) {
        // Fall back to raw text
        const raw = await mammoth.default.extractRawText({ buffer });
        rows = parseTextAsRows(raw.value);
      }
    } else if (name.endsWith('.pdf')) {
      const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.js' as any);
      const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
      const pdf = await loadingTask.promise;
      const textParts: string[] = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        textParts.push(content.items.map((item: any) => item.str).join(' '));
      }
      rows = parseTextAsRows(textParts.join('\n'));
    } else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const sheetRows: Record<string, string>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        rows = rows.concat(sheetRows.map(r =>
          Object.fromEntries(Object.entries(r).map(([k, v]) => [k, String(v)]))
        ));
      }
    } else if (name.endsWith('.csv')) {
      const text = buffer.toString('utf-8');
      rows = parseTextAsRows(text);
    } else {
      return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });
    }

    return NextResponse.json({ rows });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
