/**
 * /api/sidebar-counts
 *
 * GET — Returns lightweight counts for the sidebar badges:
 *       - inboxUnread: unread, non-dismissed, non-receipt emails
 *       - tasksOverdue: incomplete tasks past their due date
 */

import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = getServiceSupabase();
  const today = new Date().toISOString().split('T')[0];

  const [emailRes, taskRes] = await Promise.all([
    supabase
      .from('emails')
      .select('id', { count: 'exact', head: true })
      .eq('needs_followup', true)
      .eq('resolved', false)
      .eq('dismissed', false),
    supabase
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('completed', false)
      .lt('due_date', today),
  ]);

  return NextResponse.json({
    inboxFollowup: emailRes.count ?? 0,
    tasksOverdue: taskRes.count ?? 0,
  });
}
