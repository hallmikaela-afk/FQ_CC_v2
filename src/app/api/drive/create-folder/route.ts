import { NextResponse } from 'next/server';
import { createFolder } from '@/lib/google-drive';
import { getServiceSupabase } from '@/lib/supabase';
import { resolveProjectId } from '@/lib/resolve-project';

export const dynamic = 'force-dynamic';

// POST { projectId, folderName } — creates a subfolder inside the project's internal folder
// and saves it to drive_folders.subfolder_ids
export async function POST(request: Request) {
  let body: { projectId?: string; folderName?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { projectId, folderName } = body;
  if (!projectId || !folderName?.trim()) {
    return NextResponse.json({ error: 'projectId and folderName are required' }, { status: 400 });
  }

  const pid = (await resolveProjectId(projectId)) ?? projectId;
  const supabase = getServiceSupabase();

  const { data: driveRow, error: fetchError } = await supabase
    .from('drive_folders')
    .select('*')
    .eq('project_id', pid)
    .single();

  if (fetchError || !driveRow) {
    return NextResponse.json({ error: 'Drive folders not provisioned for this project.' }, { status: 404 });
  }

  // Create the subfolder in Drive inside the internal folder
  let newFolder: { id: string; name: string; webViewLink: string };
  try {
    newFolder = await createFolder(folderName.trim(), driveRow.internal_folder_id);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'NOT_CONNECTED') {
      return NextResponse.json({ error: 'Google Drive is not connected.' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to create folder.', detail: message }, { status: 500 });
  }

  // Update subfolder_ids in the DB
  const currentSubfolderIds = (driveRow.subfolder_ids as Record<string, string>) ?? {};
  const updatedSubfolderIds = { ...currentSubfolderIds, [folderName.trim()]: newFolder.id };

  const { error: updateError } = await supabase
    .from('drive_folders')
    .update({ subfolder_ids: updatedSubfolderIds })
    .eq('project_id', pid);

  if (updateError) {
    return NextResponse.json({ error: 'Folder created in Drive but failed to save to database.' }, { status: 500 });
  }

  return NextResponse.json({ success: true, folder: newFolder, subfolderIds: updatedSubfolderIds });
}
