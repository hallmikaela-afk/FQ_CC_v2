'use client';

import { useState, useCallback, useEffect } from 'react';
import * as XLSX from 'xlsx';
import UploadModal from '@/components/UploadModal';

type TableName = 'tasks' | 'vendors' | 'projects' | 'team_members' | 'call_notes' | 'template_tasks';

interface ColumnMapping {
  sourceCol: string;
  targetCol: string;
}

const TABLE_COLUMNS: Record<TableName, { required: string[]; optional: string[] }> = {
  tasks: {
    required: ['project_id', 'text'],
    optional: ['completed', 'status', 'due_date', 'category', 'assigned_to', 'priority', 'notes', 'sort_order'],
  },
  vendors: {
    required: ['project_id', 'category', 'vendor_name'],
    optional: ['contact_name', 'email', 'phone', 'website', 'instagram'],
  },
  projects: {
    required: ['type', 'name'],
    optional: ['slug', 'status', 'event_date', 'contract_signed_date', 'color', 'concept', 'service_tier', 'client1_name', 'client2_name', 'venue_name', 'venue_location', 'venue_street', 'venue_city_state_zip', 'guest_count', 'estimated_budget', 'photographer', 'florist', 'location', 'design_board_link', 'canva_link'],
  },
  team_members: {
    required: ['name', 'initials', 'role'],
    optional: [],
  },
  call_notes: {
    required: ['project_id', 'date', 'raw_text'],
    optional: ['title', 'summary'],
  },
  template_tasks: {
    required: ['text', 'category', 'weeks_before_event'],
    optional: ['sort_order', 'is_active'],
  },
};

export default function ImportPage() {
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [table, setTable] = useState<TableName>('tasks');
  const [rawData, setRawData] = useState<Record<string, string>[]>([]);
  const [sourceColumns, setSourceColumns] = useState<string[]>([]);
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ inserted?: number; errors?: string[] } | null>(null);
  const [fileName, setFileName] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [selectedDriveSubfolder, setSelectedDriveSubfolder] = useState('');
  const [driveConnected, setDriveConnected] = useState(false);
  // Fetch projects for the project_id selector (on mount)
  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/projects');
      if (res.ok) {
        const data = await res.json();
        setProjects(
          data
            .filter((p: any) => p.status === 'active')
            .map((p: any) => ({ id: p.id, name: p.name }))
        );
      }
    } catch { /* projects not loaded yet */ }
  }, []);

  useEffect(() => {
    fetchProjects();
    fetch('/api/auth/google/status')
      .then(r => r.json())
      .then(d => setDriveConnected(d.connected ?? false))
      .catch(() => {});
  }, [fetchProjects]);

  const processRows = useCallback((rows: Record<string, string>[]) => {
    setRawData(rows);
    const cols = rows.length > 0 ? Object.keys(rows[0]) : [];
    setSourceColumns(cols);

    // Auto-map columns by name similarity
    const targetCols = [...TABLE_COLUMNS[table].required, ...TABLE_COLUMNS[table].optional];
    const autoMappings: ColumnMapping[] = [];
    cols.forEach(src => {
      const normalized = src.toLowerCase().replace(/[^a-z0-9]/g, '_');
      const match = targetCols.find(t => t === normalized || t.includes(normalized) || normalized.includes(t));
      if (match) {
        autoMappings.push({ sourceCol: src, targetCol: match });
      }
    });
    setMappings(autoMappings);
  }, [table]);

  const handleFile = useCallback(async (file: File) => {
    setFileName(file.name);
    setResult(null);
    const name = file.name.toLowerCase();

    if (name.endsWith('.pdf') || name.endsWith('.docx') || name.endsWith('.doc')) {
      // Send to server-side parser
      const formData = new FormData();
      formData.append('file', file);
      try {
        const res = await fetch('/api/parse-file', { method: 'POST', body: formData });
        const json = await res.json();
        if (json.error) {
          setResult({ errors: [`Could not parse file: ${json.error}`] });
          return;
        }
        processRows(json.rows || []);
      } catch (err: any) {
        setResult({ errors: [`Failed to parse file: ${err.message}`] });
      }
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const data = e.target?.result;
      let rows: Record<string, string>[] = [];

      if (name.endsWith('.csv')) {
        const text = data as string;
        const lines = text.split('\n').filter(l => l.trim());
        if (lines.length < 2) return;
        const headers = parseCSVLine(lines[0]);
        rows = lines.slice(1).map(line => {
          const values = parseCSVLine(line);
          const obj: Record<string, string> = {};
          headers.forEach((h, i) => { obj[h.trim()] = values[i]?.trim() || ''; });
          return obj;
        });
      } else {
        // Excel
        const wb = XLSX.read(data, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json(sheet, { defval: '' }) as Record<string, string>[];
      }

      processRows(rows);
    };

    if (name.endsWith('.csv')) {
      reader.readAsText(file);
    } else {
      reader.readAsArrayBuffer(file);
    }
  }, [table, processRows]);

  function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const updateMapping = (sourceCol: string, targetCol: string) => {
    setMappings(prev => {
      const existing = prev.findIndex(m => m.sourceCol === sourceCol);
      if (targetCol === '') {
        return prev.filter(m => m.sourceCol !== sourceCol);
      }
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = { sourceCol, targetCol };
        return updated;
      }
      return [...prev, { sourceCol, targetCol }];
    });
  };

  const handleImport = async () => {
    setImporting(true);
    setResult(null);

    const mappedRows = rawData.map(row => {
      const mapped: Record<string, any> = {};
      mappings.forEach(m => {
        let val: any = row[m.sourceCol];
        // Type coercion
        if (m.targetCol === 'completed' || m.targetCol === 'is_active' || m.targetCol === 'accepted' || m.targetCol === 'dismissed') {
          val = val === 'true' || val === '1' || val === 'yes' || val === 'TRUE' || val === 'Yes';
        }
        // Normalize status values to database format
        if (m.targetCol === 'status' && typeof val === 'string') {
          const normalized = val.trim().toLowerCase().replace(/[\s-]+/g, '_');
          const statusMap: Record<string, string> = {
            'in_progress': 'in_progress',
            'inprogress': 'in_progress',
            'in progress': 'in_progress',
            'delayed': 'delayed',
            'completed': 'completed',
            'done': 'completed',
            'complete': 'completed',
          };
          val = statusMap[normalized] || statusMap[val.trim().toLowerCase()] || val;
        }
        if (m.targetCol === 'guest_count' || m.targetCol === 'weeks_before_event' || m.targetCol === 'sort_order') {
          val = parseInt(val) || 0;
        }
        if (val !== '' && val !== undefined) {
          mapped[m.targetCol] = val;
        }
      });

      // Auto-inject project_id if selected and table needs it
      if (selectedProjectId && ['tasks', 'vendors', 'call_notes'].includes(table) && !mapped.project_id) {
        mapped.project_id = selectedProjectId;
      }

      // Auto-sync status ↔ completed for tasks
      if (table === 'tasks') {
        if (mapped.status && !('completed' in mapped)) {
          mapped.completed = mapped.status === 'completed';
        }
        if (!mapped.status && 'completed' in mapped) {
          mapped.status = mapped.completed ? 'completed' : 'in_progress';
        }
        if (!mapped.status && !('completed' in mapped)) {
          mapped.status = 'in_progress';
          mapped.completed = false;
        }
      }

      return mapped;
    }).filter(row => Object.keys(row).length > 0);

    try {
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table, rows: mappedRows }),
      });
      const data = await res.json();
      setResult(data);

      // If a Drive subfolder is selected and we have a file, upload to Drive after import
      if (selectedDriveSubfolder && selectedProjectId && data.inserted && data.inserted > 0) {
        const fileInput = document.getElementById('file-input') as HTMLInputElement;
        const file = fileInput?.files?.[0];
        if (file) {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('projectId', selectedProjectId);
          formData.append('subfolder', selectedDriveSubfolder);
          await fetch('/api/drive/upload', { method: 'POST', body: formData });
        }
      }
    } catch (err: any) {
      setResult({ errors: [err.message] });
    }

    setImporting(false);
  };

  const allTargetCols = [...TABLE_COLUMNS[table].required, ...TABLE_COLUMNS[table].optional];
  const needsProject = ['tasks', 'vendors', 'call_notes'].includes(table);
  const mappedTargets = new Set(mappings.map(m => m.targetCol));
  const missingRequired = TABLE_COLUMNS[table].required.filter(
    r => !mappedTargets.has(r) && !(r === 'project_id' && selectedProjectId)
  );

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-start justify-between mb-2">
        <h1 className="font-heading text-3xl text-fq-dark">Import Data</h1>
        <button
          onClick={() => setShowUploadModal(true)}
          className="flex items-center gap-2 font-body text-[13px] font-medium bg-fq-dark text-white px-4 py-2 rounded-lg hover:bg-fq-accent transition-colors shrink-0"
        >
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 9.5V2M4.5 4.5L7 2l2.5 2.5" />
            <path d="M1.5 11.5h11" />
          </svg>
          Upload File
        </button>
      </div>
      <p className="text-fq-muted mb-6">Import structured data from CSV, Excel, Word, or PDF — or use <strong>Upload File</strong> to attach any file (photos, emails, screenshots, and more) to a project.</p>

      {showUploadModal && (
        <UploadModal onClose={() => setShowUploadModal(false)} />
      )}

      {/* Step 1: Select table */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-fq-dark mb-2">1. What are you importing?</label>
        <div className="flex gap-2 flex-wrap">
          {(Object.keys(TABLE_COLUMNS) as TableName[]).map(t => (
            <button
              key={t}
              onClick={() => { setTable(t); setRawData([]); setMappings([]); setResult(null); }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                table === t
                  ? 'bg-fq-accent text-white'
                  : 'bg-fq-light-accent text-fq-dark hover:bg-fq-border'
              }`}
            >
              {t.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Step 1b: Select project for tasks/vendors */}
      {needsProject && (
        <div className="mb-6">
          <label className="block text-sm font-medium text-fq-dark mb-2">
            1b. Which project? {!selectedProjectId && <span className="text-fq-alert">(required unless mapped in file)</span>}
          </label>
          <select
            value={selectedProjectId}
            onChange={e => setSelectedProjectId(e.target.value)}
            className="w-full max-w-md px-3 py-2 border border-fq-border rounded-lg bg-white text-fq-dark"
          >
            <option value="">Select project</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Description */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-fq-dark mb-2">1c. Describe what you&apos;re uploading <span className="text-fq-muted font-normal">(optional)</span></label>
        <input
          type="text"
          value={uploadDescription}
          onChange={e => setUploadDescription(e.target.value)}
          placeholder="e.g. Vendor contacts from the Smith wedding planning doc"
          className="w-full max-w-lg px-3 py-2 border border-fq-border rounded-lg bg-white text-fq-dark text-sm placeholder:text-fq-muted/50 focus:outline-none focus:border-fq-accent/40"
        />
      </div>

      {/* 1d. Save to Google Drive */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-fq-dark mb-2">1d. Save to Google Drive <span className="text-fq-muted font-normal">(optional)</span></label>
        {!driveConnected ? (
          <p className="font-body text-[12px] text-fq-muted">
            <a href="/api/auth/google/login" className="text-fq-accent hover:underline">Connect Google Drive</a> to save this file to a project folder.
          </p>
        ) : !selectedProjectId ? (
          <p className="font-body text-[12px] text-fq-muted">Select a project above to choose a Drive folder.</p>
        ) : (
          <div className="border border-fq-border rounded-lg overflow-hidden max-w-lg">
            <div className="flex items-center gap-1 px-3 py-2 bg-fq-light-accent border-b border-fq-border">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-fq-muted shrink-0">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
              <span className="font-body text-[11px] text-fq-muted">{projects.find(p => p.id === selectedProjectId)?.name || 'Project'}</span>
              <span className="font-body text-[11px] text-fq-muted/50">›</span>
              <span className="font-body text-[11px] text-fq-dark font-medium">
                {selectedDriveSubfolder || 'Choose folder…'}
              </span>
            </div>
            <div className="divide-y divide-fq-border">
              {[
                'Budgets', 'Client Questionnaires', 'Design Boards & Mockups',
                'Design Invoices & Contracts', 'Floorplans', 'Paper Goods', 'Photos',
                'Planning Checklists', 'Processional', 'RSVP Summaries', 'Timelines',
                'Vendor Contracts & Proposals', 'Venue Documents',
              ].map(folder => (
                <button
                  key={folder}
                  onClick={() => setSelectedDriveSubfolder(prev => prev === folder ? '' : folder)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                    selectedDriveSubfolder === folder
                      ? 'bg-fq-light-accent text-fq-dark'
                      : 'bg-fq-bg text-fq-muted hover:bg-fq-light-accent/40 hover:text-fq-dark'
                  }`}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  </svg>
                  <span className="font-body text-[12px]">{folder}</span>
                  {selectedDriveSubfolder === folder && (
                    <span className="ml-auto font-body text-[10px] text-fq-accent">Selected</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Step 2: Upload file */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-fq-dark mb-2">2. Upload your file</label>
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
            dragOver ? 'border-fq-accent bg-fq-light-accent' : 'border-fq-border hover:border-fq-muted'
          }`}
          onClick={() => document.getElementById('file-input')?.click()}
        >
          <input
            id="file-input"
            type="file"
            accept=".csv,.xlsx,.xls,.pdf,.docx,.doc,.eml,.jpg,.jpeg,.png,.gif,.webp,.heic,image/*"
            onChange={handleFileInput}
            className="hidden"
          />
          {fileName ? (
            <div>
              <p className="text-fq-dark font-medium">{fileName}</p>
              <p className="text-fq-muted text-sm mt-1">{rawData.length} rows found</p>
            </div>
          ) : (
            <div>
              <p className="text-fq-muted text-lg mb-1">Drop a file here</p>
              <p className="text-fq-muted text-sm">CSV · Excel · Word · PDF · Email (.eml) · Photos · Screenshots — or click to browse</p>
            </div>
          )}
        </div>
      </div>

      {/* Step 3: Column mapping */}
      {sourceColumns.length > 0 && (
        <div className="mb-6">
          <label className="block text-sm font-medium text-fq-dark mb-2">3. Map your columns</label>
          <div className="bg-white border border-fq-border rounded-xl overflow-hidden">
            <div className="grid grid-cols-2 gap-0 px-4 py-2 bg-fq-light-accent border-b border-fq-border">
              <span className="text-xs font-medium text-fq-muted uppercase">Your Column</span>
              <span className="text-xs font-medium text-fq-muted uppercase">Maps To</span>
            </div>
            {sourceColumns.map(col => {
              const currentMapping = mappings.find(m => m.sourceCol === col);
              return (
                <div key={col} className="grid grid-cols-2 gap-0 px-4 py-2 border-b border-fq-border last:border-b-0">
                  <span className="text-sm text-fq-dark font-mono">{col}</span>
                  <select
                    value={currentMapping?.targetCol || ''}
                    onChange={e => updateMapping(col, e.target.value)}
                    className="text-sm px-2 py-1 border border-fq-border rounded bg-white text-fq-dark"
                  >
                    <option value="">— skip —</option>
                    {allTargetCols.map(t => (
                      <option key={t} value={t} disabled={mappedTargets.has(t) && currentMapping?.targetCol !== t}>
                        {t} {TABLE_COLUMNS[table].required.includes(t) ? '*' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>

          {/* Preview */}
          <div className="mt-4">
            <p className="text-sm text-fq-muted mb-2">Preview (first 3 rows):</p>
            <div className="overflow-x-auto">
              <table className="text-xs border-collapse">
                <thead>
                  <tr>
                    {mappings.map(m => (
                      <th key={m.targetCol} className="px-3 py-1 bg-fq-light-accent border border-fq-border text-left font-medium text-fq-dark">
                        {m.targetCol}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rawData.slice(0, 3).map((row, i) => (
                    <tr key={i}>
                      {mappings.map(m => (
                        <td key={m.targetCol} className="px-3 py-1 border border-fq-border text-fq-dark font-mono">
                          {row[m.sourceCol] || '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Import */}
      {sourceColumns.length > 0 && (
        <div className="mb-8">
          {missingRequired.length > 0 && (
            <p className="text-fq-alert text-sm mb-3">
              Missing required columns: {missingRequired.join(', ')}
            </p>
          )}
          <button
            onClick={handleImport}
            disabled={importing || missingRequired.length > 0}
            className="px-6 py-3 bg-fq-accent text-white rounded-lg font-medium hover:bg-fq-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {importing ? 'Importing...' : `Import ${rawData.length} rows into ${table.replace(/_/g, ' ')}`}
          </button>

          {result && (
            <div className={`mt-4 p-4 rounded-lg ${result.errors?.length ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
              {result.inserted !== undefined && (
                <p className="text-green-800 font-medium">{result.inserted} rows imported successfully</p>
              )}
              {result.errors?.map((err, i) => (
                <p key={i} className="text-red-700 text-sm mt-1">{err}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Quick guide */}
      <div className="bg-fq-light-accent rounded-xl p-6 mt-4">
        <h3 className="font-heading text-lg text-fq-dark mb-3">Quick Guide</h3>
        <div className="text-sm text-fq-muted space-y-2">
          <p><strong>Tasks:</strong> Needs columns for task text and due_date at minimum. Select the project above or include a project_id column.</p>
          <p><strong>Vendors:</strong> Needs category, vendor_name. Include email, phone, website, instagram as available.</p>
          <p><strong>Template Tasks:</strong> For new client onboarding templates. Needs text, category, and weeks_before_event (number of weeks before the wedding).</p>
          <p><strong>Projects:</strong> Needs type (client/shoot/proposal) and name. Include event_date, venue, budget, etc.</p>
        </div>
      </div>
    </div>
  );
}
