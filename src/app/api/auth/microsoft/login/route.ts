import { NextResponse } from 'next/server';
import { GRAPH_SCOPES } from '@/lib/microsoft-graph';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const tenantId = process.env.AZURE_TENANT_ID;
  const clientId = process.env.AZURE_CLIENT_ID;

  if (!tenantId || !clientId) {
    return NextResponse.json(
      { error: 'Microsoft OAuth is not configured. Set AZURE_TENANT_ID and AZURE_CLIENT_ID.' },
      { status: 500 },
    );
  }

  // Build redirect URI — prefer explicit env var so it stays stable across
  // Vercel preview deployments and internal/external origin mismatches.
  const url = new URL(request.url);
  const appOrigin = process.env.NEXT_PUBLIC_APP_URL ?? url.origin;
  const redirectUri = `${appOrigin}/api/auth/microsoft/callback`;

  // Random state to prevent CSRF
  const state = Math.random().toString(36).substring(2, 18);

  const authParams = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: GRAPH_SCOPES.join(' '),
    state,
    response_mode: 'query',
    prompt: 'select_account',
  });

  const authUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?${authParams}`;

  // Redirect browser to Microsoft login
  return NextResponse.redirect(authUrl);
}
