import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

function getAnthropic() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

// Build context about current projects and tasks from Supabase
async function buildContext(): Promise<string> {
  const supabase = getServiceSupabase();

  const [projectsRes, tasksRes, teamRes] = await Promise.all([
    supabase.from('projects').select('id, name, type, status, event_date, venue_name, venue_location, concept, service_tier, guest_count, estimated_budget').order('event_date'),
    supabase.from('tasks').select('id, project_id, text, completed, status, due_date, category, priority, assigned_to').eq('completed', false).order('due_date'),
    supabase.from('team_members').select('*'),
  ]);

  const projects: any[] = projectsRes.data || [];
  const tasks: any[] = tasksRes.data || [];
  const team: any[] = teamRes.data || [];

  const today = new Date().toISOString().split('T')[0];

  // Find overdue tasks
  const overdue = tasks.filter((t: any) => t.due_date && t.due_date < today);

  let context = `You are the AI assistant for Fox & Quinn, a luxury wedding and event planning company run by Mikaela Hall. You help manage projects, tasks, vendors, and client communications.\n\n`;
  context += `Today is ${today}.\n\n`;

  context += `TEAM:\n`;
  team.forEach((t: any) => { context += `- ${t.name} (${t.role}) [ID: ${t.id}]\n`; });

  context += `\nACTIVE PROJECTS:\n`;
  projects.forEach((p: any) => {
    const projectTasks = tasks.filter((t: any) => t.project_id === p.id);
    context += `- ${p.name} (${p.type}, ${p.status}) — ${p.event_date || 'no date'}, ${p.venue_name || p.concept || ''} [ID: ${p.id}]\n`;
    context += `  Open tasks: ${projectTasks.length}\n`;
  });

  if (overdue.length > 0) {
    context += `\nOVERDUE TASKS (${overdue.length}):\n`;
    overdue.forEach((t: any) => {
      const proj = projects.find((p: any) => p.id === t.project_id);
      context += `- "${t.text}" — due ${t.due_date} (${proj?.name || 'unknown project'})\n`;
    });
  }

  context += `\nIMPORTANT: When the user asks to update tasks, mark things complete, add vendors, etc., describe what you would do. The actual database operations happen through the app's UI. Focus on being a helpful planning assistant — summarize, prioritize, flag issues, and advise.`;

  return context;
}

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  const { messages } = await req.json();

  if (!messages || !Array.isArray(messages)) {
    return NextResponse.json({ error: 'messages array required' }, { status: 400 });
  }

  const context = await buildContext();

  const response = await getAnthropic().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: context,
    messages: messages.map((m: any) => ({
      role: m.role,
      content: m.content,
    })),
  });

  const textContent = response.content.find((c: any) => c.type === 'text');
  return NextResponse.json({
    role: 'assistant',
    content: (textContent as any)?.text || '',
  });
}
