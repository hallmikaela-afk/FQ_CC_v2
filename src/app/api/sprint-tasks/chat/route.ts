import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const BUCKETS = [
  'Sun-Steeped Hamptons',
  'Menorca Editorial',
  'Elisabeth & JJ — LionRock Farm',
  'Julia & Frank — Wave Resort',
  'Tippi & Justin — Vanderbilt Museum',
  'Fox & Quinn — Operations',
  'Fox & Quinn — Marketing',
  'FQ Command Center',
];

async function getProjectContext(): Promise<string> {
  try {
    const { data: projects } = await supabase
      .from('projects')
      .select('id, name, status')
      .order('event_date');
    if (projects && projects.length > 0) {
      return `\nACTIVE PROJECTS (use these IDs for planner tasks):\n` +
        projects.map((p: any) => `- ${p.name} [ID: ${p.id}]`).join('\n');
    }
  } catch {
    // fall through
  }
  return '';
}

const BASE_SYSTEM = `You are a task assistant for Fox & Quinn, a luxury wedding planning studio run by Mikaela. You help manage both weekly sprint tasks and project planner tasks.

Always respond with valid JSON only — no plain text outside JSON.

When she asks to add a SPRINT task (something for this week), respond:
{"response":"Confirmation message","action":"add_sprint_task","title":"...","bucket":"closest bucket from list","tag":"one of: action,decision,creative,ops,marketing,build,client,check"}

When she asks to add a PLANNER task (a task on a project, possibly with subtasks), respond:
{"response":"Confirmation message","action":"add_planner_task","project_id":"PROJECT_ID","text":"task title","subtasks":[{"text":"subtask 1"},{"text":"subtask 2"}]}

When she asks something general (questions, lists, etc.), respond:
{"response":"Your conversational reply"}

Sprint buckets: ${BUCKETS.join(', ')}
Tag guide: action=emails/outreach, decision=decisions needed, creative=moodboards/design, ops=admin/payroll, marketing=marketing, build=tech/dev, client=client deliverables, check=verifying something

If bucket is unclear, ask. Keep responses short.`;

export async function POST(req: NextRequest) {
  const { messages, week } = await req.json();

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  const projectContext = await getProjectContext();
  const system = BASE_SYSTEM + projectContext;

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system,
    messages,
  });

  const raw = (response.content.find((c: any) => c.type === 'text') as any)?.text || '';

  // Parse structured JSON response
  try {
    const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    const parsed = JSON.parse(cleaned);
    const content = parsed.response || '';

    // Sprint task creation
    if (parsed.action === 'add_sprint_task' && parsed.title && parsed.bucket) {
      const { error } = await supabase
        .from('sprint_tasks')
        .insert({
          title: parsed.title,
          bucket: parsed.bucket,
          tag: parsed.tag || 'action',
          done: false,
          sprint_week: week,
          sort_order: 99,
        });

      if (error) throw error;

      return NextResponse.json({
        role: 'assistant',
        content: content || `Added "${parsed.title}" to ${parsed.bucket}.`,
        task_added: true,
        tasks_count: 1,
      });
    }

    // Planner task creation
    if (parsed.action === 'add_planner_task' && parsed.project_id && parsed.text) {
      const { data: task, error } = await supabase
        .from('tasks')
        .insert({ project_id: parsed.project_id, text: parsed.text, completed: false, sort_order: 99 })
        .select()
        .single();

      if (error) throw error;

      if (task && parsed.subtasks?.length) {
        await supabase.from('subtasks').insert(
          parsed.subtasks.map((st: any, i: number) => ({
            task_id: task.id,
            text: st.text,
            completed: false,
            sort_order: i,
          }))
        );
      }

      return NextResponse.json({
        role: 'assistant',
        content: content || `Added "${parsed.text}" to your planner.`,
        task_added: true,
        tasks_added: true,
        tasks_count: 1,
      });
    }

    // General response
    return NextResponse.json({ role: 'assistant', content, task_added: false });
  } catch {
    // Fall back to plain text
    return NextResponse.json({ role: 'assistant', content: raw, task_added: false });
  }
}
