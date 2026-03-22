'use client';

export interface Folder {
  folder_id: string;
  display_name: string;
  total_count: number;
  unread_count: number;
  parent_folder_id: string | null;
}

interface Props {
  folders: Folder[];
  selectedFolder: string | null; // null = All Mail
  onSelectFolder: (folderId: string | null) => void;
  totalUnread: number;
}

/* ── Folder icons keyed by Outlook display name ── */
function FolderIcon({ name }: { name: string }) {
  const n = name.toLowerCase();
  if (n === 'inbox')
    return (
      <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="4" width="16" height="12" rx="2" />
        <path d="M2 12h4l2 3h4l2-3h4" />
      </svg>
    );
  if (n === 'sent items' || n === 'sent')
    return (
      <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 10l14-7-7 14V10H3z" />
      </svg>
    );
  if (n === 'drafts')
    return (
      <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 3H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7l-4-4z" />
        <path d="M13 3v4h4" />
      </svg>
    );
  if (n === 'deleted items' || n === 'trash')
    return (
      <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 6h14M8 6V4h4v2M16 6l-1 11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6" />
      </svg>
    );
  if (n === 'junk email' || n === 'spam')
    return (
      <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2H8L2 8v4l6 6h4l6-6V8l-6-6z" />
        <path d="M10 7v4M10 13h.01" />
      </svg>
    );
  if (n === 'archive')
    return (
      <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 4h14v4H3z" />
        <path d="M5 8v9h10V8" />
        <path d="M8 12h4" />
      </svg>
    );
  // Generic folder
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 6a2 2 0 0 1 2-2h3.5l2 2H16a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6z" />
    </svg>
  );
}

/* ── Priority sort: surface common folders first ── */
const FOLDER_ORDER: Record<string, number> = {
  inbox: 0,
  'sent items': 1,
  sent: 1,
  drafts: 2,
  archive: 3,
  'deleted items': 4,
  trash: 4,
  'junk email': 5,
  spam: 5,
};

function sortFolders(folders: Folder[]): Folder[] {
  return [...folders].sort((a, b) => {
    const ai = FOLDER_ORDER[a.display_name.toLowerCase()] ?? 99;
    const bi = FOLDER_ORDER[b.display_name.toLowerCase()] ?? 99;
    if (ai !== bi) return ai - bi;
    return a.display_name.localeCompare(b.display_name);
  });
}

export default function FolderSidebar({ folders, selectedFolder, onSelectFolder, totalUnread }: Props) {
  const sorted = sortFolders(folders);

  const rowClass = (active: boolean) =>
    `w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors font-body text-[13px] ${
      active
        ? 'bg-fq-light-accent text-fq-dark/90 font-medium'
        : 'text-fq-muted/80 hover:bg-fq-light-accent/60 hover:text-fq-dark/80'
    }`;

  return (
    <aside className="w-[210px] min-w-[210px] flex flex-col border-r border-fq-border bg-fq-card overflow-y-auto">
      {/* Section label */}
      <div className="px-4 pt-8 pb-2">
        <p className="font-heading text-[10px] uppercase tracking-[0.14em] text-fq-muted/50">
          Mailboxes
        </p>
      </div>

      {/* All Mail row */}
      <div className="px-3 pb-1">
        <button
          onClick={() => onSelectFolder(null)}
          className={rowClass(selectedFolder === null)}
        >
          {/* All-mail icon */}
          <span className="text-fq-muted/60 shrink-0">
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="16" height="12" rx="2" />
              <path d="M2 8l8 5 8-5" />
            </svg>
          </span>
          <span className="flex-1 truncate">All Mail</span>
          {totalUnread > 0 && (
            <span className="text-[10px] font-semibold bg-fq-sage text-white rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
              {totalUnread > 99 ? '99+' : totalUnread}
            </span>
          )}
        </button>
      </div>

      {/* Divider */}
      {sorted.length > 0 && <div className="mx-4 my-1 border-t border-fq-border/60" />}

      {/* Folder list */}
      <div className="px-3 pb-4 space-y-0.5">
        {sorted.map((folder) => (
          <button
            key={folder.folder_id}
            onClick={() => onSelectFolder(folder.folder_id)}
            className={rowClass(selectedFolder === folder.folder_id)}
          >
            <span className="text-fq-muted/55 shrink-0">
              <FolderIcon name={folder.display_name} />
            </span>
            <span className="flex-1 truncate">{folder.display_name}</span>
            {folder.unread_count > 0 && (
              <span className="text-[10px] font-semibold bg-fq-sage text-white rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                {folder.unread_count > 99 ? '99+' : folder.unread_count}
              </span>
            )}
          </button>
        ))}

        {folders.length === 0 && (
          <p className="font-body text-[12px] text-fq-muted/50 px-2 py-3">
            No folders synced yet
          </p>
        )}
      </div>
    </aside>
  );
}
