import { NextResponse } from 'next/server';
import { isConnected } from '@/lib/microsoft-graph';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const connected = await isConnected('default');
    return NextResponse.json({ connected });
  } catch {
    return NextResponse.json({ connected: false });
  }
}

export async function DELETE() {
  // Disconnect: remove tokens from Supabase
  try {
    const { getServiceSupabase } = await import('@/lib/supabase');
    const supabase = getServiceSupabase();
    await supabase.from('microsoft_tokens').delete().eq('user_id', 'default');
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 });
  }
}
