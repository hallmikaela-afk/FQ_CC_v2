/**
 * google-drive.ts
 * Token management and Google Drive API helpers for FQ Command Center.
 */

import { getServiceSupabase } from './supabase';

const DRIVE_BASE = 'https://www.googleapis.com/drive/v3';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;

export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/drive.file',
];

// Exact subfolder names matching the Fox & Quinn Drive structure
export const FQ_INTERNAL_SUBFOLDERS = [
  'Budgets',
  'Client Questionnaires',
  'Design Boards & Mockups',
  'Design Invoices & Contracts',
  'Floorplans',
  'Paper Goods',
  'Photos',
  'Planning Checklists',
  'Processional',
  'RSVP Summaries',
  'Timelines',
  'Vendor Contracts & Proposals',
  'Venue Documents',
] as const;

export type FQSubfolder = typeof FQ_INTERNAL_SUBFOLDERS[number];

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GoogleToken {
  id: string;
  user_id: string;
  access_token: string;
  refresh_token: string | null;
  expires_at: string;
  scope: string | null;
  created_at: string;
  updated_at: string;
}

export interface DriveFolderRow {
  id: string;
  project_id: string;
  root_folder_id: string;
  root_folder_url: string;
  internal_folder_id: string;
  internal_folder_url: string;
  client_folder_id: string;
  client_folder_url: string;
  subfolder_ids: Record<string, string>;
  created_at: string;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
  iconLink: string;
  size: string | null;
  modifiedTime: string;
  createdTime: string;
}

// ─── Token helpers ─────────────────────────────────────────────────────────────

export async function getValidGoogleToken(userId = 'default'): Promise<string | null> {
  const supabase = getServiceSupabase();

  const { data, error } = await supabase
    .from('google_tokens')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error || !data) return null;

  const token = data as GoogleToken;
  const expiresAt = new Date(token.expires_at).getTime();
  const now = Date.now();
  const fiveMinutes = 5 * 60 * 1000;

  // Token is still valid
  if (expiresAt - now > fiveMinutes) {
    return token.access_token;
  }

  // Needs refresh
  if (!token.refresh_token) return null;

  return doTokenRefresh(token.refresh_token, userId);
}

async function doTokenRefresh(refreshToken: string, userId: string): Promise<string | null> {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  let res: Response;
  try {
    res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
  } catch (err) {
    console.error('[google-drive] token refresh fetch threw:', err);
    return null;
  }

  if (!res.ok) {
    console.error('[google-drive] token refresh failed:', res.status, await res.text().catch(() => ''));
    return null;
  }

  const tokens = await res.json();
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  const supabase = getServiceSupabase();
  await supabase
    .from('google_tokens')
    .update({
      access_token: tokens.access_token,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  return tokens.access_token;
}

export async function storeGoogleTokens(
  userId: string,
  accessToken: string,
  refreshToken: string | null,
  expiresIn: number,
  scope: string,
): Promise<void> {
  const supabase = getServiceSupabase();
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  const { error } = await supabase
    .from('google_tokens')
    .upsert(
      {
        user_id: userId,
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: expiresAt,
        scope,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );

  if (error) {
    console.error('[google-drive] storeGoogleTokens error:', error);
    throw new Error('Failed to store Google tokens: ' + error.message);
  }
}

export async function isGoogleConnected(userId = 'default'): Promise<boolean> {
  const token = await getValidGoogleToken(userId);
  return token !== null;
}

// ─── Drive API wrapper ────────────────────────────────────────────────────────

async function driveFetch(
  path: string,
  options: RequestInit = {},
  userId = 'default',
): Promise<Response> {
  const token = await getValidGoogleToken(userId);
  if (!token) throw new Error('NOT_CONNECTED');

  const url = path.startsWith('http') ? path : `${DRIVE_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers ?? {}),
    },
  });

  if (res.status === 401) {
    // Force refresh and retry once
    const supabase = getServiceSupabase();
    const { data } = await supabase
      .from('google_tokens')
      .select('refresh_token')
      .eq('user_id', userId)
      .single();

    if (data?.refresh_token) {
      const newToken = await doTokenRefresh(data.refresh_token, userId);
      if (newToken) {
        return fetch(url, {
          ...options,
          headers: {
            Authorization: `Bearer ${newToken}`,
            ...(options.headers ?? {}),
          },
        });
      }
    }
    throw new Error('NOT_CONNECTED');
  }

  return res;
}

// ─── Folder helpers ───────────────────────────────────────────────────────────

export async function createFolder(name: string, parentId?: string): Promise<string> {
  const metadata: Record<string, unknown> = {
    name,
    mimeType: 'application/vnd.google-apps.folder',
  };
  if (parentId) {
    metadata.parents = [parentId];
  }

  const res = await driveFetch('/files?fields=id', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(metadata),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Failed to create folder "${name}": ${res.status} ${body}`);
  }

  const data = await res.json();
  return data.id as string;
}

function folderUrl(folderId: string): string {
  return `https://drive.google.com/drive/folders/${folderId}`;
}

// ─── Folder provisioning ──────────────────────────────────────────────────────

export interface ProvisionedFolders {
  rootFolderId: string;
  rootFolderUrl: string;
  internalFolderId: string;
  internalFolderUrl: string;
  clientFolderId: string;
  clientFolderUrl: string;
  subfolderIds: Record<string, string>;
}

/**
 * Creates the full folder tree for a project in Google Drive.
 * Structure:
 *   📁 {projectName} — Fox & Quinn
 *     📁 Internal — {projectName}
 *       📁 Budgets
 *       📁 Client Questionnaires
 *       ... (all FQ_INTERNAL_SUBFOLDERS)
 *     📁 Client Shared — {projectName}
 */
export async function provisionProjectFolders(projectName: string): Promise<ProvisionedFolders> {
  const rootName = `${projectName} — Fox & Quinn`;
  const internalName = `Internal — ${projectName}`;
  const clientName = `Client Shared — ${projectName}`;

  // Create root
  const rootFolderId = await createFolder(rootName);

  // Create Internal and Client Shared in parallel
  const [internalFolderId, clientFolderId] = await Promise.all([
    createFolder(internalName, rootFolderId),
    createFolder(clientName, rootFolderId),
  ]);

  // Create all 13 subfolders inside Internal
  const subfolderEntries = await Promise.all(
    FQ_INTERNAL_SUBFOLDERS.map(async (name) => {
      const id = await createFolder(name, internalFolderId);
      return [name, id] as [string, string];
    }),
  );

  const subfolderIds = Object.fromEntries(subfolderEntries);

  return {
    rootFolderId,
    rootFolderUrl: folderUrl(rootFolderId),
    internalFolderId,
    internalFolderUrl: folderUrl(internalFolderId),
    clientFolderId,
    clientFolderUrl: folderUrl(clientFolderId),
    subfolderIds,
  };
}

// ─── File listing ──────────────────────────────────────────────────────────────

/**
 * Lists files in a Drive folder (non-recursive, files only).
 */
export async function listFilesInFolder(folderId: string): Promise<DriveFile[]> {
  const params = new URLSearchParams({
    q: `'${folderId}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id,name,mimeType,webViewLink,iconLink,size,modifiedTime,createdTime)',
    orderBy: 'modifiedTime desc',
    pageSize: '100',
  });

  const res = await driveFetch(`/files?${params}`);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Failed to list files: ${res.status} ${body}`);
  }

  const data = await res.json();
  return (data.files ?? []) as DriveFile[];
}

/**
 * Lists immediate subfolders inside a Drive folder.
 */
export async function listSubfoldersInFolder(folderId: string): Promise<{ id: string; name: string }[]> {
  const params = new URLSearchParams({
    q: `'${folderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id,name)',
    orderBy: 'name',
    pageSize: '100',
  });

  const res = await driveFetch(`/files?${params}`);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Failed to list subfolders: ${res.status} ${body}`);
  }

  const data = await res.json();
  return (data.files ?? []) as { id: string; name: string }[];
}

// ─── File download ────────────────────────────────────────────────────────────

const GOOGLE_WORKSPACE_EXPORTS: Record<string, string> = {
  'application/vnd.google-apps.document': 'text/plain',
  'application/vnd.google-apps.spreadsheet': 'text/csv',
  'application/vnd.google-apps.presentation': 'text/plain',
};

/**
 * Downloads a Drive file as a Buffer.
 * Google Workspace files (Docs, Sheets, Slides) are exported to plain text / CSV.
 * All other files are downloaded as-is via alt=media.
 */
export async function downloadDriveFileAsBuffer(
  fileId: string,
  mimeType: string,
): Promise<{ buffer: Buffer; effectiveMimeType: string }> {
  const exportMimeType = GOOGLE_WORKSPACE_EXPORTS[mimeType];

  let res: Response;
  let effectiveMimeType: string;

  if (exportMimeType) {
    res = await driveFetch(`/files/${fileId}/export?mimeType=${encodeURIComponent(exportMimeType)}`);
    effectiveMimeType = exportMimeType;
  } else {
    res = await driveFetch(`/files/${fileId}?alt=media`);
    effectiveMimeType = mimeType;
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Failed to download Drive file: ${res.status} ${body}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return { buffer: Buffer.from(arrayBuffer), effectiveMimeType };
}

// ─── File upload ───────────────────────────────────────────────────────────────

/**
 * Uploads a file to a Drive folder using multipart upload.
 */
export async function uploadFileToDrive(
  folderId: string,
  fileName: string,
  fileBuffer: Buffer,
  mimeType: string,
): Promise<DriveFile> {
  const token = await getValidGoogleToken();
  if (!token) throw new Error('NOT_CONNECTED');

  const metadata = JSON.stringify({ name: fileName, parents: [folderId] });
  const boundary = '-------314159265358979323846';

  const body = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    metadata,
    `--${boundary}`,
    `Content-Type: ${mimeType}`,
    '',
    '',
  ].join('\r\n');

  // Build multipart body
  const bodyStart = Buffer.from(body, 'utf-8');
  const bodyEnd = Buffer.from(`\r\n--${boundary}--`, 'utf-8');
  const fullBody = Buffer.concat([bodyStart, fileBuffer, bodyEnd]);

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink,iconLink,size,modifiedTime,createdTime',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary="${boundary}"`,
        'Content-Length': String(fullBody.length),
      },
      body: fullBody,
    },
  );

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`Upload failed: ${res.status} ${errBody}`);
  }

  return res.json() as Promise<DriveFile>;
}
