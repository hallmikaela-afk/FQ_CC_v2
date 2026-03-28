import { NextResponse } from 'next/server';
import { isGoogleConnected } from '@/lib/google-drive';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const connected = await isGoogleConnected('default');
    return NextResponse.json({ connected });
  } catch {
    return NextResponse.json({ connected: false });
  }
}

export async function DELETE() {
  try {
    const { getServiceSupabase } = await import('@/lib/supabase');
    const supabase = getServiceSupabase();

    // Attempt to revoke the token at Google's endpoint first
    const { data } = await supabase
      .from('google_tokens')
      .select('access_token')
      .eq('user_id', 'default')
      .single();

    if (data?.access_token) {
      await fetch(`https://oauth2.googleapis.com/revoke?token=${data.access_token}`, {
        method: 'POST',
      }).catch(() => {
        // Revocation is best-effort — still proceed with local deletion
      });
    }

    await supabase.from('google_tokens').delete().eq('user_id', 'default');
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 });
  }
}
