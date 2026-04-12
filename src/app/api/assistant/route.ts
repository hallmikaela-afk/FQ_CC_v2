import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { projects as seedProjects, team as seedTeam } from '@/data/seed';
import { getISOWeek } from '@/lib/week';
import { listFilesInFolder, getValidGoogleToken, downloadDriveFileAsBuffer } from '@/lib/google-drive';

export const dynamic = 'force-dynamic';

function getAnthropic() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

function tryGetSupabase() {
  try {
    const { getServiceSupabase } = require('@/lib/supabase');
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    return getServiceSupabase();
  } catch {
    return null;
  }
}


async function buildContext(): Promise<string> {
  const today = new Date().toISOString().split('T')[0];

  let context = `You are the AI assistant for Fox & Quinn, a luxury wedding and event planning company run by Mikaela Hall. You help manage projects, tasks, vendors, and client communications.\n\n`;
  context += `Today is ${today}.\n\n`;

  const supabase = tryGetSupabase();

  if (supabase) {
    const [projectsRes, tasksRes, teamRes, sprintRes] = await Promise.all([
      supabase.from('projects').select('id, name, type, status, event_date, venue_name, concept').order('event_date'),
      supabase.from('tasks').select('id, project_id, text, completed, due_date, category').eq('completed', false).order('due_date'),
      supabase.from('team_members').select('*'),
      supabase.from('sprint_tasks').select('id, title, bucket, tag, done').eq('done', false).order('sort_order'),
    ]);

    const projects: any[] = projectsRes.data || [];
    const tasks: any[] = tasksRes.data || [];
    const team: any[] = teamRes.data || [];
    const sprintTasks: any[] = sprintRes.data || [];

    const overdue = tasks.filter((t: any) => t.due_date && t.due_date < today);

    context += `TEAM:\n`;
    team.forEach((t: any) => { context += `- ${t.name} (${t.role}) [ID: ${t.id}]\n`; });

    context += `\nACTIVE PROJECTS & PLANNER TASKS:\n`;
    projects.forEach((p: any) => {
      const projectTasks = tasks.filter((t: any) => t.project_id === p.id);
      context += `\n## ${p.name} [PROJECT_ID: ${p.id}]\n`;
      context += `   ${p.type}, ${p.status}, ${p.event_date || 'no date'}, ${p.venue_name || p.concept || ''}\n`;
      if (projectTasks.length === 0) {
        context += `   No open tasks.\n`;
      } else {
        projectTasks.forEach((t: any) => {
          context += `   - [TASK_ID: ${t.id}] ${t.text}${t.due_date ? ` (due ${t.due_date})` : ''}${t.category ? ` [${t.category}]` : ''}\n`;
        });
      }
    });

    if (overdue.length > 0) {
      context += `\nOVERDUE:\n`;
      overdue.forEach((t: any) => {
        const proj = projects.find((p: any) => p.id === t.project_id);
        context += `- [TASK_ID: ${t.id}] "${t.text}" — due ${t.due_date} (${proj?.name || 'unknown'})\n`;
      });
    }

    if (sprintTasks.length > 0) {
      context += `\nCURRENT SPRINT (open tasks):\n`;
      sprintTasks.forEach((t: any) => {
        context += `- [SPRINT_ID: ${t.id}] ${t.title} — ${t.bucket} [${t.tag}]\n`;
      });
    }
  } else {
    // Seed data fallback
    context += `TEAM:\n`;
    seedTeam.forEach(t => { context += `- ${t.name} (${t.role})\n`; });

    context += `\nACTIVE PROJECTS & PLANNER TASKS:\n`;
    seedProjects.forEach(p => {
      const openTasks = (p.tasks || []).filter((t: any) => !t.completed);
      context += `\n## ${p.name} [PROJECT_ID: ${p.id}]\n`;
      context += `   ${p.type}, ${p.status}, ${p.event_date || 'no date'}, ${p.venue_name || p.concept || ''}\n`;
      if (openTasks.length === 0) {
        context += `   No open tasks.\n`;
      } else {
        openTasks.forEach((t: any) => {
          context += `   - [TASK_ID: ${t.id}] ${t.text}${t.due_date ? ` (due ${t.due_date})` : ''}\n`;
        });
      }
      if (p.vendors?.length) {
        context += `   Vendors: ${p.vendors.map((v: any) => `${v.vendor_name} (${v.category})`).join(', ')}\n`;
      }
    });

    const allOverdue: { text: string; due_date: string; project: string }[] = [];
    seedProjects.forEach(p => {
      (p.tasks || []).forEach((t: any) => {
        if (!t.completed && t.due_date && t.due_date < today) {
          allOverdue.push({ text: t.text, due_date: t.due_date, project: p.name });
        }
      });
    });
    if (allOverdue.length > 0) {
      context += `\nOVERDUE:\n`;
      allOverdue.forEach(t => { context += `- "${t.text}" — due ${t.due_date} (${t.project})\n`; });
    }

    seedProjects.forEach(p => {
      if (p.call_notes?.length) {
        context += `\nCALL NOTES — ${p.name}:\n`;
        p.call_notes.forEach(cn => {
          context += `- ${cn.date}${cn.title ? ` — ${cn.title}` : ''}: ${cn.summary || cn.raw_text.slice(0, 200)}\n`;
          const openActions = cn.extracted_actions.filter(a => a.accepted && !a.dismissed);
          if (openActions.length) {
            context += `  Actions: ${openActions.map(a => a.text).join('; ')}\n`;
          }
        });
      }
    });
  }

  const BUCKETS = [
    'Sun-Steeped Hamptons', 'Menorca Editorial', 'Elisabeth & JJ — LionRock Farm',
    'Julia & Frank — Wave Resort', 'Tippi & Justin — Vanderbilt Museum',
    'Fox & Quinn — Operations', 'Fox & Quinn — Marketing', 'FQ Command Center',
  ];

  context += `\n\nACTIONS — Always respond with valid JSON only. Use the "actions" array for any database writes. Multiple actions allowed.\n`;
  context += `Response format: {"response":"Your reply","actions":[...]} — or just {"response":"..."} when no DB action needed.\n\n`;
  context += `IMPORTANT: When a user asks to create a task or add something to their list but does NOT specify whether it should go in the project planner, the weekly sprint, or both — always ask first: "Should I add this to the project task list, this week's sprint, or both?" Do not create the task until the destination is confirmed.\n\n`;
  context += `PLANNER TASK ACTIONS (use PROJECT_ID / TASK_ID values listed above):\n`;
  context += `  Create:   {"type":"create_planner_task","project_id":"...","text":"...","subtasks":[{"text":"..."}]}\n`;
  context += `  Update:   {"type":"update_planner_task","task_id":"...","updates":{"text":"...","due_date":"YYYY-MM-DD","category":"..."}}\n`;
  context += `  Complete: {"type":"update_planner_task","task_id":"...","updates":{"completed":true}}\n`;
  context += `  Reopen:   {"type":"update_planner_task","task_id":"...","updates":{"completed":false}}\n\n`;
  context += `SPRINT TASK ACTIONS (use SPRINT_ID values listed above):\n`;
  context += `  Create:   {"type":"create_sprint_task","title":"...","bucket":"one of: ${BUCKETS.join(' | ')}","tag":"action|decision|creative|ops|marketing|build|client|check|research|book_vendor|other"}\n`;
  context += `  Note: Do NOT append the project name to sprint task titles — the bucket already identifies the project.\n`;
  context += `  Update:   {"type":"update_sprint_task","task_id":"...","updates":{"title":"...","bucket":"...","tag":"..."}}\n`;
  context += `  Complete: {"type":"update_sprint_task","task_id":"...","updates":{"done":true}}\n`;
  context += `  Reopen:   {"type":"update_sprint_task","task_id":"...","updates":{"done":false}}\n`;

  context += `\nRESEARCH LINKS: When listing vendors or companies, format as: - [Company Name](https://url) - Brief description. Only link to real, well-known sites. Always use markdown links [text](url).\n`;
  context += `\nEMAIL SEARCH: You have a search_emails tool that searches the real inbox. ALWAYS use search_emails (never web_search) when Mikaela asks about emails, messages, whether someone replied, or emails from a specific person or vendor. Do not say you can't check email — use the tool.`;
  context += `\nWEB SEARCH: Use web_search for venues, vendors, pricing, contact info, current events, or anything requiring live internet data. Do NOT use web_search for inbox questions — use search_emails instead.`;

  return context;
}

async function searchDriveFiles(projectName: string, subfolder?: string): Promise<string> {
  const supabase = tryGetSupabase();
  if (!supabase) return 'Database not available.';

  const connected = await getValidGoogleToken();
  if (!connected) return 'Google Drive is not connected.';

  // Find project by name (case-insensitive)
  const { data: projects } = await supabase
    .from('projects')
    .select('id, name')
    .ilike('name', `%${projectName}%`)
    .limit(3);

  if (!projects || projects.length === 0) {
    return `No project found matching "${projectName}".`;
  }

  const project = projects[0];

  // Look up Drive folder record
  const { data: driveRow } = await supabase
    .from('drive_folders')
    .select('subfolder_ids')
    .eq('project_id', project.id)
    .single();

  if (!driveRow) {
    return `No Google Drive folder is set up for ${project.name}.`;
  }

  const subfolderIds: Record<string, string> = driveRow.subfolder_ids || {};

  if (subfolder) {
    const folderId = subfolderIds[subfolder];
    if (!folderId) {
      return `No "${subfolder}" subfolder found for ${project.name}.`;
    }
    const files = await listFilesInFolder(folderId);
    if (files.length === 0) return `No files found in ${subfolder} for ${project.name}.`;
    const list = files.map(f => `• ${f.name} [id: ${f.id}, type: ${f.mimeType}] — [View](${f.webViewLink})`).join('\n');
    return `${subfolder} (${files.length} file${files.length > 1 ? 's' : ''}):\n${list}`;
  }

  // Search all subfolders
  const results: string[] = [];
  for (const [name, folderId] of Object.entries(subfolderIds)) {
    try {
      const files = await listFilesInFolder(folderId);
      if (files.length > 0) {
        const list = files.map(f => `  • ${f.name} [id: ${f.id}, type: ${f.mimeType}] — [View](${f.webViewLink})`).join('\n');
        results.push(`${name} (${files.length} file${files.length > 1 ? 's' : ''}):\n${list}`);
      }
    } catch {
      // Skip folders that fail to list
    }
  }

  if (results.length === 0) return `No files found in Drive for ${project.name} yet.`;
  return `Drive files for ${project.name}:\n\n${results.join('\n\n')}`;
}

async function searchEmails(opts: {
  query?: string;
  from?: string;
  project_name?: string;
  has_attachment?: boolean;
  needs_followup?: boolean;
  needs_response?: boolean;
}): Promise<string> {
  const supabase = tryGetSupabase();
  if (!supabase) return 'Database not available.';

  let q = supabase
    .from('emails')
    .select('subject, from_name, from_email, body_preview, received_at, needs_followup, needs_response, resolved, project_id, project:projects(name)')
    .eq('dismissed', false)
    .order('received_at', { ascending: false })
    .limit(20);

  if (opts.query?.trim()) {
    const term = `%${opts.query.trim()}%`;
    q = q.or(`subject.ilike.${term},from_name.ilike.${term},from_email.ilike.${term},body_preview.ilike.${term}`);
  }
  if (opts.from?.trim()) {
    const term = `%${opts.from.trim()}%`;
    q = q.or(`from_name.ilike.${term},from_email.ilike.${term}`);
  }
  if (opts.has_attachment) q = q.eq('has_attachments', true);
  if (opts.needs_followup) q = q.eq('needs_followup', true);
  if (opts.needs_response) q = q.eq('needs_response', true);

  // Filter by project name if provided
  if (opts.project_name?.trim()) {
    const { data: proj } = await supabase
      .from('projects')
      .select('id')
      .ilike('name', `%${opts.project_name.trim()}%`)
      .limit(1)
      .single();
    if (proj) q = q.eq('project_id', proj.id);
    else return `No project found matching "${opts.project_name}".`;
  }

  const { data: emails, error } = await q;
  if (error) return `Email search failed: ${error.message}`;
  if (!emails || emails.length === 0) return 'No emails found matching those criteria.';

  const lines = emails.map((e: any, i: number) => {
    const date = e.received_at ? new Date(e.received_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'unknown date';
    const from = [e.from_name, e.from_email].filter(Boolean).join(' <') + (e.from_email ? '>' : '');
    const flags = [
      e.needs_response ? 'Needs Response' : null,
      e.needs_followup ? 'Needs Follow-up' : null,
      e.resolved ? 'Resolved' : null,
      (e.project as any)?.name ? `Filed: ${(e.project as any).name}` : null,
    ].filter(Boolean).join(' · ');
    return `${i + 1}. **${e.subject || '(no subject)'}**\n   From: ${from} — ${date}${flags ? `\n   ${flags}` : ''}\n   ${e.body_preview || ''}`;
  });

  return `Found ${emails.length} email${emails.length > 1 ? 's' : ''}:\n\n${lines.join('\n\n')}`;
}

interface ReadFileResult {
  toolContent: string;
  documentBlock?: any;
}

async function readDriveFile(fileId: string, fileName: string, mimeType: string): Promise<ReadFileResult> {
  const nameLower = fileName.toLowerCase();

  // PDFs: encoding as base64 exceeds token limits for proactive tool use.
  // Return the Drive view link so the user can attach it directly for reading.
  if (mimeType === 'application/pdf' || nameLower.endsWith('.pdf')) {
    return {
      toolContent: `PDF files are too large to read via proactive search. The file "${fileName}" is available here: https://drive.google.com/file/d/${fileId}/view\n\nTo read its contents, attach it using the "From Drive" button in the chat and ask your question — I'll be able to read it directly.`,
    };
  }

  let buffer: Buffer;
  let effectiveMimeType: string;

  try {
    const result = await downloadDriveFileAsBuffer(fileId, mimeType);
    buffer = result.buffer;
    effectiveMimeType = result.effectiveMimeType;
  } catch (err: any) {
    return { toolContent: `Failed to download file: ${err.message}` };
  }

  // Plain text / CSV (Google Docs & Sheets exports)
  if (effectiveMimeType === 'text/plain' || effectiveMimeType === 'text/csv' || nameLower.endsWith('.csv') || nameLower.endsWith('.txt')) {
    return { toolContent: buffer.toString('utf-8').slice(0, 60000) };
  }

  // DOCX
  if (
    effectiveMimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    effectiveMimeType === 'application/msword' ||
    nameLower.endsWith('.docx') || nameLower.endsWith('.doc')
  ) {
    const mammoth = await import('mammoth');
    const result = await mammoth.default.extractRawText({ buffer });
    return { toolContent: result.value.slice(0, 60000) };
  }

  // XLSX
  if (
    effectiveMimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    effectiveMimeType === 'application/vnd.ms-excel' ||
    nameLower.endsWith('.xlsx') || nameLower.endsWith('.xls')
  ) {
    const XLSX = await import('xlsx');
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const parts: string[] = [];
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      parts.push(`[Sheet: ${sheetName}]\n${XLSX.utils.sheet_to_csv(sheet)}`);
    }
    return { toolContent: parts.join('\n\n').slice(0, 60000) };
  }

  return { toolContent: `Cannot extract text from file type: ${effectiveMimeType}` };
}

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY not configured. Add it to your .env.local file.' },
      { status: 500 }
    );
  }

  try {
    const { messages, imageAttachments } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'messages array required' }, { status: 400 });
    }

    const context = await buildContext();

    // For the last user message, attach any images as vision content blocks
    const apiMessages = messages.map((m: any, idx: number) => {
      if (
        m.role === 'user' &&
        idx === messages.length - 1 &&
        Array.isArray(imageAttachments) &&
        imageAttachments.length > 0
      ) {
        const parts: any[] = imageAttachments.map((img: any) => {
          if (img.mediaType === 'application/pdf') {
            return {
              type: 'document',
              source: { type: 'base64', media_type: 'application/pdf', data: img.base64 },
            };
          }
          return {
            type: 'image',
            source: { type: 'base64', media_type: img.mediaType, data: img.base64 },
          };
        });
        parts.push({ type: 'text', text: m.content });
        return { role: m.role, content: parts };
      }
      return { role: m.role, content: m.content };
    });

    const tools: any[] = [
      { type: 'web_search_20250305', name: 'web_search' },
      {
        name: 'search_emails',
        description: 'Search emails in the inbox. Use when Mikaela asks to find emails — by subject keyword, sender, project, or status (needs response, needs follow-up). Returns matching emails with subject, sender, date, and preview.',
        input_schema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Text to search in subject, sender name, or body preview.',
            },
            from: {
              type: 'string',
              description: 'Filter by sender name or email address.',
            },
            project_name: {
              type: 'string',
              description: 'Filter emails filed to a specific project (e.g. "Julia & Frank").',
            },
            has_attachment: {
              type: 'boolean',
              description: 'If true, only return emails with attachments.',
            },
            needs_followup: {
              type: 'boolean',
              description: 'If true, only return emails marked Needs Follow-up.',
            },
            needs_response: {
              type: 'boolean',
              description: 'If true, only return emails marked Needs Response.',
            },
          },
          required: [],
        },
      },
      {
        name: 'search_drive_files',
        description: 'Search Google Drive folders for a project to find files. Use this when Mikaela asks about documents, floor plans, contracts, timelines, budgets, photos, questionnaires, or any project files. Returns file names, IDs, and direct links. Use read_drive_file to read the actual content of a specific file.',
        input_schema: {
          type: 'object',
          properties: {
            project_name: {
              type: 'string',
              description: 'The project name as it appears in context (e.g. "Julia & Frank", "Tippi & Justin").',
            },
            subfolder: {
              type: 'string',
              description: 'Optional. One of: Budgets, Client Questionnaires, Design Boards & Mockups, Design Invoices & Contracts, Floorplans, Paper Goods, Photos, Planning Checklists, Processional, RSVP Summaries, Timelines, Vendor Contracts & Proposals, Venue Documents. Omit to search all subfolders.',
            },
          },
          required: ['project_name'],
        },
      },
      {
        name: 'read_drive_file',
        description: 'Read the full content of a specific Google Drive file. Use this after search_drive_files when you need to read what is inside a document (e.g. to answer questions about a contract, proposal, or timeline). Pass the file_id, file_name, and mime_type from search_drive_files results.',
        input_schema: {
          type: 'object',
          properties: {
            file_id: {
              type: 'string',
              description: 'The Google Drive file ID from search_drive_files results.',
            },
            file_name: {
              type: 'string',
              description: 'The file name including extension (e.g. "Vendor Contract.pdf").',
            },
            mime_type: {
              type: 'string',
              description: 'The MIME type from search_drive_files results (e.g. "application/pdf").',
            },
          },
          required: ['file_id', 'file_name', 'mime_type'],
        },
      },
    ];

    // Agentic loop — handles custom tool calls (search_drive_files).
    // web_search is a server-side built-in and never triggers stop_reason: tool_use here.
    let currentMessages = [...apiMessages];
    let response = await getAnthropic().messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: context,
      messages: currentMessages,
      tools,
    });

    for (let iteration = 0; iteration < 5 && response.stop_reason === 'tool_use'; iteration++) {
      const toolUseBlocks = (response.content as any[]).filter((c) => c.type === 'tool_use');
      const toolResults: any[] = [];
      const extraDocumentBlocks: any[] = [];

      for (const block of toolUseBlocks) {
        if (block.name === 'search_emails') {
          const result = await searchEmails(block.input as any);
          toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result });
        } else if (block.name === 'search_drive_files') {
          const input = block.input as { project_name: string; subfolder?: string };
          const result = await searchDriveFiles(input.project_name, input.subfolder);
          toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result });
        } else if (block.name === 'read_drive_file') {
          const input = block.input as { file_id: string; file_name: string; mime_type: string };
          const { toolContent, documentBlock } = await readDriveFile(input.file_id, input.file_name, input.mime_type);
          toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: toolContent });
          if (documentBlock) extraDocumentBlocks.push(documentBlock);
        }
      }

      if (toolResults.length === 0) break;

      // Anthropic allows document blocks to be mixed with tool_result blocks in the same user turn
      const userTurnContent = [...toolResults, ...extraDocumentBlocks];

      currentMessages = [
        ...currentMessages,
        { role: 'assistant' as const, content: response.content },
        { role: 'user' as const, content: userTurnContent },
      ];

      response = await getAnthropic().messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: context,
        messages: currentMessages,
        tools,
      });
    }

    // Collect all text blocks — web search responses interleave tool_use/tool_result with text
    const rawText = response.content
      .filter((c: any) => c.type === 'text')
      .map((c: any) => c.text)
      .join('\n\n');

    // Extract all top-level JSON objects from the response (handles text around JSON gracefully)
    function extractAllJSON(text: string): any[] {
      const results: any[] = [];
      const stripped = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
      let depth = 0, start = -1;
      for (let i = 0; i < stripped.length; i++) {
        if (stripped[i] === '{') { if (depth === 0) start = i; depth++; }
        else if (stripped[i] === '}') {
          depth--;
          if (depth === 0 && start >= 0) {
            try { results.push(JSON.parse(stripped.slice(start, i + 1))); } catch { /* skip malformed */ }
            start = -1;
          }
        }
      }
      return results;
    }

    let content = '';
    let tasks_changed = false;
    let tasks_count = 0;
    let change_type: 'created' | 'updated' | 'completed' | 'mixed' | null = null;
    const changeTypes = new Set<string>();

    const objects = extractAllJSON(rawText);

    if (objects.length > 0) {
      const supabase = tryGetSupabase();

      for (const parsed of objects) {
        if (parsed.response != null) content = parsed.response;

        const actions = parsed.actions && Array.isArray(parsed.actions) ? parsed.actions : [];

        for (const action of actions) {
          // --- Planner: create ---
          if (action.type === 'create_planner_task' && action.project_id && action.text) {
            if (supabase) {
              const { data: task, error } = await supabase
                .from('tasks')
                .insert({ project_id: action.project_id, text: action.text, completed: false, sort_order: 99 })
                .select().single();
              if (!error && task) {
                tasks_changed = true; tasks_count++; changeTypes.add('created');
                if (action.subtasks?.length) {
                  await supabase.from('subtasks').insert(
                    action.subtasks.map((st: any, i: number) => ({ task_id: task.id, text: st.text, completed: false, sort_order: i }))
                  );
                }
              }
            } else {
              tasks_changed = true; tasks_count++; changeTypes.add('created');
            }
          }

          // --- Planner: update / complete ---
          if (action.type === 'update_planner_task' && action.task_id && action.updates) {
            if (supabase) {
              const { error } = await supabase.from('tasks').update(action.updates).eq('id', action.task_id);
              if (!error) { tasks_changed = true; tasks_count++; changeTypes.add(action.updates.completed === true ? 'completed' : 'updated'); }
            } else {
              tasks_changed = true; tasks_count++; changeTypes.add(action.updates.completed === true ? 'completed' : 'updated');
            }
          }

          // --- Sprint: create ---
          if (action.type === 'create_sprint_task' && action.title && action.bucket) {
            if (supabase) {
              await supabase.from('sprint_tasks').insert({
                title: action.title, bucket: action.bucket, tag: action.tag || 'action',
                done: false, sprint_week: getISOWeek(), sort_order: 99,
              });
              tasks_changed = true; tasks_count++; changeTypes.add('created');
            }
          }

          // --- Sprint: update / complete ---
          if (action.type === 'update_sprint_task' && action.task_id && action.updates) {
            if (supabase) {
              const { error } = await supabase.from('sprint_tasks').update(action.updates).eq('id', action.task_id);
              if (!error) { tasks_changed = true; tasks_count++; changeTypes.add(action.updates.done === true ? 'completed' : 'updated'); }
            } else {
              tasks_changed = true; tasks_count++; changeTypes.add(action.updates.done === true ? 'completed' : 'updated');
            }
          }
        }
      }
    } else {
      // No JSON found — return raw text as-is (e.g. markdown response)
      content = rawText;
    }

    // If AI returned empty response but actions ran, generate a brief confirmation
    if (!content && tasks_changed) {
      const verb = changeTypes.has('created') ? `Added ${tasks_count} task${tasks_count > 1 ? 's' : ''}` :
                   changeTypes.has('completed') ? `Completed ${tasks_count} task${tasks_count > 1 ? 's' : ''}` :
                   `Updated ${tasks_count} task${tasks_count > 1 ? 's' : ''}`;
      content = verb + '.';
    }

    if (changeTypes.size > 1) change_type = 'mixed';
    else if (changeTypes.size === 1) change_type = [...changeTypes][0] as 'created' | 'updated' | 'completed' | 'mixed';

    return NextResponse.json({ role: 'assistant', content, tasks_changed, tasks_count, change_type });
  } catch (err: any) {
    console.error('Assistant API error:', err);
    return NextResponse.json({ error: err.message || 'Failed to get response from Claude' }, { status: 500 });
  }
}
