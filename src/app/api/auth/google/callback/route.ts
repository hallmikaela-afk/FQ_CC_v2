import { NextResponse } from 'next/server';
import { storeGoogleTokens } from '@/lib/google-drive';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  const errorDescription = url.searchParams.get('error_description');

  if (error) {
    const redirectUrl = new URL('/projects', url.origin);
    redirectUrl.searchParams.set('drive_error', errorDescription ?? error);
    return NextResponse.redirect(redirectUrl);
  }

  if (!code) {
    const redirectUrl = new URL('/projects', url.origin);
    redirectUrl.searchParams.set('drive_error', 'No authorization code received.');
    return NextResponse.redirect(redirectUrl);
  }

  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;

  if (!clientId || !clientSecret) {
    console.error('[auth/google/callback] Missing Google env vars');
    const redirectUrl = new URL('/projects', url.origin);
    redirectUrl.searchParams.set('drive_error', 'Server misconfiguration: missing Google credentials.');
    return NextResponse.redirect(redirectUrl);
  }

  const appOrigin = process.env.NEXT_PUBLIC_APP_URL ?? url.origin;
  const redirectUri = `${appOrigin}/api/auth/google/callback`;

  console.log('[auth/google/callback] exchanging code, redirectUri:', redirectUri);

  // Exchange code for tokens
  const tokenParams = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });

  let tokensRes: Response;
  try {
    tokensRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenParams.toString(),
    });
  } catch (err) {
    console.error('[auth/google/callback] token fetch threw:', err);
    const redirectUrl = new URL('/projects', url.origin);
    redirectUrl.searchParams.set('drive_error', 'Token request failed. Please try again.');
    return NextResponse.redirect(redirectUrl);
  }

  if (!tokensRes.ok) {
    const body = await tokensRes.text().catch(() => '');
    console.error('[auth/google/callback] token exchange failed:', tokensRes.status, body);
    const redirectUrl = new URL('/projects', url.origin);
    redirectUrl.searchParams.set('drive_error', `Token exchange failed: ${body.substring(0, 200)}`);
    return NextResponse.redirect(redirectUrl);
  }

  const tokens = await tokensRes.json();
  console.log('[auth/google/callback] token exchange OK, has_refresh:', !!tokens.refresh_token);

  try {
    await storeGoogleTokens(
      'default',
      tokens.access_token,
      tokens.refresh_token ?? null,
      tokens.expires_in,
      tokens.scope ?? '',
    );
  } catch (err) {
    console.error('[auth/google/callback] storeGoogleTokens failed:', err);
    const errUrl = new URL('/projects', url.origin);
    errUrl.searchParams.set('drive_error', 'Failed to save token. Check server logs.');
    return NextResponse.redirect(errUrl);
  }

  console.log('[auth/google/callback] token stored successfully, redirecting to projects');

  const redirectUrl = new URL('/projects', url.origin);
  redirectUrl.searchParams.set('drive_success', '1');
  return NextResponse.redirect(redirectUrl);
}
