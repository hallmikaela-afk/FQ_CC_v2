/**
 * /api/emails/draft-reply
 *
 * POST — Generate an AI draft reply for an email using Claude,
 *        with full project context (client info, tasks, sprint tasks, call notes).
 */

import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getServiceSupabase } from '@/lib/supabase';

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

  // ── Fetch the email ────────────────────────────────────────────────────────
  const { data: email, error: emailError } = await supabase
    .from('emails')
    .select('id, message_id, subject, from_name, from_email, body, body_preview, received_at, project_id')
    .eq('id', email_id)
    .single();

  if (emailError || !email) {
    return NextResponse.json({ error: 'Email not found' }, { status: 404 });
  }

  const emailBody = email.body || email.body_preview || '(no content)';

  // ── Build project context (if email is linked to a project) ──────────────
  let projectContext = '';

  if (email.project_id) {
    const [projectRes, tasksRes, sprintRes, callNotesRes] = await Promise.all([
      supabase
        .from('projects')
        .select('id, name, type, status, event_date, client1_name, client2_name, client1_email, client2_email, venue_name, venue_location, service_tier, concept, guest_count')
        .eq('id', email.project_id)
        .single(),
      supabase
        .from('tasks')
        .select('text, due_date, priority, category, status')
        .eq('project_id', email.project_id)
        .eq('completed', false)
        .order('due_date', { ascending: true })
        .limit(20),
      supabase
        .from('sprint_tasks')
        .select('task, bucket, tag, week_of')
        .eq('project_id', email.project_id)
        .order('week_of', { ascending: false })
        .limit(10),
      supabase
        .from('call_notes')
        .select('date, title, summary, raw_text')
        .eq('project_id', email.project_id)
        .order('date', { ascending: false })
        .limit(3),
    ]);

    const project = projectRes.data;
    const tasks = tasksRes.data ?? [];
    const sprintTasks = sprintRes.data ?? [];
    const callNotes = callNotesRes.data ?? [];

    if (project) {
      projectContext += `PROJECT: ${project.name} (${project.type})\n`;
      projectContext += `Status: ${project.status}\n`;
      projectContext += `Event Date: ${project.event_date || 'TBD'}\n`;
      projectContext += `Clients: ${[project.client1_name, project.client2_name].filter(Boolean).join(' & ') || 'N/A'}\n`;
      if (project.venue_name) projectContext += `Venue: ${project.venue_name}${project.venue_location ? `, ${project.venue_location}` : ''}\n`;
      if (project.service_tier) projectContext += `Service Tier: ${project.service_tier}\n`;
      if (project.concept) projectContext += `Concept: ${project.concept}\n`;
      if (project.guest_count) projectContext += `Guest Count: ${project.guest_count}\n`;

      if (tasks.length > 0) {
        projectContext += `\nOPEN TASKS (${tasks.length}):\n`;
        tasks.forEach(task => {
          const overdue = task.due_date && task.due_date < today ? ' [OVERDUE]' : '';
          const due = task.due_date ? ` — due ${task.due_date}` : '';
          projectContext += `- ${task.text}${due}${overdue}\n`;
        });
      }

      if (sprintTasks.length > 0) {
        projectContext += `\nTHIS WEEK'S SPRINT TASKS:\n`;
        sprintTasks.forEach(st => {
          projectContext += `- ${st.task}${st.tag ? ` [${st.tag}]` : ''}\n`;
        });
      }

      if (callNotes.length > 0) {
        projectContext += `\nRECENT CALL NOTES:\n`;
        callNotes.forEach(note => {
          const summary = note.summary || (note.raw_text || '').slice(0, 300);
          projectContext += `- ${note.date}${note.title ? ` — ${note.title}` : ''}: ${summary}\n`;
        });
      }
    }
  } else {
    projectContext = 'This email has not been linked to a project yet.';
  }

  // ── Build the prompt ───────────────────────────────────────────────────────
  const systemPrompt = `You are helping Mikaela Hall, owner of Fox & Quinn Events — a luxury wedding and event planning company.

Write email replies in Mikaela's voice: calm, warm, professional, and specific. She is attentive to detail, makes clients feel at ease, and always references the actual project details rather than being generic. She uses a conversational but polished tone — never overly formal, never casual.

Today is ${today}.

When writing a reply:
- Start with a warm, specific greeting (reference the project or context if possible)
- Address the sender's question or topic directly and concisely
- Reference actual project details, dates, tasks where relevant
- Keep it focused — don't pad with unnecessary filler
- Sign off as: Mikaela
- Do NOT add a subject line
- Do NOT add any preamble, explanation, or meta-commentary — output ONLY the email body`;

  const userMessage = `Please draft a reply to this email.

EMAIL FROM: ${email.from_name || email.from_email || 'Unknown'} <${email.from_email || ''}>
SUBJECT: ${email.subject || '(no subject)'}
RECEIVED: ${email.received_at || 'Unknown'}

EMAIL CONTENT:
${emailBody}

---

${projectContext ? `CONTEXT FOR THIS PROJECT:\n${projectContext}` : 'No project context available.'}

---

Write a professional, warm reply from Mikaela. Be specific and reference the actual project details where helpful. Keep it concise.`;

  // ── Call Claude ────────────────────────────────────────────────────────────
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
  } catch (err: any) {
    console.error('[draft-reply] Claude error:', err);
    return NextResponse.json({ error: err.message || 'Failed to generate draft' }, { status: 500 });
  }
}
