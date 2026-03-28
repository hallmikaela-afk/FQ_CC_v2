import { NextResponse } from 'next/server';
import { provisionProjectFolders, listSubfoldersInFolder } from '@/lib/google-drive';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// GET ?projectId=xxx — return stored folder links
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');

  if (!projectId) {
    return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
  }

  const supabase = getServiceSupabase();

  // Resolve slug → UUID (project page uses slug as id)
  const { data: projectRow } = await supabase
    .from('projects')
    .select('id')
    .or(`id.eq.${projectId},slug.eq.${projectId}`)
    .single();
  const pid = projectRow?.id ?? projectId;

  const { data, error } = await supabase
    .from('drive_folders')
    .select('*')
    .eq('project_id', pid)
    .single();

  if (error || !data) {
    return NextResponse.json({ provisioned: false });
  }

  return NextResponse.json({
    provisioned: true,
    rootFolderUrl: data.root_folder_url,
    internalFolderUrl: data.internal_folder_url,
    clientFolderUrl: data.client_folder_url,
    subfolderIds: data.subfolder_ids,
  });
}

// POST { projectId, linkFolderId? } — create folder tree OR link an existing Drive folder
// If linkFolderId is provided, the existing Drive folder is linked directly (no new folders created).
// The folder's immediate subfolders are scanned and stored as subfolder_ids.
export async function POST(request: Request) {
  let body: { projectId?: string; linkFolderId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { projectId, linkFolderId } = body;
  if (!projectId) {
    return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
  }

  const supabase = getServiceSupabase();

  // Resolve slug → UUID (project page uses slug as id)
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id, name')
    .or(`id.eq.${projectId},slug.eq.${projectId}`)
    .single();

  if (projectError || !project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  // Check if already provisioned (use resolved UUID)
  const { data: existing } = await supabase
    .from('drive_folders')
    .select('*')
    .eq('project_id', project.id)
    .single();

  if (existing) {
    return NextResponse.json({
      success: true,
      alreadyProvisioned: true,
      rootFolderUrl: existing.root_folder_url,
      internalFolderUrl: existing.internal_folder_url,
      clientFolderUrl: existing.client_folder_url,
      subfolderIds: existing.subfolder_ids,
    });
  }

  // ── Link existing folder mode ─────────────────────────────────────────────
  if (linkFolderId) {
    const folderUrl = `https://drive.google.com/drive/folders/${linkFolderId}`;

    // Scan subfolders inside the linked folder
    let subfolderIds: Record<string, string> = {};
    try {
      const subs = await listSubfoldersInFolder(linkFolderId);
      // Build a map of { subfolder_name: subfolder_id } for whatever subfolders exist
      subs.forEach(s => { subfolderIds[s.name] = s.id; });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message === 'NOT_CONNECTED') {
        return NextResponse.json({ error: 'Google Drive is not connected.' }, { status: 401 });
      }
      // Non-fatal — save with empty subfolder map
    }

    const { error: insertError } = await supabase.from('drive_folders').insert({
      project_id: project.id,
      root_folder_id: linkFolderId,
      root_folder_url: folderUrl,
      internal_folder_id: linkFolderId,
      internal_folder_url: folderUrl,
      client_folder_id: linkFolderId,
      client_folder_url: folderUrl,
      subfolder_ids: subfolderIds,
    });

    if (insertError) {
      console.error('[drive/provision] link insert failed:', insertError);
      return NextResponse.json({ error: 'Failed to save folder link to database.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      linked: true,
      rootFolderUrl: folderUrl,
      internalFolderUrl: folderUrl,
      clientFolderUrl: folderUrl,
      subfolderIds,
    });
  }

  // ── Create new folder structure ───────────────────────────────────────────
  let folders;
  try {
    folders = await provisionProjectFolders(project.name);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[drive/provision] provisionProjectFolders failed:', message);
    if (message === 'NOT_CONNECTED') {
      return NextResponse.json({ error: 'Google Drive is not connected.' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to create Drive folders.', detail: message }, { status: 500 });
  }

  const { error: insertError } = await supabase.from('drive_folders').insert({
    project_id: project.id,
    root_folder_id: folders.rootFolderId,
    root_folder_url: folders.rootFolderUrl,
    internal_folder_id: folders.internalFolderId,
    internal_folder_url: folders.internalFolderUrl,
    client_folder_id: folders.clientFolderId,
    client_folder_url: folders.clientFolderUrl,
    subfolder_ids: folders.subfolderIds,
  });

  if (insertError) {
    console.error('[drive/provision] insert failed:', insertError);
    return NextResponse.json({ error: 'Folders created in Drive but failed to save to database.' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    rootFolderUrl: folders.rootFolderUrl,
    internalFolderUrl: folders.internalFolderUrl,
    clientFolderUrl: folders.clientFolderUrl,
    subfolderIds: folders.subfolderIds,
  });
}
