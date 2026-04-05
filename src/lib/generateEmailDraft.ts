/**
 * Shared AI draft generation logic used by both:
 *  - /api/emails/quick-draft  (one-click draft from inbox)
 *  - /api/emails/draft-reply  (AI Assist inside DraftCard)
 *
 * Fetches rich project context from Supabase, builds the prompt, calls Claude,
 * and returns the draft text.
 */

import Anthropic from '@anthropic-ai/sdk';
import { SupabaseClient } from '@supabase/supabase-js';

function getAnthropic() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

interface EmailRow {
  id: string;
  message_id: string;
  subject: string | null;
  from_name: string | null;
  from_email: string | null;
  body: string | null;
  body_preview: string | null;
  received_at: string | null;
  project_id: string | null;
}

/** Build the project context string used in both initial generation and editing. */
export async function buildProjectContext(
  email: EmailRow,
  supabase: SupabaseClient,
): Promise<string> {
  const today = new Date().toISOString().split('T')[0];
  let projectContext = 'This email has not been linked to a project yet.';

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
      projectContext  = `PROJECT: ${project.name} (${project.type})\n`;
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
  }

  return projectContext;
}

/** Generate a fresh draft reply for an email using full project context. */
export async function generateEmailDraft(
  email: EmailRow,
  supabase: SupabaseClient,
): Promise<string> {
  const today = new Date().toISOString().split('T')[0];
  const emailBody = email.body || email.body_preview || '(no content)';
  const projectContext = await buildProjectContext(email, supabase);

  // ── Build prompts ──────────────────────────────────────────────────────────
  const systemPrompt = `You are helping Mikaela Hall, owner of Fox & Quinn Events — a luxury wedding and event planning company.

Write email replies in Mikaela's voice: calm, warm, professional, and specific. She is attentive to detail, makes clients feel at ease, and always references the actual project details rather than being generic. She uses a conversational but polished tone — never overly formal, never casual.

Today is ${today}.

When writing a reply:
- Start with a warm, specific greeting (reference the project or context if possible)
- Address the sender's question or topic directly and concisely
- Reference actual project details, dates, tasks where relevant
- Keep it focused — don't pad with unnecessary filler
- End with: Mikaela
- Do NOT add a subject line
- Do NOT include any signature block, contact info (phone, email, website), or footer — the system appends those automatically
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
  const response = await getAnthropic().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  const textContent = response.content.find(c => c.type === 'text');
  return (textContent as { type: 'text'; text: string } | undefined)?.text ?? '';
}
