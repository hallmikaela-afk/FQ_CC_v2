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

const SYSTEM = `You are a sprint task assistant for Fox & Quinn, a luxury wedding planning studio run by Mikaela. Your only job on this page is to help Mikaela manage her weekly sprint task list.

When she asks to add a task, extract:
- title: the task description
- bucket: match to the closest bucket from this list: ${BUCKETS.join(', ')}
- tag: one of: action, decision, creative, ops, marketing, build, client, check
  - action = emails, outreach, follow-ups
  - decision = things that need a decision made
  - creative = moodboards, design work, creative tasks
  - ops = operations, admin, payroll
  - marketing = marketing tasks
  - build = tech/dev work
  - client = client deliverables
  - check = checking or verifying something

Respond with a JSON object in this exact format when adding a task:
{"action":"add_task","title":"...","bucket":"...","tag":"..."}

If she asks to mark a task done, list tasks, or asks something general, respond in plain conversational text — no JSON. If you are not sure which bucket, ask her to clarify. Keep all responses short. One to two sentences max unless listing tasks.`;

export async function POST(req: NextRequest) {
  const { messages, week } = await req.json();

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    system: SYSTEM,
    messages,
  });

  const text = (response.content.find((c: any) => c.type === 'text') as any)?.text || '';

  // Try to parse as a task action
  try {
    const parsed = JSON.parse(text.trim());
    if (parsed.action === 'add_task' && parsed.title && parsed.bucket && parsed.tag) {
      const { data, error } = await supabase
        .from('sprint_tasks')
        .insert({
          title: parsed.title,
          bucket: parsed.bucket,
          tag: parsed.tag,
          done: false,
          sprint_week: week,
          sort_order: 99,
        })
        .select()
        .single();

      if (error) throw error;

      return NextResponse.json({
        role: 'assistant',
        content: `Added "${parsed.title}" to ${parsed.bucket}.`,
        task_added: true,
      });
    }
  } catch {
    // Not a task action — fall through to plain text response
  }

  return NextResponse.json({
    role: 'assistant',
    content: text,
    task_added: false,
  });
}
