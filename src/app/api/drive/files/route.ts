import { NextResponse } from 'next/server';
import { listFilesInFolder } from '@/lib/google-drive';
import { getServiceSupabase } from '@/lib/supabase';
import { resolveProjectId } from '@/lib/resolve-project';

export const dynamic = 'force-dynamic';

// GET ?projectId=xxx&folder=internal|client|Budgets|...
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');
  const folder = searchParams.get('folder') ?? 'internal';

  if (!projectId) {
    return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
  }

  const pid = (await resolveProjectId(projectId)) ?? projectId;
  const supabase = getServiceSupabase();

  const { data, error } = await supabase
    .from('drive_folders')
    .select('*')
    .eq('project_id', pid)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Drive folders not provisioned for this project.' }, { status: 404 });
  }

  let folderId: string;
  if (folder === 'internal') {
    folderId = data.internal_folder_id;
  } else if (folder === 'client') {
    folderId = data.client_folder_id;
  } else {
    // Subfolder name
    const subfolderIds = data.subfolder_ids as Record<string, string>;
    folderId = subfolderIds[folder];
    if (!folderId) {
      return NextResponse.json({ error: `Unknown folder: ${folder}` }, { status: 400 });
    }
  }

  try {
    const files = await listFilesInFolder(folderId);
    return NextResponse.json({ files });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'NOT_CONNECTED') {
      return NextResponse.json({ error: 'Google Drive is not connected.' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to list files.', detail: message }, { status: 500 });
  }
}
