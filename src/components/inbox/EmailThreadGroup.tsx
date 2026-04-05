'use client';

import EmailCard, { type Email, type Project } from '@/components/inbox/EmailCard';

interface Props {
  emails: Email[];            // sorted newest-first
  expanded: boolean;
  onToggleExpand: () => void;
  isSelected: (id: string) => boolean;
  showStatusPill?: boolean;
  showTriage?: boolean;
  projects: Project[];
  onSelect: (email: Email) => void;
  onReply: (email: Email) => void;
  onConfirmSuggested: (email: Email) => void;
  onDismissSuggested: (email: Email) => void;
  onToggleFollowup: (email: Email) => void;
  onResolve: (email: Email) => void;
  onNeedsResponse: (email: Email) => void;
  onDraftResponse: (email: Email) => Promise<void>;
  onDismiss: (email: Email) => void;
  onDelete?: (email: Email) => void;
  onReassign: (email: Email, projectId: string | null) => void;
  onRightClick?: (email: Email, x: number, y: number) => void;
  /* Bulk select */
  isSelectMode?: boolean;
  selectedEmailIds?: Set<string>;
  onBulkToggle?: (email: Email, shiftKey: boolean) => void;
}

export default function EmailThreadGroup({
  emails,
  expanded,
  onToggleExpand,
  isSelected,
  showStatusPill,
  showTriage,
  projects,
  onSelect,
  onReply,
  onConfirmSuggested,
  onDismissSuggested,
  onToggleFollowup,
  onResolve,
  onNeedsResponse,
  onDraftResponse,
  onDismiss,
  onDelete,
  onReassign,
  onRightClick,
  isSelectMode,
  selectedEmailIds,
  onBulkToggle,
}: Props) {
  const [representative, ...siblings] = emails;
  const hasThread = siblings.length > 0;

  const sharedCardProps = {
    projects,
    onReply,
    onConfirmSuggested,
    onDismissSuggested,
    onToggleFollowup,
    onResolve,
    onNeedsResponse,
    onDraftResponse,
    onDismiss,
    onDelete,
    onReassign,
    onRightClick,
  };

  if (!hasThread) {
    return (
      <EmailCard
        email={representative}
        isSelected={isSelected(representative.id)}
        showStatusPill={showStatusPill}
        showTriage={showTriage}
        onSelect={() => onSelect(representative)}
        onViewThread={(_e) => onSelect(representative)}
        isSelectMode={isSelectMode}
        isBulkSelected={selectedEmailIds?.has(representative.id) ?? false}
        onBulkToggle={(shiftKey) => onBulkToggle?.(representative, shiftKey)}
        {...sharedCardProps}
      />
    );
  }

  return (
    <div>
      {/* Representative card — chevron + count rendered inside the card via threadCount prop */}
      <EmailCard
        email={representative}
        isSelected={isSelected(representative.id)}
        showStatusPill={showStatusPill}
        showTriage={showTriage}
        onSelect={() => onSelect(representative)}
        onViewThread={(_e) => onSelect(representative)}
        threadCount={emails.length}
        threadExpanded={expanded}
        onThreadToggle={onToggleExpand}
        isSelectMode={isSelectMode}
        isBulkSelected={selectedEmailIds?.has(representative.id) ?? false}
        onBulkToggle={(shiftKey) => onBulkToggle?.(representative, shiftKey)}
        {...sharedCardProps}
      />

      {/* Expandable sibling rows */}
      {expanded && (
        <div className="ml-3 pl-3 border-l border-fq-border/50 mb-1">
          {siblings.map((email) => (
            <EmailCard
              key={email.id}
              email={email}
              isSelected={isSelected(email.id)}
              showStatusPill={false}
              showTriage={false}
              onSelect={() => onSelect(email)}
              onViewThread={(_e) => onSelect(email)}
              isSelectMode={isSelectMode}
              isBulkSelected={selectedEmailIds?.has(email.id) ?? false}
              onBulkToggle={(shiftKey) => onBulkToggle?.(email, shiftKey)}
              {...sharedCardProps}
            />
          ))}
        </div>
      )}
    </div>
  );
}
