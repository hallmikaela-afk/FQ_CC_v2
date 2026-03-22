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

async function buildContext(week: string): Promise<string> {
  const today = new Date().toISOString().split('T')[0];
  let ctx = `You are the task assistant for Fox & Quinn, a luxury wedding planning studio run by Mikaela.\n`;
  ctx += `Today is ${today}. Current sprint week: ${week}.\n\n`;

  // Sprint tasks for this week
  try {
    const { data: sprintTasks } = await supabase
      .from('sprint_tasks')
      .select('id, title, bucket, tag, done')
      .eq('sprint_week', week)
      .order('sort_order');

    if (sprintTasks && sprintTasks.length > 0) {
      ctx += `CURRENT SPRINT TASKS:\n`;
      sprintTasks.forEach((t: any) => {
        ctx += `- [SPRINT_ID: ${t.id}] ${t.title} — ${t.bucket} [${t.tag}]${t.done ? ' ✓ done' : ''}\n`;
      });
    } else {
      ctx += `CURRENT SPRINT TASKS: None yet.\n`;
    }
  } catch {
    ctx += `CURRENT SPRINT TASKS: (unavailable)\n`;
  }

  // Planner tasks
  try {
    const [projectsRes, tasksRes] = await Promise.all([
      supabase.from('projects').select('id, name, status').order('event_date'),
      supabase.from('tasks').select('id, project_id, text, completed, due_date').eq('completed', false).order('due_date'),
    ]);

    const projects: any[] = projectsRes.data || [];
    const tasks: any[] = tasksRes.data || [];

    if (projects.length > 0) {
      ctx += `\nACTIVE PROJECTS & PLANNER TASKS:\n`;
      projects.forEach((p: any) => {
        const projectTasks = tasks.filter((t: any) => t.project_id === p.id);
        ctx += `\n## ${p.name} [PROJECT_ID: ${p.id}]\n`;
        if (projectTasks.length === 0) {
          ctx += `   No open tasks.\n`;
        } else {
          projectTasks.forEach((t: any) => {
            ctx += `   - [TASK_ID: ${t.id}] ${t.text}${t.due_date ? ` (due ${t.due_date})` : ''}\n`;
          });
        }
      });
    }
  } catch {
    ctx += `\nACTIVE PROJECTS: (unavailable)\n`;
  }

  ctx += `\n\nACTIONS — Always respond with valid JSON only (no plain text outside JSON).\n`;
  ctx += `Response format: {"response":"Your reply","action":"action_type",...fields} or {"response":"..."} for no action.\n\n`;
  ctx += `SPRINT TASK ACTIONS (use SPRINT_ID from list above):\n`;
  ctx += `  Create:   {"response":"...","action":"add_sprint_task","title":"...","bucket":"...","tag":"action|decision|creative|ops|marketing|build|client|check"}\n`;
  ctx += `  Update:   {"response":"...","action":"update_sprint_task","task_id":"SPRINT_ID","updates":{"title":"...","bucket":"...","tag":"..."}}\n`;
  ctx += `  Complete: {"response":"...","action":"update_sprint_task","task_id":"SPRINT_ID","updates":{"done":true}}\n`;
  ctx += `  Reopen:   {"response":"...","action":"update_sprint_task","task_id":"SPRINT_ID","updates":{"done":false}}\n\n`;
  ctx += `PLANNER TASK ACTIONS (use TASK_ID / PROJECT_ID from list above):\n`;
  ctx += `  Create:   {"response":"...","action":"add_planner_task","project_id":"PROJECT_ID","text":"...","subtasks":[{"text":"..."}]}\n`;
  ctx += `  Update:   {"response":"...","action":"update_planner_task","task_id":"TASK_ID","updates":{"text":"...","due_date":"YYYY-MM-DD"}}\n`;
  ctx += `  Complete: {"response":"...","action":"update_planner_task","task_id":"TASK_ID","updates":{"completed":true}}\n`;
  ctx += `  Reopen:   {"response":"...","action":"update_planner_task","task_id":"TASK_ID","updates":{"completed":false}}\n\n`;
  ctx += `Sprint buckets: ${BUCKETS.join(', ')}. If bucket unclear, ask. Keep responses short (1-2 sentences max unless listing).`;

  return ctx;
}

export async function POST(req: NextRequest) {
  const { messages, week } = await req.json();

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  const system = await buildContext(week || '');
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system,
    messages,
  });

  const raw = (response.content.find((c: any) => c.type === 'text') as any)?.text || '';

  try {
    const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    const parsed = JSON.parse(cleaned);
    const content = parsed.response || '';

    // Sprint task: create
    if (parsed.action === 'add_sprint_task' && parsed.title && parsed.bucket) {
      await supabase.from('sprint_tasks').insert({
        title: parsed.title, bucket: parsed.bucket, tag: parsed.tag || 'action',
        done: false, sprint_week: week, sort_order: 99,
      });
      return NextResponse.json({ role: 'assistant', content, task_added: true, tasks_changed: true, tasks_count: 1, change_type: 'created' });
    }

    // Sprint task: update / complete
    if (parsed.action === 'update_sprint_task' && parsed.task_id && parsed.updates) {
      await supabase.from('sprint_tasks').update(parsed.updates).eq('id', parsed.task_id);
      const changeType = parsed.updates.done === true ? 'completed' : 'updated';
      return NextResponse.json({ role: 'assistant', content, task_added: false, tasks_changed: true, tasks_count: 1, change_type: changeType });
    }

    // Planner task: create
    if (parsed.action === 'add_planner_task' && parsed.project_id && parsed.text) {
      const { data: task, error } = await supabase
        .from('tasks')
        .insert({ project_id: parsed.project_id, text: parsed.text, completed: false, sort_order: 99 })
        .select().single();
      if (error) throw error;
      if (task && parsed.subtasks?.length) {
        await supabase.from('subtasks').insert(
          parsed.subtasks.map((st: any, i: number) => ({ task_id: task.id, text: st.text, completed: false, sort_order: i }))
        );
      }
      return NextResponse.json({ role: 'assistant', content, task_added: true, tasks_changed: true, tasks_count: 1, change_type: 'created' });
    }

    // Planner task: update / complete
    if (parsed.action === 'update_planner_task' && parsed.task_id && parsed.updates) {
      await supabase.from('tasks').update(parsed.updates).eq('id', parsed.task_id);
      const changeType = parsed.updates.completed === true ? 'completed' : 'updated';
      return NextResponse.json({ role: 'assistant', content, task_added: false, tasks_changed: true, tasks_count: 1, change_type: changeType });
    }

    // General response
    return NextResponse.json({ role: 'assistant', content, task_added: false, tasks_changed: false });
  } catch {
    return NextResponse.json({ role: 'assistant', content: raw, task_added: false, tasks_changed: false });
  }
}
