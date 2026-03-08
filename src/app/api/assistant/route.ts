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
async function buildContext(): Promise<string> {
  const today = new Date().toISOString().split('T')[0];

  let context = `You are the AI assistant for Fox & Quinn, a luxury wedding and event planning company run by Mikaela Hall. You help manage projects, tasks, vendors, and client communications.\n\n`;
  context += `Today is ${today}.\n\n`;

  const supabase = tryGetSupabase();

  if (supabase) {
    // Use live Supabase data — fetch everything for full context
    const [projectsRes, tasksRes, teamRes, vendorsRes] = await Promise.all([
      supabase.from('projects').select('*').order('event_date'),
      supabase.from('tasks').select('*').order('due_date'),
      supabase.from('team_members').select('*'),
      supabase.from('vendors').select('*'),
    ]);

    const projects: any[] = projectsRes.data || [];
    const tasks: any[] = tasksRes.data || [];
    const team: any[] = teamRes.data || [];
    const vendors: any[] = vendorsRes.data || [];

    context += `TEAM:\n`;
    team.forEach((t: any) => { context += `- ${t.name} (${t.role}) [ID: ${t.id}]\n`; });

    projects.forEach((p: any) => {
      const projectTasks = tasks.filter((t: any) => t.project_id === p.id);
      const openTasks = projectTasks.filter((t: any) => !t.completed);
      const overdueTasks = openTasks.filter((t: any) => t.due_date && t.due_date < today);
      const projectVendors = vendors.filter((v: any) => v.project_id === p.id);

      context += `\n${'='.repeat(60)}\n`;
      context += `PROJECT: ${p.name}\n`;
      context += `Type: ${p.type} | Status: ${p.status} | Event date: ${p.event_date || 'TBD'}\n`;
      if (p.venue_name) context += `Venue: ${p.venue_name}${p.venue_location ? ` — ${p.venue_location}` : ''}\n`;
      if (p.concept) context += `Concept: ${p.concept}\n`;
      if (p.service_tier) context += `Service tier: ${p.service_tier}\n`;
      if (p.guest_count) context += `Guest count: ${p.guest_count}\n`;
      if (p.estimated_budget) context += `Budget: ${p.estimated_budget}\n`;

      if (projectVendors.length > 0) {
        context += `\nVENDORS (${projectVendors.length}):\n`;
        projectVendors.forEach((v: any) => {
          context += `  - ${v.vendor_name} [${v.category}]`;
          if (v.contact_name) context += ` | Contact: ${v.contact_name}`;
          if (v.email) context += ` | Email: ${v.email}`;
          if (v.phone) context += ` | Phone: ${v.phone}`;
          if (v.website) context += ` | Web: ${v.website}`;
          if (v.instagram) context += ` | IG: ${v.instagram}`;
          context += `\n`;
        });
      } else {
        context += `\nVENDORS: None added yet\n`;
      }

      if (openTasks.length > 0) {
        context += `\nOPEN TASKS (${openTasks.length}):\n`;
        openTasks.forEach((t: any) => {
          const overdue = t.due_date && t.due_date < today ? ' [OVERDUE]' : '';
          context += `  - ${t.text}`;
          if (t.due_date) context += ` | Due: ${t.due_date}${overdue}`;
          if (t.category) context += ` | Category: ${t.category}`;
          if (t.priority) context += ` | Priority: ${t.priority}`;
          if (t.assigned_to) {
            const member = team.find((m: any) => m.id === t.assigned_to);
            if (member) context += ` | Assigned: ${member.name}`;
          }
          context += `\n`;
        });
      }
    });
  } else {
    // Fall back to seed data — include FULL detail so the assistant has complete context
    context += `TEAM:\n`;
    seedTeam.forEach(t => { context += `- ${t.name} (${t.role})\n`; });

    // Full project details
    seedProjects.forEach(p => {
      context += `\n${'='.repeat(60)}\n`;
      context += `PROJECT: ${p.name}\n`;
      context += `Type: ${p.type} | Status: ${p.status} | Event date: ${p.event_date || 'TBD'}\n`;
      if (p.venue_name) context += `Venue: ${p.venue_name}${p.venue_location ? ` — ${p.venue_location}` : ''}\n`;
      if (p.concept) context += `Concept: ${p.concept}\n`;
      if (p.service_tier) context += `Service tier: ${p.service_tier}\n`;
      if (p.guest_count) context += `Guest count: ${p.guest_count}\n`;
      if (p.estimated_budget) context += `Budget: ${p.estimated_budget}\n`;
      if (p.client1_name || p.client2_name) context += `Clients: ${[p.client1_name, p.client2_name].filter(Boolean).join(' & ')}\n`;

      // Full vendor details
      if (p.vendors && p.vendors.length > 0) {
        context += `\nVENDORS (${p.vendors.length}):\n`;
        p.vendors.forEach(v => {
          context += `  - ${v.vendor_name} [${v.category}]`;
          if (v.contact_name) context += ` | Contact: ${v.contact_name}`;
          if (v.email) context += ` | Email: ${v.email}`;
          if (v.phone) context += ` | Phone: ${v.phone}`;
          if (v.website) context += ` | Web: ${v.website}`;
          if (v.instagram) context += ` | IG: ${v.instagram}`;
          context += `\n`;
        });
      } else {
        context += `\nVENDORS: None added yet\n`;
      }

      // Full task details (open tasks)
      const openTasks = (p.tasks || []).filter(t => !t.completed);
      const completedTasks = (p.tasks || []).filter(t => t.completed);
      if (openTasks.length > 0) {
        context += `\nOPEN TASKS (${openTasks.length}):\n`;
        openTasks.forEach(t => {
          const overdue = t.due_date && t.due_date < today ? ' [OVERDUE]' : '';
          context += `  - ${t.text}`;
          if (t.due_date) context += ` | Due: ${t.due_date}${overdue}`;
          if (t.category) context += ` | Category: ${t.category}`;
          if (t.priority) context += ` | Priority: ${t.priority}`;
          if (t.assigned_to) {
            const member = seedTeam.find(m => m.id === t.assigned_to);
            if (member) context += ` | Assigned: ${member.name}`;
          }
          if (t.notes) context += ` | Notes: ${t.notes}`;
          context += `\n`;
          if (t.subtasks && t.subtasks.length > 0) {
            t.subtasks.forEach(st => {
              context += `    ${st.completed ? '[x]' : '[ ]'} ${st.text}\n`;
            });
          }
        });
      }
      context += `Completed tasks: ${completedTasks.length}\n`;

      // Full call notes with raw text
      if (p.call_notes && p.call_notes.length > 0) {
        context += `\nCALL NOTES:\n`;
        p.call_notes.forEach(cn => {
          context += `  --- ${cn.date}${cn.title ? ` — ${cn.title}` : ''} ---\n`;
          if (cn.summary) context += `  Summary: ${cn.summary}\n`;
          // Include raw text (truncate very long notes to keep context manageable)
          const rawText = cn.raw_text.length > 1500 ? cn.raw_text.slice(0, 1500) + '...' : cn.raw_text;
          context += `  Notes: ${rawText}\n`;
          const openActions = cn.extracted_actions.filter(a => a.accepted && !a.dismissed);
          if (openActions.length > 0) {
            context += `  Open action items:\n`;
            openActions.forEach(a => {
              context += `    - ${a.text} (due: ${a.due_date})\n`;
            });
          }
        });
      }
    });
  }

  context += `\nYou have web search capability. When the user asks you to research vendors, find contacts, look up venues, or anything that requires current real-world information, USE your web search tool to find real results. Do not tell the user you can't search — you CAN.`;
  context += `\nWhen the user asks to update tasks, mark things complete, add vendors, etc., describe what you would do. The actual database operations happen through the app's UI. Focus on being a helpful planning assistant — summarize, prioritize, flag issues, and advise.`;

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
      max_tokens: 4096,
      system: context,
      tools: [
        {
          type: 'web_search_20250305' as any,
          name: 'web_search',
          max_uses: 5,
        } as any,
      ],
      messages: messages.map((m: any) => ({
        role: m.role,
        content: m.content,
      })),
    });

    // Extract all text blocks from the response (web search may produce multiple)
    const textParts = response.content
      .filter((c: any) => c.type === 'text')
      .map((c: any) => c.text);
    const fullText = textParts.join('\n\n');

    return NextResponse.json({
      role: 'assistant',
      content: fullText || '',
    });
  } catch (err: any) {
    console.error('Assistant API error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to get response from Claude' },
      { status: 500 }
    );
  }
}
