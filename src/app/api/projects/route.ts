import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { fetchChildFolders, createChildFolder } from '@/lib/microsoft-graph';
import { provisionProjectFolders } from '@/lib/google-drive';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { data: projects, error } = await supabase
    .from('projects')
    .select(`
      *,
      project_assignments(team_member_id),
      tasks(id, completed, due_date),
      vendors(id),
      call_notes(id)
    `)
    .order('event_date');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Compute task counts for each project
  const enriched = projects.map((p: any) => {
    const tasks = p.tasks || [];
    const today = new Date().toISOString().split('T')[0];
    return {
      ...p,
      assigned_to: (p.project_assignments || []).map((a: any) => a.team_member_id),
      tasks_total: tasks.length,
      tasks_completed: tasks.filter((t: any) => t.completed).length,
      overdue_count: tasks.filter((t: any) => !t.completed && t.due_date && t.due_date < today).length,
      vendors_count: (p.vendors || []).length,
      call_notes_count: (p.call_notes || []).length,
      // Remove nested arrays from response to keep it clean
      project_assignments: undefined,
      tasks: undefined,
      vendors: undefined,
      call_notes: undefined,
    };
  });

  return NextResponse.json(enriched);
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id, assigned_to, ...updates } = body;

  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  // The frontend uses slug as the project id — match by slug if not a UUID
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  const query = supabase.from('projects').update(updates);
  const { data, error } = await (isUUID ? query.eq('id', id) : query.eq('slug', id)).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Update assignments if provided
  if (assigned_to !== undefined) {
    await supabase.from('project_assignments').delete().eq('project_id', id);
    if (assigned_to.length) {
      await supabase.from('project_assignments').insert(
        assigned_to.map((teamMemberId: string) => ({ project_id: id, team_member_id: teamMemberId }))
      );
    }
  }

  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { assigned_to, ...projectData } = body;

  const { data: project, error } = await supabase
    .from('projects')
    .insert(projectData)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Create assignments
  if (assigned_to?.length) {
    await supabase.from('project_assignments').insert(
      assigned_to.map((teamMemberId: string) => ({
        project_id: project.id,
        team_member_id: teamMemberId,
      }))
    );
  }

  // ── Create matching Outlook folder (best-effort, non-blocking) ────────────
  let outlookFolderCreated = false;
  try {
    const inboxChildren = await fetchChildFolders('inbox', 'default');
    // Find the highest existing number prefix to determine next number
    const NUMBER_PREFIX = /^(\d+)\s*[-–]\s*/;
    const maxNum = inboxChildren.reduce((max, f) => {
      const m = f.displayName.match(NUMBER_PREFIX);
      return m ? Math.max(max, parseInt(m[1], 10)) : max;
    }, 0);
    const folderName = `${maxNum + 1} - ${project.name}`;
    const newFolder  = await createChildFolder('inbox', folderName, 'default');
    // Store the folder ID back on the project
    await supabase
      .from('projects')
      .update({ outlook_folder_id: newFolder.id })
      .eq('id', project.id);
    project.outlook_folder_id = newFolder.id;
    outlookFolderCreated = true;
  } catch {
    // Outlook not connected or Graph error — project still created successfully
  }

  // ── Create matching Google Drive folder structure (best-effort, non-blocking) ─
  let driveFolderCreated = false;
  try {
    const folders = await provisionProjectFolders(project.name);
    await supabase.from('drive_folders').insert({
      project_id: project.id,
      root_folder_id: folders.rootFolderId,
      root_folder_url: folders.rootFolderUrl,
      internal_folder_id: folders.internalFolderId,
      internal_folder_url: folders.internalFolderUrl,
      client_folder_id: folders.clientFolderId,
      client_folder_url: folders.clientFolderUrl,
      subfolder_ids: folders.subfolderIds,
    });
    driveFolderCreated = true;
  } catch {
    // Drive not connected or API error — project still created successfully
  }

  return NextResponse.json({ ...project, outlook_folder_created: outlookFolderCreated, drive_folder_created: driveFolderCreated }, { status: 201 });
}
