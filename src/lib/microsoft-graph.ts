/**
 * microsoft-graph.ts
 * Token management and Microsoft Graph API helpers for FQ Command Center.
 */

import { getServiceSupabase } from './supabase';

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
const TENANT_ID = process.env.AZURE_TENANT_ID!;
const CLIENT_ID = process.env.AZURE_CLIENT_ID!;
const CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET!;

const TOKEN_URL = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`;

export const GRAPH_SCOPES = [
  'Mail.Read',
  'Mail.ReadWrite',
  'Mail.Send',
  'User.Read',
  'offline_access',
];

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MicrosoftToken {
  id: string;
  user_id: string;
  access_token: string;
  refresh_token: string | null;
  expires_at: string;
  scope: string | null;
  created_at: string;
}

export interface GraphMessage {
  id: string;
  subject: string | null;
  bodyPreview: string | null;
  body: { contentType: string; content: string } | null;
  receivedDateTime: string;
  isRead: boolean;
  conversationId: string;
  parentFolderId: string;
  from: {
    emailAddress: {
      name: string;
      address: string;
    };
  } | null;
}

export interface GraphFolder {
  id: string;
  displayName: string;
  totalItemCount: number;
  unreadItemCount: number;
  parentFolderId: string | null;
}

// ─── Token helpers ────────────────────────────────────────────────────────────

/**
 * Returns a valid access token for the given userId, refreshing if needed.
 * Returns null if no token exists or refresh fails.
 */
export async function getValidToken(userId = 'default'): Promise<string | null> {
  const supabase = getServiceSupabase();

  const { data, error } = await supabase
    .from('microsoft_tokens')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error || !data) return null;

  const token = data as MicrosoftToken;
  const expiresAt = new Date(token.expires_at).getTime();
  const now = Date.now();
  const fiveMinutes = 5 * 60 * 1000;

  // Still valid (with 5-min buffer)
  if (expiresAt - now > fiveMinutes) {
    return token.access_token;
  }

  // Need to refresh
  if (!token.refresh_token) return null;

  return doTokenRefresh(userId, token.refresh_token);
}

async function doTokenRefresh(userId: string, refreshToken: string): Promise<string | null> {
  const supabase = getServiceSupabase();

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
    scope: GRAPH_SCOPES.join(' '),
  });

  let res: Response;
  try {
    res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
  } catch {
    return null;
  }

  if (!res.ok) return null;

  const tokens = await res.json();
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  await supabase
    .from('microsoft_tokens')
    .update({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || refreshToken,
      expires_at: expiresAt,
    })
    .eq('user_id', userId);

  return tokens.access_token;
}

/**
 * Store tokens after OAuth callback.
 */
export async function storeTokens(
  userId: string,
  accessToken: string,
  refreshToken: string | null,
  expiresIn: number,
  scope: string,
): Promise<void> {
  console.log('[storeTokens] starting for userId:', userId);

  const supabase = getServiceSupabase();
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  console.log('[storeTokens] upserting to microsoft_tokens, expires_at:', expiresAt);

  const { data, error } = await supabase
    .from('microsoft_tokens')
    .upsert(
      {
        user_id: userId,
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: expiresAt,
        scope,
      },
      { onConflict: 'user_id' },
    )
    .select('id, user_id, expires_at');

  if (error) {
    console.error('[storeTokens] upsert error:', error);
    throw new Error(`Failed to store Microsoft tokens: ${error.message}`);
  }

  if (!data || data.length === 0) {
    console.error(
      '[storeTokens] upsert returned no rows — likely blocked by RLS. ' +
      'Ensure SUPABASE_SERVICE_ROLE_KEY is set correctly.',
    );
    throw new Error(
      'Token upsert affected 0 rows. Check that SUPABASE_SERVICE_ROLE_KEY is correct and that RLS allows service-role writes.',
    );
  }

  console.log('[storeTokens] success, saved row:', data[0]);
}

/**
 * Check if a user has valid (connected) tokens.
 */
export async function isConnected(userId = 'default'): Promise<boolean> {
  const token = await getValidToken(userId);
  return token !== null;
}

// ─── Graph API fetch wrapper ──────────────────────────────────────────────────

/**
 * Makes an authenticated request to Microsoft Graph API.
 * Throws on error.
 */
export async function graphFetch(
  path: string,
  options: RequestInit = {},
  userId = 'default',
): Promise<unknown> {
  const token = await getValidToken(userId);
  if (!token) throw new Error('NOT_CONNECTED');

  const res = await fetch(`${GRAPH_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`GRAPH_ERROR_${res.status}: ${body}`);
  }

  // 204 No Content
  if (res.status === 204) return null;
  return res.json();
}

// ─── Email helpers ────────────────────────────────────────────────────────────

export interface FetchMessagesOptions {
  folderId?: string;
  top?: number;
  skip?: number;
  dateFrom?: string;
  dateTo?: string;
}

/**
 * Fetch messages from Graph API.
 * Returns messages array and nextLink for pagination.
 */
export async function fetchMessages(
  opts: FetchMessagesOptions = {},
  userId = 'default',
): Promise<{ messages: GraphMessage[]; nextLink: string | null }> {
  const { folderId, top = 50, skip = 0, dateFrom, dateTo } = opts;

  const filters: string[] = [];
  if (dateFrom) filters.push(`receivedDateTime ge ${dateFrom}`);
  if (dateTo) filters.push(`receivedDateTime le ${dateTo}`);

  const params = new URLSearchParams({
    $top: String(top),
    $skip: String(skip),
    $orderby: 'receivedDateTime desc',
    $select:
      'id,subject,bodyPreview,body,receivedDateTime,isRead,conversationId,parentFolderId,from',
  });
  if (filters.length) params.set('$filter', filters.join(' and '));

  const basePath = folderId
    ? `/me/mailFolders/${folderId}/messages`
    : '/me/messages';

  const data = (await graphFetch(`${basePath}?${params}`, {}, userId)) as {
    value: GraphMessage[];
    '@odata.nextLink'?: string;
  };

  return {
    messages: data.value ?? [],
    nextLink: data['@odata.nextLink'] ?? null,
  };
}

/**
 * Fetch all mail folders.
 */
export async function fetchFolders(userId = 'default'): Promise<GraphFolder[]> {
  const data = (await graphFetch(
    '/me/mailFolders?$top=50&$select=id,displayName,totalItemCount,unreadItemCount,parentFolderId',
    {},
    userId,
  )) as { value: GraphFolder[] };
  return data.value ?? [];
}

/**
 * Send a reply to an email.
 */
export async function sendReply(
  messageId: string,
  replyBody: string,
  userId = 'default',
): Promise<void> {
  await graphFetch(
    `/me/messages/${messageId}/reply`,
    {
      method: 'POST',
      body: JSON.stringify({
        message: {},
        comment: replyBody,
      }),
    },
    userId,
  );
}

/**
 * Mark a message as read.
 */
export async function markAsRead(messageId: string, userId = 'default'): Promise<void> {
  await graphFetch(
    `/me/messages/${messageId}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ isRead: true }),
    },
    userId,
  );
}
