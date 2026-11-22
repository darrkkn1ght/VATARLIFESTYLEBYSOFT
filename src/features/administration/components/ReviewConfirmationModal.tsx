import { useEffect, useState, type FormEvent } from 'react';
import { AlertCircle, Loader2, ShieldAlert, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type {
  AdminMemberRecord,
  ReviewActionStatus,
} from '@/features/administration/types/admin.types';

interface ReviewConfirmationModalProps {
  member: AdminMemberRecord | null;
  actionStatus: ReviewActionStatus | null;
  isSubmitting: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: (reviewNote: string) => Promise<void>;
}

const ACTION_COPY: Record<
  ReviewActionStatus,
  {
    eyebrow: string;
    title: string;
    consequence: string;
    confirmLabel: string;
    notePlaceholder: string;
  }
> = {
  approved: {
    eyebrow: 'Approve Membership',
    title: 'Confirm Member Approval',
    consequence:
      'This account will immediately gain access to approved member-only routes and dashboard areas.',
    confirmLabel: 'Confirm Approval',
    notePlaceholder: 'Optional note (e.g., Application verified and approved.)',
  },
  rejected: {
    eyebrow: 'Reject Application',
    title: 'Confirm Application Rejection',
    consequence:
      'This member will be blocked from member-only routes and shown a declined status notice.',
    confirmLabel: 'Confirm Rejection',
    notePlaceholder: 'Optional reason shown on the member status page...',
  },
  suspended: {
    eyebrow: 'Suspend Account',
    title: 'Confirm Account Suspension',
    consequence:
      'All member-only and administrative access for this account will be restricted immediately.',
    confirmLabel: 'Confirm Suspension',
    notePlaceholder: 'Optional moderation reason recorded in the audit log...',
  },
};

export function ReviewConfirmationModal({
  member,
  actionStatus,
  isSubmitting,
  error,
  onClose,
  onConfirm,
}: ReviewConfirmationModalProps) {
  const [reviewNote, setReviewNote] = useState('');

  useEffect(() => {
    setReviewNote('');
  }, [member?.userId, actionStatus]);

  useEffect(() => {
    if (!member || !actionStatus) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSubmitting) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [member, actionStatus, isSubmitting, onClose]);

  if (!member || !actionStatus) return null;

  const copy = ACTION_COPY[actionStatus];
  const displayName = member.profile?.full_name ?? 'Member';
  const username = member.profile?.username ? `@${member.profile.username}` : member.userId;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onConfirm(reviewNote);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="review-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-brand-black/85 p-4 backdrop-blur-sm"
    >
      <div className="relative w-full max-w-lg border border-brand-gold/40 bg-brand-charcoal p-6 shadow-2xl sm:p-8">
        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          aria-label="Close confirmation dialog"
          className="absolute top-5 right-5 cursor-pointer p-1 text-brand-muted transition-colors hover:text-brand-white disabled:pointer-events-none"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>

        <div className="flex items-center gap-2.5">
          <ShieldAlert className="h-4 w-4 text-brand-gold" aria-hidden="true" />
          <p className="heading-eyebrow">{copy.eyebrow}</p>
        </div>

        <h2
          id="review-modal-title"
          className="heading-section mt-3 text-2xl text-brand-white sm:text-3xl"
        >
          {copy.title}
        </h2>

        <div className="mt-5 border hairline-border bg-brand-black/70 p-4">
          <p className="font-heading text-base tracking-[0.06em] text-brand-cream uppercase">
            {displayName}
          </p>
          <p className="mt-0.5 font-body text-xs text-brand-muted">
            {username} &bull; Current status:{' '}
            <span className="text-brand-gold uppercase">{member.membership.status}</span>
            {' → '}
            <span className="text-brand-white uppercase">{actionStatus}</span>
          </p>
        </div>

        <p className="mt-4 font-body text-sm leading-relaxed text-brand-muted">
          {copy.consequence} This action is permanently recorded in the audit log.
        </p>

        {error && (
          <div
            role="alert"
            className="mt-4 flex items-start gap-2.5 border border-red-400/40 bg-red-950/30 p-3.5 text-xs text-red-200"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" aria-hidden="true" />
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-5">
          <div>
            <label
              htmlFor="review-note-input"
              className="block font-heading text-xs tracking-[0.18em] text-brand-cream uppercase"
            >
              Review Note (Optional)
            </label>
            <textarea
              id="review-note-input"
              rows={3}
              maxLength={400}
              disabled={isSubmitting}
              value={reviewNote}
              onChange={(event) => setReviewNote(event.target.value)}
              placeholder={copy.notePlaceholder}
              className="mt-2 w-full resize-y border hairline-border bg-brand-black px-3.5 py-2.5 font-body text-sm text-brand-white placeholder:text-brand-muted/60 focus:border-brand-gold focus:outline-none disabled:opacity-50"
            />
          </div>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Applying...
                </>
              ) : (
                copy.confirmLabel
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
