/**
 * /api/emails/triage
 *
 * POST — Tag an email to a project, optionally create a follow-up task,
 *        and optionally add sender to vendor directory.
 */

import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

interface TriageBody {
  email_id: string;
  project_id: string | null;           // null → "None / General"
  needs_followup: boolean;
  followup_due_date?: string | null;    // ISO date string "YYYY-MM-DD"
  add_vendor?: boolean;
  vendor_name?: string;
  vendor_email?: string;
  // email subject/from for task creation
  email_subject?: string;
  from_name?: string;
}

export async function POST(request: Request) {
  const supabase = getServiceSupabase();
  const body: TriageBody = await request.json();

  const {
    email_id,
    project_id,
    needs_followup,
    followup_due_date,
    add_vendor,
    vendor_name,
    vendor_email,
    email_subject,
  } = body;

  if (!email_id) {
    return NextResponse.json({ error: 'Missing email_id' }, { status: 400 });
  }

  // ── 1. Tag the email ──────────────────────────────────────────────────────
  const { error: emailError } = await supabase
    .from('emails')
    .update({
      project_id: project_id ?? null,
      match_confidence: project_id ? 'exact' : null,
      needs_followup,
      followup_due_date: followup_due_date ?? null,
    })
    .eq('id', email_id);

  if (emailError) {
    return NextResponse.json({ error: emailError.message }, { status: 500 });
  }

  const results: Record<string, unknown> = { email_updated: true };

  // ── 2. Create follow-up task ──────────────────────────────────────────────
  if (needs_followup && project_id && email_subject) {
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .insert({
        project_id,
        text: `Follow up: ${email_subject}`,
        completed: false,
        due_date: followup_due_date ?? null,
        category: 'Communication',
        priority: 'medium',
        sort_order: 0,
      })
      .select()
      .single();

    if (taskError) {
      console.error('[triage] Task creation error:', taskError.message);
    } else {
      results.task_created = task;
    }
  }

  // ── 3. Add to vendor directory ────────────────────────────────────────────
  if (add_vendor && vendor_name && vendor_email && project_id) {
    const { data: vendor, error: vendorError } = await supabase
      .from('vendors')
      .insert({
        project_id,
        vendor_name,
        email: vendor_email,
        category: null,
      })
      .select()
      .single();

    if (vendorError) {
      console.error('[triage] Vendor insert error:', vendorError.message);
    } else {
      results.vendor_added = vendor;
    }
  }

  return NextResponse.json(results);
}
