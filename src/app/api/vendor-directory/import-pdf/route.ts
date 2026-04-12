import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const dynamic = 'force-dynamic';

function getAnthropic() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get('file') as File | null;

  if (!file) {
    return NextResponse.json({ error: 'file is required' }, { status: 400 });
  }

  if (file.type !== 'application/pdf') {
    return NextResponse.json({ error: 'only PDF files are supported' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const base64 = buffer.toString('base64');

  const anthropic = getAnthropic();

  const message = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: base64,
            },
          },
          {
            type: 'text',
            text: `Extract all vendors, vendors, or service providers from this document. Return ONLY a valid JSON array of objects — no markdown, no explanation, no code fences. Each object should have these fields: name (string, required), company (string or null), category (string, required — use one of: Audio Visual, Bridal, Cake, Content Creator, Entertainment, Florist, Hair & Makeup, Lighting, Linens, Paper Goods, Photographer, Rentals, Transportation & Cars, Venues, Video, Other), email (string or null), phone (string or null), instagram (string or null), website (string or null), notes (string or null). If you cannot find any vendors, return an empty array [].`,
          },
        ],
      },
    ],
  });

  const textContent = message.content.find(c => c.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    return NextResponse.json({ error: 'No response from AI' }, { status: 500 });
  }

  let candidates: unknown[];
  try {
    // Strip any accidental markdown fences
    const raw = textContent.text.replace(/```json?\n?/g, '').replace(/```\n?/g, '').trim();
    candidates = JSON.parse(raw);
    if (!Array.isArray(candidates)) throw new Error('Not an array');
  } catch {
    return NextResponse.json({ error: 'Could not parse AI response as JSON', raw: textContent.text }, { status: 500 });
  }

  return NextResponse.json(candidates);
}
