import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { projects as seedProjects, team as seedTeam } from '@/data/seed';

export const dynamic = 'force-dynamic';

function getAnthropic() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

function tryGetSupabase() {
  try {
    const { getServiceSupabase } = require('@/lib/supabase');
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    return getServiceSupabase();
  } catch {
    return null;
  }
}

function currentWeekStr() {
  // Returns YYYY-Www (ISO week) used as sprint_week key
  const now = new Date();
  const jan4 = new Date(now.getFullYear(), 0, 4);
  const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000);
  const week = Math.ceil((dayOfYear + jan4.getDay()) / 7);
  return `${now.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

async function buildContext(): Promise<string> {
  const today = new Date().toISOString().split('T')[0];

  let context = `You are the AI assistant for Fox & Quinn, a luxury wedding and event planning company run by Mikaela Hall. You help manage projects, tasks, vendors, and client communications.\n\n`;
  context += `Today is ${today}.\n\n`;

  const supabase = tryGetSupabase();

  if (supabase) {
    const [projectsRes, tasksRes, teamRes, sprintRes] = await Promise.all([
      supabase.from('projects').select('id, name, type, status, event_date, venue_name, concept').order('event_date'),
      supabase.from('tasks').select('id, project_id, text, completed, due_date, category').eq('completed', false).order('due_date'),
      supabase.from('team_members').select('*'),
      supabase.from('sprint_tasks').select('id, title, bucket, tag, done').eq('done', false).order('sort_order'),
    ]);

    const projects: any[] = projectsRes.data || [];
    const tasks: any[] = tasksRes.data || [];
    const team: any[] = teamRes.data || [];
    const sprintTasks: any[] = sprintRes.data || [];

    const overdue = tasks.filter((t: any) => t.due_date && t.due_date < today);

    context += `TEAM:\n`;
    team.forEach((t: any) => { context += `- ${t.name} (${t.role}) [ID: ${t.id}]\n`; });

    context += `\nACTIVE PROJECTS & PLANNER TASKS:\n`;
    projects.forEach((p: any) => {
      const projectTasks = tasks.filter((t: any) => t.project_id === p.id);
      context += `\n## ${p.name} [PROJECT_ID: ${p.id}]\n`;
      context += `   ${p.type}, ${p.status}, ${p.event_date || 'no date'}, ${p.venue_name || p.concept || ''}\n`;
      if (projectTasks.length === 0) {
        context += `   No open tasks.\n`;
      } else {
        projectTasks.forEach((t: any) => {
          context += `   - [TASK_ID: ${t.id}] ${t.text}${t.due_date ? ` (due ${t.due_date})` : ''}${t.category ? ` [${t.category}]` : ''}\n`;
        });
      }
    });

    if (overdue.length > 0) {
      context += `\nOVERDUE:\n`;
      overdue.forEach((t: any) => {
        const proj = projects.find((p: any) => p.id === t.project_id);
        context += `- [TASK_ID: ${t.id}] "${t.text}" — due ${t.due_date} (${proj?.name || 'unknown'})\n`;
      });
    }

    if (sprintTasks.length > 0) {
      context += `\nCURRENT SPRINT (open tasks):\n`;
      sprintTasks.forEach((t: any) => {
        context += `- [SPRINT_ID: ${t.id}] ${t.title} — ${t.bucket} [${t.tag}]\n`;
      });
    }
  } else {
    // Seed data fallback
    context += `TEAM:\n`;
    seedTeam.forEach(t => { context += `- ${t.name} (${t.role})\n`; });

    context += `\nACTIVE PROJECTS & PLANNER TASKS:\n`;
    seedProjects.forEach(p => {
      const openTasks = (p.tasks || []).filter((t: any) => !t.completed);
      context += `\n## ${p.name} [PROJECT_ID: ${p.id}]\n`;
      context += `   ${p.type}, ${p.status}, ${p.event_date || 'no date'}, ${p.venue_name || p.concept || ''}\n`;
      if (openTasks.length === 0) {
        context += `   No open tasks.\n`;
      } else {
        openTasks.forEach((t: any) => {
          context += `   - [TASK_ID: ${t.id}] ${t.text}${t.due_date ? ` (due ${t.due_date})` : ''}\n`;
        });
      }
      if (p.vendors?.length) {
        context += `   Vendors: ${p.vendors.map((v: any) => `${v.vendor_name} (${v.category})`).join(', ')}\n`;
      }
    });

    const allOverdue: { text: string; due_date: string; project: string }[] = [];
    seedProjects.forEach(p => {
      (p.tasks || []).forEach((t: any) => {
        if (!t.completed && t.due_date && t.due_date < today) {
          allOverdue.push({ text: t.text, due_date: t.due_date, project: p.name });
        }
      });
    });
    if (allOverdue.length > 0) {
      context += `\nOVERDUE:\n`;
      allOverdue.forEach(t => { context += `- "${t.text}" — due ${t.due_date} (${t.project})\n`; });
    }

    seedProjects.forEach(p => {
      if (p.call_notes?.length) {
        context += `\nCALL NOTES — ${p.name}:\n`;
        p.call_notes.forEach(cn => {
          context += `- ${cn.date}${cn.title ? ` — ${cn.title}` : ''}: ${cn.summary || cn.raw_text.slice(0, 200)}\n`;
          const openActions = cn.extracted_actions.filter(a => a.accepted && !a.dismissed);
          if (openActions.length) {
            context += `  Actions: ${openActions.map(a => a.text).join('; ')}\n`;
          }
        });
      }
    });
  }

  const BUCKETS = [
    'Sun-Steeped Hamptons', 'Menorca Editorial', 'Elisabeth & JJ — LionRock Farm',
    'Julia & Frank — Wave Resort', 'Tippi & Justin — Vanderbilt Museum',
    'Fox & Quinn — Operations', 'Fox & Quinn — Marketing', 'FQ Command Center',
  ];

  context += `\n\nACTIONS — Always respond with valid JSON only. Use the "actions" array for any database writes. Multiple actions allowed.\n`;
  context += `Response format: {"response":"Your reply","actions":[...]} — or just {"response":"..."} when no DB action needed.\n\n`;
  context += `PLANNER TASK ACTIONS (use PROJECT_ID / TASK_ID values listed above):\n`;
  context += `  Create:   {"type":"create_planner_task","project_id":"...","text":"...","subtasks":[{"text":"..."}]}\n`;
  context += `  Update:   {"type":"update_planner_task","task_id":"...","updates":{"text":"...","due_date":"YYYY-MM-DD","category":"..."}}\n`;
  context += `  Complete: {"type":"update_planner_task","task_id":"...","updates":{"completed":true}}\n`;
  context += `  Reopen:   {"type":"update_planner_task","task_id":"...","updates":{"completed":false}}\n\n`;
  context += `SPRINT TASK ACTIONS (use SPRINT_ID values listed above):\n`;
  context += `  Create:   {"type":"create_sprint_task","title":"...","bucket":"one of: ${BUCKETS.join(' | ')}","tag":"action|decision|creative|ops|marketing|build|client|check"}\n`;
  context += `  Update:   {"type":"update_sprint_task","task_id":"...","updates":{"title":"...","bucket":"...","tag":"..."}}\n`;
  context += `  Complete: {"type":"update_sprint_task","task_id":"...","updates":{"done":true}}\n`;
  context += `  Reopen:   {"type":"update_sprint_task","task_id":"...","updates":{"done":false}}\n`;

  context += `\nRESEARCH LINKS: When listing vendors or companies, format as: - [Company Name](https://url) - Brief description. Only link to real, well-known sites. Always use markdown links [text](url).`;

  return context;
}

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY not configured. Add it to your .env.local file.' },
      { status: 500 }
    );
  }

  try {
    const { messages } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'messages array required' }, { status: 400 });
    }

    const context = await buildContext();

    const response = await getAnthropic().messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: context,
      messages: messages.map((m: any) => ({ role: m.role, content: m.content })),
    });

    const rawText = (response.content.find((c: any) => c.type === 'text') as any)?.text || '';

    let content = rawText;
    let tasks_changed = false;
    let tasks_count = 0;
    let change_type: 'created' | 'updated' | 'completed' | 'mixed' | null = null;

    try {
      const cleaned = rawText.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
      const parsed = JSON.parse(cleaned);
      content = parsed.response || rawText;

      if (parsed.actions && Array.isArray(parsed.actions)) {
        const supabase = tryGetSupabase();
        const changeTypes = new Set<string>();

        for (const action of parsed.actions) {
          // --- Planner: create ---
          if (action.type === 'create_planner_task' && action.project_id && action.text) {
            if (supabase) {
              const { data: task, error } = await supabase
                .from('tasks')
                .insert({ project_id: action.project_id, text: action.text, completed: false, sort_order: 99 })
                .select().single();
              if (!error && task) {
                tasks_changed = true; tasks_count++; changeTypes.add('created');
                if (action.subtasks?.length) {
                  await supabase.from('subtasks').insert(
                    action.subtasks.map((st: any, i: number) => ({ task_id: task.id, text: st.text, completed: false, sort_order: i }))
                  );
                }
              }
            } else {
              tasks_changed = true; tasks_count++; changeTypes.add('created');
            }
          }

          // --- Planner: update / complete ---
          if (action.type === 'update_planner_task' && action.task_id && action.updates) {
            if (supabase) {
              const { error } = await supabase.from('tasks').update(action.updates).eq('id', action.task_id);
              if (!error) {
                tasks_changed = true; tasks_count++;
                changeTypes.add(action.updates.completed === true ? 'completed' : 'updated');
              }
            } else {
              tasks_changed = true; tasks_count++;
              changeTypes.add(action.updates.completed === true ? 'completed' : 'updated');
            }
          }

          // --- Sprint: create ---
          if (action.type === 'create_sprint_task' && action.title && action.bucket) {
            if (supabase) {
              await supabase.from('sprint_tasks').insert({
                title: action.title, bucket: action.bucket, tag: action.tag || 'action',
                done: false, sprint_week: currentWeekStr(), sort_order: 99,
              });
              tasks_changed = true; tasks_count++; changeTypes.add('created');
            }
          }

          // --- Sprint: update / complete ---
          if (action.type === 'update_sprint_task' && action.task_id && action.updates) {
            if (supabase) {
              const { error } = await supabase.from('sprint_tasks').update(action.updates).eq('id', action.task_id);
              if (!error) {
                tasks_changed = true; tasks_count++;
                changeTypes.add(action.updates.done === true ? 'completed' : 'updated');
              }
            } else {
              tasks_changed = true; tasks_count++;
              changeTypes.add(action.updates.done === true ? 'completed' : 'updated');
            }
          }
        }

        if (changeTypes.size > 1) change_type = 'mixed';
        else if (changeTypes.size === 1) change_type = [...changeTypes][0] as 'created' | 'updated' | 'completed' | 'mixed';
      }
    } catch {
      content = rawText;
    }

    return NextResponse.json({ role: 'assistant', content, tasks_changed, tasks_count, change_type });
  } catch (err: any) {
    console.error('Assistant API error:', err);
    return NextResponse.json({ error: err.message || 'Failed to get response from Claude' }, { status: 500 });
  }
}
