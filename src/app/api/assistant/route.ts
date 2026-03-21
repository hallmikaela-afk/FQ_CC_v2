import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { projects as seedProjects, team as seedTeam } from '@/data/seed';

export const dynamic = 'force-dynamic';

function getAnthropic() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

// Try to load Supabase client; returns null if env vars are missing
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

// Build context from Supabase if available, otherwise fall back to seed data
async function buildContext(): Promise<{ context: string; projectMap: Record<string, string> }> {
  const today = new Date().toISOString().split('T')[0];

  let context = `You are the AI assistant for Fox & Quinn, a luxury wedding and event planning company run by Mikaela Hall. You help manage projects, tasks, vendors, and client communications.\n\n`;
  context += `Today is ${today}.\n\n`;

  // projectMap: name -> id (for task creation)
  const projectMap: Record<string, string> = {};

  const supabase = tryGetSupabase();

  if (supabase) {
    // Use live Supabase data
    const [projectsRes, tasksRes, teamRes] = await Promise.all([
      supabase.from('projects').select('id, name, type, status, event_date, venue_name, venue_location, concept, service_tier, guest_count, estimated_budget').order('event_date'),
      supabase.from('tasks').select('id, project_id, text, completed, status, due_date, category, priority, assigned_to').eq('completed', false).order('due_date'),
      supabase.from('team_members').select('*'),
    ]);

    const projects: any[] = projectsRes.data || [];
    const tasks: any[] = tasksRes.data || [];
    const team: any[] = teamRes.data || [];

    projects.forEach((p: any) => { projectMap[p.name] = p.id; });

    const overdue = tasks.filter((t: any) => t.due_date && t.due_date < today);

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
  } else {
    // Fall back to seed data
    context += `TEAM:\n`;
    seedTeam.forEach(t => { context += `- ${t.name} (${t.role})\n`; });

    context += `\nACTIVE PROJECTS:\n`;
    seedProjects.forEach(p => {
      projectMap[p.name] = p.id;
      const openTasks = (p.tasks || []).filter(t => !t.completed);
      const overdueTasks = openTasks.filter(t => t.due_date && t.due_date < today);
      context += `- ${p.name} (${p.type}, ${p.status}) — ${p.event_date || 'no date'}, ${p.venue_name || p.concept || ''} [ID: ${p.id}]\n`;
      context += `  Open tasks: ${openTasks.length}${overdueTasks.length > 0 ? ` (${overdueTasks.length} overdue)` : ''}\n`;

      if (p.vendors && p.vendors.length > 0) {
        context += `  Vendors: ${p.vendors.map(v => `${v.vendor_name} (${v.category})`).join(', ')}\n`;
      }
    });

    // Aggregate overdue tasks across all projects
    const allOverdue: { text: string; due_date: string; project: string }[] = [];
    seedProjects.forEach(p => {
      (p.tasks || []).forEach(t => {
        if (!t.completed && t.due_date && t.due_date < today) {
          allOverdue.push({ text: t.text, due_date: t.due_date, project: p.name });
        }
      });
    });

    if (allOverdue.length > 0) {
      context += `\nOVERDUE TASKS (${allOverdue.length}):\n`;
      allOverdue.forEach(t => {
        context += `- "${t.text}" — due ${t.due_date} (${t.project})\n`;
      });
    }

    // Include call notes summaries
    seedProjects.forEach(p => {
      if (p.call_notes && p.call_notes.length > 0) {
        context += `\nRECENT CALL NOTES — ${p.name}:\n`;
        p.call_notes.forEach(cn => {
          context += `- ${cn.date}${cn.title ? ` — ${cn.title}` : ''}: ${cn.summary || cn.raw_text.slice(0, 200)}\n`;
          const openActions = cn.extracted_actions.filter(a => a.accepted && !a.dismissed);
          if (openActions.length > 0) {
            context += `  Action items: ${openActions.map(a => a.text).join('; ')}\n`;
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

  context += `\nSPRINT TASKS: You can help Mikaela manage her weekly sprint. Sprint tasks are separate from the master planner task list. Valid buckets: ${BUCKETS.join(', ')}. Valid tags: action, decision, creative, ops, marketing, build, client, check.\n`;

  context += `\nTASK CREATION: You CAN and SHOULD directly create tasks in the database when asked. Always respond with valid JSON in this exact format — no plain text outside the JSON:\n`;
  context += `{"response":"Your conversational reply here","actions":[{"type":"create_planner_task","project_id":"PROJECT_ID","text":"task title","subtasks":[{"text":"subtask 1"},{"text":"subtask 2"}]}]}\n`;
  context += `For sprint tasks use: {"type":"create_sprint_task","title":"...","bucket":"...","tag":"..."}\n`;
  context += `When no action is needed, just: {"response":"Your reply"}\n`;
  context += `Use the project [ID: ...] values from ACTIVE PROJECTS above as project_id. Always output valid JSON only.\n`;

  context += `\nRESEARCH LINKS: When listing companies or vendors, format each as an inline link on the company name: - [Company Name](https://url) - Brief description. Only link to real, well-known websites you are confident exist. Always use standard markdown links [text](url).`;

  return { context, projectMap };
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

    const { context } = await buildContext();

    const response = await getAnthropic().messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: context,
      messages: messages.map((m: any) => ({
        role: m.role,
        content: m.content,
      })),
    });

    const rawText = (response.content.find((c: any) => c.type === 'text') as any)?.text || '';

    // Try to parse structured JSON response with optional actions
    let content = rawText;
    let tasks_added = false;
    let tasks_count = 0;

    try {
      // Strip markdown code fences if Claude wrapped the JSON
      const cleaned = rawText.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
      const parsed = JSON.parse(cleaned);

      content = parsed.response || rawText;

      if (parsed.actions && Array.isArray(parsed.actions)) {
        const supabase = tryGetSupabase();

        for (const action of parsed.actions) {
          if (action.type === 'create_planner_task' && action.project_id && action.text) {
            if (supabase) {
              const { data: task, error } = await supabase
                .from('tasks')
                .insert({ project_id: action.project_id, text: action.text, completed: false, sort_order: 99 })
                .select()
                .single();

              if (!error && task) {
                tasks_added = true;
                tasks_count++;
                if (action.subtasks?.length) {
                  await supabase.from('subtasks').insert(
                    action.subtasks.map((st: any, i: number) => ({
                      task_id: task.id,
                      text: st.text,
                      completed: false,
                      sort_order: i,
                    }))
                  );
                }
              }
            } else {
              // No DB available — still acknowledge
              tasks_added = true;
              tasks_count++;
            }
          } else if (action.type === 'create_sprint_task' && action.title && action.bucket) {
            if (supabase) {
              const currentWeek = new Date().toISOString().split('T')[0].slice(0, 7);
              await supabase.from('sprint_tasks').insert({
                title: action.title,
                bucket: action.bucket,
                tag: action.tag || 'action',
                done: false,
                sprint_week: currentWeek,
                sort_order: 99,
              });
              tasks_added = true;
              tasks_count++;
            }
          }
        }
      }
    } catch {
      // Not JSON — plain text response, use as-is
      content = rawText;
    }

    return NextResponse.json({ role: 'assistant', content, tasks_added, tasks_count });
  } catch (err: any) {
    console.error('Assistant API error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to get response from Claude' },
      { status: 500 }
    );
  }
}
