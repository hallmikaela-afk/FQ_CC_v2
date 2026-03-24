/**
 * /api/emails/quick-draft
 *
 * POST — Step 1 of 2: Generate AI reply text with Claude using full project context.
 *        Does NOT save to Outlook (kept separate to stay under Vercel Hobby 10s limit).
 *        Returns { draft_text } — caller should then POST /api/emails/save-draft.
 */

import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { generateEmailDraft } from '@/lib/generateEmailDraft';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  const { email_id } = await request.json();
  if (!email_id) {
    return NextResponse.json({ error: 'Missing email_id' }, { status: 400 });
  }

  const supabase = getServiceSupabase();

  const { data: email, error: emailError } = await supabase
    .from('emails')
    .select('id, message_id, subject, from_name, from_email, body, body_preview, received_at, project_id')
    .eq('id', email_id)
    .single();

  if (emailError || !email) {
    return NextResponse.json({ error: 'Email not found' }, { status: 404 });
  }

  try {
    const draft_text = await generateEmailDraft(email, supabase);
    return NextResponse.json({ draft_text });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Claude error' },
      { status: 500 },
    );
  }
}
