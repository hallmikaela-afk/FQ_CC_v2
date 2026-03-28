import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const BUCKET = 'project-files';

// GET /api/project-files?projectId=xxx
export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get('projectId');
  if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 });

  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from('project_files')
    .select('*')
    .eq('project_id', projectId)
    .order('uploaded_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/project-files
// Accepts either:
//   multipart/form-data  — file + projectId + notes? + googleDrivePath?  (Supabase Storage upload)
//   application/json     — Drive file link: { driveFileId, driveFileName, driveFileMimeType, driveFileUrl, driveFileSize?, projectId, notes? }
export async function POST(req: NextRequest) {
  // Drive file linking (JSON body)
  const ct = req.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) {
    try {
      const body = await req.json();
      const { driveFileId, driveFileName, driveFileMimeType, driveFileUrl, driveFileSize, projectId: pid, notes } = body;
      if (!driveFileId || !driveFileName || !driveFileUrl || !pid) {
        return NextResponse.json({ error: 'driveFileId, driveFileName, driveFileUrl, and projectId are required' }, { status: 400 });
      }
      const ext = driveFileName.includes('.') ? '.' + driveFileName.split('.').pop()!.toLowerCase() : '';
      const supabase = getServiceSupabase();
      const { data: inserted, error: dbError } = await supabase
        .from('project_files')
        .insert({
          project_id: pid,
          file_name: driveFileName,
          file_type: ext || driveFileMimeType || 'unknown',
          file_size: driveFileSize ?? 0,
          storage_path: `drive:${driveFileId}`,
          public_url: driveFileUrl,
          notes: notes ?? null,
          google_drive_path: driveFileUrl,
        })
        .select()
        .single();
      if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
      return NextResponse.json(inserted);
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const projectId = formData.get('projectId') as string | null;
    const notes = (formData.get('notes') as string | null) || null;
    const googleDrivePath = (formData.get('googleDrivePath') as string | null) || null;

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 });

    const supabase = getServiceSupabase();

    // Ensure bucket exists
    const { data: buckets } = await supabase.storage.listBuckets();
    if (!buckets?.find(b => b.name === BUCKET)) {
      await supabase.storage.createBucket(BUCKET, { public: true });
    }

    const ext = file.name.includes('.') ? '.' + file.name.split('.').pop()!.toLowerCase() : '';
    const storagePath = `${projectId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    const contentType = file.type || 'application/octet-stream';
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buffer, { contentType, upsert: false });

    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);

    const { data: inserted, error: dbError } = await supabase
      .from('project_files')
      .insert({
        project_id: projectId,
        file_name: file.name,
        file_type: ext || file.type,
        file_size: file.size,
        storage_path: storagePath,
        public_url: urlData.publicUrl,
        notes,
        google_drive_path: googleDrivePath,
      })
      .select()
      .single();

    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
    return NextResponse.json(inserted);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE /api/project-files?id=xxx&storagePath=xxx
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  const storagePath = req.nextUrl.searchParams.get('storagePath');
  if (!id || !storagePath) return NextResponse.json({ error: 'id and storagePath required' }, { status: 400 });

  const supabase = getServiceSupabase();

  const { error: storageError } = await supabase.storage.from(BUCKET).remove([storagePath]);
  if (storageError) return NextResponse.json({ error: storageError.message }, { status: 500 });

  const { error: dbError } = await supabase.from('project_files').delete().eq('id', id);
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
