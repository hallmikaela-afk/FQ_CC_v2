/**
 * /api/emails/quick-draft
 *
 * POST — One-click draft: generate AI reply with Claude, save as draft in
 *        Outlook via Graph, then record the draft_message_id on the email row.
 */

import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { graphFetch } from '@/lib/microsoft-graph';
import { getServiceSupabase } from '@/lib/supabase';
import { buildOutgoingHtml } from '@/lib/emailSignature';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function getAnthropic() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  const { email_id } = await request.json();
  if (!email_id) {
    return NextResponse.json({ error: 'Missing email_id' }, { status: 400 });
  }

  const supabase = getServiceSupabase();
  const today = new Date().toISOString().split('T')[0];

  // ── Fetch email ───────────────────────────────────────────────────────────
  const { data: email, error: emailError } = await supabase
    .from('emails')
    .select('id, message_id, subject, from_name, from_email, body, body_preview, received_at, project_id')
    .eq('id', email_id)
    .single();

  if (emailError || !email) {
    return NextResponse.json({ error: 'Email not found' }, { status: 404 });
  }

  // ── Build project context ─────────────────────────────────────────────────
  let projectContext = 'No project context available.';
  if (email.project_id) {
    const [projectRes, tasksRes] = await Promise.all([
      supabase
        .from('projects')
        .select('name, type, status, event_date, client1_name, client2_name, venue_name, service_tier, concept')
        .eq('id', email.project_id)
        .single(),
      supabase
        .from('tasks')
        .select('text, due_date, status')
        .eq('project_id', email.project_id)
        .eq('completed', false)
        .order('due_date', { ascending: true })
        .limit(10),
    ]);
    const project = projectRes.data;
    const tasks   = tasksRes.data ?? [];
    if (project) {
      projectContext  = `PROJECT: ${project.name} (${project.type})\n`;
      projectContext += `Status: ${project.status} | Event: ${project.event_date ?? 'TBD'}\n`;
      projectContext += `Clients: ${[project.client1_name, project.client2_name].filter(Boolean).join(' & ') || 'N/A'}\n`;
      if (project.venue_name) projectContext += `Venue: ${project.venue_name}\n`;
      if (tasks.length > 0) {
        projectContext += `Open tasks: ${tasks.map((t) => t.text).join(', ')}\n`;
      }
    }
  }

  // ── Generate draft with Claude ────────────────────────────────────────────
  const systemPrompt = `You are helping Mikaela Hall, owner of Fox & Quinn Events — a luxury wedding and event planning company.
Write email replies in Mikaela's voice: calm, warm, professional, and specific. Today is ${today}.
Output ONLY the email body — no subject line, no preamble, no meta-commentary. Sign off as: Mikaela`;

  const userMessage = `Draft a reply to this email.

FROM: ${email.from_name || email.from_email || 'Unknown'} <${email.from_email || ''}>
SUBJECT: ${email.subject || '(no subject)'}

${email.body || email.body_preview || '(no content)'}

---
${projectContext}`;

  let draftText = '';
  try {
    const response = await getAnthropic().messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });
    const textContent = response.content.find((c) => c.type === 'text');
    draftText = (textContent as { type: 'text'; text: string } | undefined)?.text ?? '';
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Claude error' },
      { status: 500 },
    );
  }

  // ── Save as draft reply in Outlook ────────────────────────────────────────
  let draftMessageId: string | null = null;
  try {
    // Create a blank draft reply (POST createReply returns the new draft)
    const draft = await graphFetch(
      `/me/messages/${email.message_id}/createReply`,
      { method: 'POST', body: JSON.stringify({}) },
    ) as { id: string } | null;

    if (draft?.id) {
      draftMessageId = draft.id;

      // Set the body of the draft as HTML with signature
      const draftHtml = buildOutgoingHtml(draftText.replace(/\n/g, '<br>'));
      await graphFetch(`/me/messages/${draftMessageId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          body: { contentType: 'HTML', content: draftHtml },
        }),
      });

      // Record draft_message_id in Supabase
      await supabase
        .from('emails')
        .update({ draft_message_id: draftMessageId })
        .eq('id', email_id);
    }
  } catch (err: unknown) {
    // Graph failed — still return the text so callers can show it
    console.error('[quick-draft] Graph error:', err);
    return NextResponse.json({ draft_text: draftText, draft_message_id: null });
  }

  return NextResponse.json({ draft_message_id: draftMessageId, draft_text: draftText });
}
