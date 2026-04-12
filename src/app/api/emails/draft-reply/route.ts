/**
 * /api/emails/draft-reply
 *
 * POST — Generate an AI draft reply for an email using Claude,
 *        with full project context (client info, tasks, sprint tasks, call notes).
 *
 *        Two modes:
 *          1. Initial generation: { email_id } → returns { draft }
 *          2. Editing mode:       { email_id, instruction, current_draft } → returns { draft }
 */

import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getServiceSupabase } from '@/lib/supabase';
import { generateEmailDraft, buildProjectContext } from '@/lib/generateEmailDraft';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function getAnthropic() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  const { email_id, instruction, current_draft } = await request.json();
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

  // ── Editing mode: refine an existing draft per user instruction ────────────
  if (instruction && current_draft !== undefined) {
    const emailBody = email.body || email.body_preview || '(no content)';

    // Fetch the same project context used during initial generation
    const projectContext = await buildProjectContext(email, supabase);

    const systemPrompt = `You are editing an email draft for Mikaela Hall, Owner & Creative Director of Fox & Quinn, a luxury wedding planning studio. Apply the requested changes to the draft while keeping her warm, professional voice.

PROJECT CONTEXT:
${projectContext}

Do NOT add any preamble, explanation, or meta-commentary — output ONLY the revised email body text.
Do NOT include any signature block, contact info (phone, email, website), or footer — the system appends those automatically.`;

    const userMessage = `ORIGINAL EMAIL:
Subject: ${email.subject || '(no subject)'}
From: ${email.from_name || email.from_email || 'Unknown'} <${email.from_email || ''}>

${emailBody}

---

CURRENT DRAFT:
${current_draft}

---

INSTRUCTION:
${instruction}

Apply the instruction while keeping all relevant project details accurate. Return only the revised draft text.`;

    try {
      const response = await getAnthropic().messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      });
      const textContent = response.content.find(c => c.type === 'text');
      const draft = (textContent as { type: 'text'; text: string } | undefined)?.text ?? '';
      return NextResponse.json({ draft });
    } catch (err: unknown) {
      console.error('[draft-reply] Claude editing error:', err);
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Failed to edit draft' },
        { status: 500 },
      );
    }
  }

  // ── Initial generation ─────────────────────────────────────────────────────
  try {
    const draft = await generateEmailDraft(email, supabase);
    return NextResponse.json({ draft });
  } catch (err: unknown) {
    console.error('[draft-reply] Claude error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to generate draft' },
      { status: 500 },
    );
  }
}
