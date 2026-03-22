import { NextResponse } from 'next/server';
import { storeTokens } from '@/lib/microsoft-graph';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  const errorDescription = url.searchParams.get('error_description');

  if (error) {
    const redirectUrl = new URL('/inbox', url.origin);
    redirectUrl.searchParams.set('auth_error', errorDescription ?? error);
    return NextResponse.redirect(redirectUrl);
  }

  if (!code) {
    const redirectUrl = new URL('/inbox', url.origin);
    redirectUrl.searchParams.set('auth_error', 'No authorization code received.');
    return NextResponse.redirect(redirectUrl);
  }

  const tenantId = process.env.AZURE_TENANT_ID!;
  const clientId = process.env.AZURE_CLIENT_ID!;
  const clientSecret = process.env.AZURE_CLIENT_SECRET!;

  if (!tenantId || !clientId || !clientSecret) {
    console.error('[auth/microsoft/callback] Missing Azure env vars:', {
      tenantId: !!tenantId,
      clientId: !!clientId,
      clientSecret: !!clientSecret,
    });
    const redirectUrl = new URL('/inbox', url.origin);
    redirectUrl.searchParams.set('auth_error', 'Server misconfiguration: missing Azure credentials.');
    return NextResponse.redirect(redirectUrl);
  }

  // Must match exactly what was sent in the login request — use the same env var.
  const appOrigin = process.env.NEXT_PUBLIC_APP_URL ?? url.origin;
  const redirectUri = `${appOrigin}/api/auth/microsoft/callback`;

  console.log('[auth/microsoft/callback] exchanging code, redirectUri:', redirectUri);

  // Exchange code for tokens
  const tokenParams = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });

  let tokensRes: Response;
  try {
    tokensRes = await fetch(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: tokenParams.toString(),
      },
    );
  } catch (err) {
    console.error('[auth/microsoft/callback] token fetch threw:', err);
    const redirectUrl = new URL('/inbox', url.origin);
    redirectUrl.searchParams.set('auth_error', 'Token request failed. Please try again.');
    return NextResponse.redirect(redirectUrl);
  }

  if (!tokensRes.ok) {
    const body = await tokensRes.text().catch(() => '');
    console.error('[auth/microsoft/callback] token exchange failed, status:', tokensRes.status, 'body:', body);
    const redirectUrl = new URL('/inbox', url.origin);
    redirectUrl.searchParams.set('auth_error', `Token exchange failed: ${body.substring(0, 200)}`);
    return NextResponse.redirect(redirectUrl);
  }

  const tokens = await tokensRes.json();
  console.log('[auth/microsoft/callback] token exchange OK, expires_in:', tokens.expires_in, 'has_refresh:', !!tokens.refresh_token);

  // Store in Supabase (single-user: userId = 'default')
  try {
    await storeTokens(
      'default',
      tokens.access_token,
      tokens.refresh_token ?? null,
      tokens.expires_in,
      tokens.scope ?? '',
    );
  } catch (err) {
    console.error('[auth/microsoft/callback] storeTokens failed:', err);
    const errUrl = new URL('/inbox', url.origin);
    errUrl.searchParams.set('auth_error', 'Failed to save token. Check server logs.');
    return NextResponse.redirect(errUrl);
  }

  console.log('[auth/microsoft/callback] token stored successfully, redirecting to inbox');

  // Redirect to inbox with success flag
  const redirectUrl = new URL('/inbox', url.origin);
  redirectUrl.searchParams.set('auth_success', '1');
  return NextResponse.redirect(redirectUrl);
}
