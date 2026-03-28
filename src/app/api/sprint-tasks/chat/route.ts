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
  ctx += `  Create:   {"response":"...","action":"add_sprint_task","title":"...","bucket":"...","tag":"action|decision|creative|ops|marketing|build|client|check|research|book_vendor|other"}\n`;
  ctx += `  Update:   {"response":"...","action":"update_sprint_task","task_id":"SPRINT_ID","updates":{"title":"...","bucket":"...","tag":"..."}}\n`;
  ctx += `  Complete: {"response":"...","action":"update_sprint_task","task_id":"SPRINT_ID","updates":{"done":true}}\n`;
  ctx += `  Reopen:   {"response":"...","action":"update_sprint_task","task_id":"SPRINT_ID","updates":{"done":false}}\n\n`;
  ctx += `PLANNER TASK ACTIONS (use TASK_ID / PROJECT_ID from list above):\n`;
  ctx += `  Create:   {"response":"...","action":"add_planner_task","project_id":"PROJECT_ID","text":"...","subtasks":[{"text":"..."}]}\n`;
  ctx += `  Update:   {"response":"...","action":"update_planner_task","task_id":"TASK_ID","updates":{"text":"...","due_date":"YYYY-MM-DD"}}\n`;
  ctx += `  Complete: {"response":"...","action":"update_planner_task","task_id":"TASK_ID","updates":{"completed":true}}\n`;
  ctx += `  Reopen:   {"response":"...","action":"update_planner_task","task_id":"TASK_ID","updates":{"completed":false}}\n\n`;
  ctx += `Sprint buckets: ${BUCKETS.join(', ')}. If bucket unclear, ask. Keep responses short (1-2 sentences max unless listing).\n`;
  ctx += `IMPORTANT: When creating sprint task titles, do NOT append the project name to the title (e.g. use "Finalize design direction" not "Finalize design direction — Menorca Editorial"). The task is already filed under the correct project bucket.`;

  return ctx;
}

export async function POST(req: NextRequest) {
  const { messages, week, imageAttachments } = await req.json();

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  const system = await buildContext(week || '');
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // Attach any images to the last user message as vision content blocks
  const apiMessages = (messages as any[]).map((m: any, idx: number) => {
    if (
      m.role === 'user' &&
      idx === messages.length - 1 &&
      Array.isArray(imageAttachments) &&
      imageAttachments.length > 0
    ) {
      const parts: any[] = imageAttachments.map((img: any) => ({
        type: 'image',
        source: { type: 'base64', media_type: img.mediaType, data: img.base64 },
      }));
      parts.push({ type: 'text', text: m.content });
      return { role: m.role, content: parts };
    }
    return { role: m.role, content: m.content };
  });

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system,
    messages: apiMessages,
  });

  const raw = (response.content.find((c: any) => c.type === 'text') as any)?.text || '';

  // Extract all JSON objects from the response (Claude may return multiple for batch actions)
  function extractAllJSON(text: string): any[] {
    const results: any[] = [];
    const stripped = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    // Match top-level JSON objects
    let depth = 0, start = -1;
    for (let i = 0; i < stripped.length; i++) {
      if (stripped[i] === '{') { if (depth === 0) start = i; depth++; }
      else if (stripped[i] === '}') {
        depth--;
        if (depth === 0 && start >= 0) {
          try { results.push(JSON.parse(stripped.slice(start, i + 1))); } catch { /* skip malformed */ }
          start = -1;
        }
      }
    }
    return results;
  }

  try {
    const objects = extractAllJSON(raw);
    if (objects.length === 0) throw new Error('no JSON');

    let responseText = '';
    let tasks_changed = false;
    let tasks_count = 0;
    const changeTypes = new Set<string>();

    for (const parsed of objects) {
      if (parsed.response) responseText = parsed.response;

      // Sprint task: create
      if (parsed.action === 'add_sprint_task' && parsed.title && parsed.bucket) {
        await supabase.from('sprint_tasks').insert({
          title: parsed.title, bucket: parsed.bucket, tag: parsed.tag || 'action',
          done: false, sprint_week: week, sort_order: 99,
        });
        tasks_changed = true; tasks_count++; changeTypes.add('created');
      }

      // Sprint task: update / complete
      if (parsed.action === 'update_sprint_task' && parsed.task_id && parsed.updates) {
        await supabase.from('sprint_tasks').update(parsed.updates).eq('id', parsed.task_id);
        tasks_changed = true; tasks_count++;
        changeTypes.add(parsed.updates.done === true ? 'completed' : 'updated');
      }

      // Planner task: create
      if (parsed.action === 'add_planner_task' && parsed.project_id && parsed.text) {
        const { data: task, error } = await supabase
          .from('tasks')
          .insert({ project_id: parsed.project_id, text: parsed.text, completed: false, sort_order: 99 })
          .select().single();
        if (!error && task && parsed.subtasks?.length) {
          await supabase.from('subtasks').insert(
            parsed.subtasks.map((st: any, i: number) => ({ task_id: task.id, text: st.text, completed: false, sort_order: i }))
          );
        }
        tasks_changed = true; tasks_count++; changeTypes.add('created');
      }

      // Planner task: update / complete
      if (parsed.action === 'update_planner_task' && parsed.task_id && parsed.updates) {
        await supabase.from('tasks').update(parsed.updates).eq('id', parsed.task_id);
        tasks_changed = true; tasks_count++;
        changeTypes.add(parsed.updates.completed === true ? 'completed' : 'updated');
      }
    }

    // If the AI returned an empty response but did work, generate a brief confirmation
    if (!responseText && tasks_changed) {
      const verb = changeTypes.has('created') ? `Added ${tasks_count} task${tasks_count > 1 ? 's' : ''}` :
                   changeTypes.has('completed') ? `Completed ${tasks_count} task${tasks_count > 1 ? 's' : ''}` :
                   `Updated ${tasks_count} task${tasks_count > 1 ? 's' : ''}`;
      responseText = verb + '.';
    }

    const change_type = changeTypes.size > 1 ? 'mixed' : changeTypes.size === 1 ? [...changeTypes][0] as any : null;
    return NextResponse.json({
      role: 'assistant', content: responseText,
      task_added: changeTypes.has('created'), tasks_changed, tasks_count, change_type,
    });
  } catch {
    // Last resort: return a generic error rather than the raw JSON
    return NextResponse.json({ role: 'assistant', content: 'Something went wrong processing that request.', task_added: false, tasks_changed: false });
  }
}
