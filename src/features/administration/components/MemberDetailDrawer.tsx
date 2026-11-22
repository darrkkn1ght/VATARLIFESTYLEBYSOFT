import { useEffect } from 'react';
import { Ban, CheckCircle2, Shield, X, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
  MembershipStatusBadge,
  RoleBadge,
} from '@/features/administration/components/MembershipStatusBadge';
import type {
  AdminMemberRecord,
  ReviewActionStatus,
} from '@/features/administration/types/admin.types';

interface MemberDetailDrawerProps {
  member: AdminMemberRecord | null;
  currentUserId: string | null;
  currentUserEmail: string | null;
  onClose: () => void;
  onSelectAction: (member: AdminMemberRecord, status: ReviewActionStatus) => void;
}

function formatDateTime(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function MemberDetailDrawer({
  member,
  currentUserId,
  currentUserEmail,
  onClose,
  onSelectAction,
}: MemberDetailDrawerProps) {
  useEffect(() => {
    if (!member) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [member, onClose]);

  if (!member) return null;

  const isSelf = currentUserId === member.userId;
  const emailDisplay =
    isSelf && currentUserEmail
      ? currentUserEmail
      : 'Stored in Supabase Auth (not exposed via profiles table)';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="member-drawer-title"
      className="fixed inset-0 z-40 flex justify-end bg-brand-black/75 backdrop-blur-xs"
    >
      <div
        aria-hidden="true"
        onClick={onClose}
        className="flex-1"
      />
      <aside className="flex h-full w-full max-w-xl flex-col overflow-y-auto border-l border-brand-gold/30 bg-brand-obsidian p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4 border-b hairline-border pb-6">
          <div>
            <p className="heading-eyebrow">Member Dossier</p>
            <h2
              id="member-drawer-title"
              className="heading-section mt-2 text-2xl text-brand-white sm:text-3xl"
            >
              {member.profile?.full_name ?? 'Profile Pending'}
            </h2>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <MembershipStatusBadge status={member.membership.status} />
              {member.roles.map((role) => (
                <RoleBadge key={role} role={role} />
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close member details"
            className="cursor-pointer border hairline-border p-2 text-brand-muted transition-colors hover:border-brand-gold hover:text-brand-white"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <dl className="mt-6 grid gap-5 sm:grid-cols-2">
          <div className="border hairline-border bg-brand-charcoal/55 p-4">
            <dt className="font-body text-[0.65rem] tracking-[0.2em] text-brand-muted uppercase">
              VATAR Username
            </dt>
            <dd className="mt-1 font-heading text-base tracking-[0.06em] text-brand-cream">
              {member.profile?.username ? `@${member.profile.username}` : '—'}
            </dd>
          </div>

          <div className="border hairline-border bg-brand-charcoal/55 p-4">
            <dt className="font-body text-[0.65rem] tracking-[0.2em] text-brand-muted uppercase">
              Lagos Life Username
            </dt>
            <dd className="mt-1 font-heading text-base tracking-[0.06em] text-brand-cream">
              {member.profile?.lagos_life_username ?? '—'}
            </dd>
          </div>

          <div className="border hairline-border bg-brand-charcoal/55 p-4 sm:col-span-2">
            <dt className="font-body text-[0.65rem] tracking-[0.2em] text-brand-muted uppercase">
              Email Address
            </dt>
            <dd className="mt-1 font-body text-sm text-brand-cream/90">
              {emailDisplay}
            </dd>
          </div>

          <div className="border hairline-border bg-brand-charcoal/55 p-4">
            <dt className="font-body text-[0.65rem] tracking-[0.2em] text-brand-muted uppercase">
              Registered
            </dt>
            <dd className="mt-1 font-body text-sm text-brand-cream">
              {formatDateTime(member.membership.created_at)}
            </dd>
          </div>

          <div className="border hairline-border bg-brand-charcoal/55 p-4">
            <dt className="font-body text-[0.65rem] tracking-[0.2em] text-brand-muted uppercase">
              Last Reviewed
            </dt>
            <dd className="mt-1 font-body text-sm text-brand-cream">
              {formatDateTime(member.membership.reviewed_at)}
            </dd>
          </div>

          <div className="border hairline-border bg-brand-charcoal/55 p-4 sm:col-span-2">
            <dt className="font-body text-[0.65rem] tracking-[0.2em] text-brand-muted uppercase">
              Reviewed By
            </dt>
            <dd className="mt-1 font-body text-sm text-brand-cream">
              {member.reviewerUsername ??
                (member.membership.reviewed_by
                  ? `${member.membership.reviewed_by.slice(0, 8)}…`
                  : 'Not yet reviewed')}
            </dd>
          </div>

          <div className="border hairline-border bg-brand-charcoal/55 p-4 sm:col-span-2">
            <dt className="font-body text-[0.65rem] tracking-[0.2em] text-brand-muted uppercase">
              Review Note
            </dt>
            <dd className="mt-1 font-body text-sm leading-relaxed text-brand-muted">
              {member.membership.review_note ?? 'No review note recorded.'}
            </dd>
          </div>

          <div className="border hairline-border bg-brand-charcoal/55 p-4 sm:col-span-2">
            <dt className="font-body text-[0.65rem] tracking-[0.2em] text-brand-muted uppercase">
              Account UUID
            </dt>
            <dd className="mt-1 font-mono text-xs break-all text-brand-muted">
              {member.userId}
            </dd>
          </div>
        </dl>

        {/* Review Actions */}
        <div className="mt-8 border-t hairline-border pt-6">
          <p className="heading-eyebrow">Membership Decision</p>

          {isSelf ? (
            <div className="mt-4 flex items-start gap-3 border border-brand-gold/30 bg-brand-charcoal/60 p-4">
              <Shield className="mt-0.5 h-4 w-4 shrink-0 text-brand-gold" aria-hidden="true" />
              <p className="font-body text-xs leading-relaxed text-brand-muted">
                Database security policy prevents administrators from reviewing or
                modifying their own membership status.
              </p>
            </div>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Button
                variant="primary"
                size="sm"
                disabled={member.membership.status === 'approved'}
                onClick={() => onSelectAction(member, 'approved')}
              >
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                Approve
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={member.membership.status === 'rejected'}
                onClick={() => onSelectAction(member, 'rejected')}
              >
                <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                Reject
              </Button>
              <Button
                variant="subtle"
                size="sm"
                disabled={member.membership.status === 'suspended'}
                onClick={() => onSelectAction(member, 'suspended')}
              >
                <Ban className="h-3.5 w-3.5" aria-hidden="true" />
                Suspend
              </Button>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
