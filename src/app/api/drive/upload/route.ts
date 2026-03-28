import { NextResponse } from 'next/server';
import { uploadFileToDrive } from '@/lib/google-drive';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// POST multipart/form-data: file, projectId, subfolder
export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const file = formData.get('file') as File | null;
  const projectId = formData.get('projectId') as string | null;
  const subfolder = formData.get('subfolder') as string | null;

  if (!file || !projectId) {
    return NextResponse.json({ error: 'file and projectId are required' }, { status: 400 });
  }

  const supabase = getServiceSupabase();

  // Resolve slug → UUID
  const { data: projectRow } = await supabase
    .from('projects').select('id')
    .or(`id.eq.${projectId},slug.eq.${projectId}`).single();
  const pid = projectRow?.id ?? projectId;

  const { data, error } = await supabase
    .from('drive_folders')
    .select('*')
    .eq('project_id', pid)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Drive folders not provisioned for this project.' }, { status: 404 });
  }

  // Determine target folder
  let folderId: string;
  if (!subfolder || subfolder === 'internal') {
    folderId = data.internal_folder_id;
  } else if (subfolder === 'client') {
    folderId = data.client_folder_id;
  } else {
    const subfolderIds = data.subfolder_ids as Record<string, string>;
    folderId = subfolderIds[subfolder];
    if (!folderId) {
      return NextResponse.json({ error: `Unknown subfolder: ${subfolder}` }, { status: 400 });
    }
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const uploaded = await uploadFileToDrive(folderId, file.name, buffer, file.type || 'application/octet-stream');
    return NextResponse.json({ success: true, file: uploaded });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'NOT_CONNECTED') {
      return NextResponse.json({ error: 'Google Drive is not connected.' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Upload failed.', detail: message }, { status: 500 });
  }
}
