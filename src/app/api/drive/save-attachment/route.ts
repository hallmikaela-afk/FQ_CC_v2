/// <reference types="node" />
import { NextResponse } from 'next/server';
import { graphFetch } from '@/lib/microsoft-graph';
import { uploadFileToDrive } from '@/lib/google-drive';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * POST /api/drive/save-attachment
 * Fetches an email attachment from Microsoft Graph and uploads it to Google Drive.
 * Body: { messageId, attachmentId, projectId, subfolder }
 */
export async function POST(request: Request) {
  let body: { messageId?: string; attachmentId?: string; projectId?: string; subfolder?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { messageId, attachmentId, projectId, subfolder } = body;
  if (!messageId || !attachmentId || !projectId || !subfolder) {
    return NextResponse.json(
      { error: 'messageId, attachmentId, projectId, and subfolder are required' },
      { status: 400 },
    );
  }

  // Get Drive folder IDs for this project
  const supabase = getServiceSupabase();
  const { data: driveFolders, error: folderError } = await supabase
    .from('drive_folders')
    .select('*')
    .eq('project_id', projectId)
    .single();

  if (folderError || !driveFolders) {
    return NextResponse.json({ error: 'Drive folders not provisioned for this project.' }, { status: 404 });
  }

  const subfolderIds = driveFolders.subfolder_ids as Record<string, string>;
  const folderId = subfolderIds[subfolder];
  if (!folderId) {
    return NextResponse.json({ error: `Unknown subfolder: ${subfolder}` }, { status: 400 });
  }

  // Fetch attachment content from Microsoft Graph
  let attachmentData: { name?: string; contentBytes?: string; contentType?: string };
  try {
    const graphRes: Response = await graphFetch(`/me/messages/${messageId}/attachments/${attachmentId}`);
    if (!graphRes.ok) {
      console.error('[drive/save-attachment] Graph fetch failed:', graphRes.status);
      return NextResponse.json(
        { error: `Failed to fetch attachment from Outlook (${graphRes.status})` },
        { status: 502 },
      );
    }
    attachmentData = await graphRes.json();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === 'NOT_CONNECTED') {
      return NextResponse.json({ error: 'Outlook is not connected.' }, { status: 401 });
    }
    console.error('[drive/save-attachment] graphFetch threw:', msg);
    return NextResponse.json({ error: 'Failed to fetch attachment from Outlook.' }, { status: 500 });
  }

  if (!attachmentData.contentBytes || !attachmentData.name) {
    return NextResponse.json({ error: 'Attachment has no downloadable content.' }, { status: 400 });
  }

  // Upload to Google Drive
  const fileBuffer = Buffer.from(attachmentData.contentBytes, 'base64');
  const mimeType = attachmentData.contentType || 'application/octet-stream';

  try {
    const driveFile = await uploadFileToDrive(folderId, attachmentData.name, fileBuffer, mimeType);
    return NextResponse.json({
      success: true,
      fileUrl: driveFile.webViewLink,
      fileName: driveFile.name,
      subfolder,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === 'NOT_CONNECTED') {
      return NextResponse.json({ error: 'Google Drive is not connected.' }, { status: 401 });
    }
    console.error('[drive/save-attachment] upload failed:', msg);
    return NextResponse.json({ error: 'Failed to upload to Drive.', detail: msg }, { status: 500 });
  }
}
