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
        {...sharedCardProps}
      />
    );
  }

  return (
    <div>
      {/* Representative row with thread count + expand chevron */}
      <div className="relative flex items-start">
        {/* Left-side expand toggle */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggleExpand(); }}
          title={expanded ? 'Collapse thread' : 'Expand thread'}
          className="absolute left-1 top-3.5 z-10 flex flex-col items-center gap-0.5 text-fq-muted/40 hover:text-fq-accent transition-colors"
          style={{ transform: 'translateY(-50%)' }}
        >
          <svg
            width="10" height="10" viewBox="0 0 12 12" fill="none"
            stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
            style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 150ms' }}
          >
            <path d="M4 2l4 4-4 4" />
          </svg>
          <span className="font-body text-[9px] leading-none">{emails.length}</span>
        </button>

        {/* Representative email card — inset to leave room for chevron */}
        <div className="flex-1 pl-4">
          <EmailCard
            email={representative}
            isSelected={isSelected(representative.id)}
            showStatusPill={showStatusPill}
            showTriage={showTriage}
            onSelect={() => onSelect(representative)}
            onViewThread={(_e) => onSelect(representative)}
            {...sharedCardProps}
          />
        </div>
      </div>

      {/* Expandable sibling rows */}
      {expanded && (
        <div className="pl-4 border-l border-fq-border/40 ml-3 mb-1">
          {siblings.map((email) => (
            <EmailCard
              key={email.id}
              email={email}
              isSelected={isSelected(email.id)}
              showStatusPill={false}
              showTriage={false}
              onSelect={() => onSelect(email)}
              onViewThread={(_e) => onSelect(email)}
              {...sharedCardProps}
            />
          ))}
        </div>
      )}
    </div>
  );
}
