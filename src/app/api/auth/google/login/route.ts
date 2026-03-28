import { NextResponse } from 'next/server';
import { GOOGLE_SCOPES } from '@/lib/google-drive';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const clientId = process.env.GOOGLE_CLIENT_ID;

  if (!clientId) {
    return NextResponse.json(
      { error: 'Google OAuth is not configured. Set GOOGLE_CLIENT_ID.' },
      { status: 500 },
    );
  }

  const url = new URL(request.url);
  const appOrigin = process.env.NEXT_PUBLIC_APP_URL ?? url.origin;
  const redirectUri = `${appOrigin}/api/auth/google/callback`;

  // Random state for CSRF protection
  const state = Math.random().toString(36).substring(2, 18);

  const authParams = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GOOGLE_SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state,
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${authParams}`;
  return NextResponse.redirect(authUrl);
}
