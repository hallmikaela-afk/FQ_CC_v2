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
      .eq('is_read', false)
      .eq('dismissed', false)
      .or('category.is.null,category.neq.receipt'),
    supabase
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('completed', false)
      .lt('due_date', today),
  ]);

  return NextResponse.json({
    inboxUnread: emailRes.count ?? 0,
    tasksOverdue: taskRes.count ?? 0,
  });
}
