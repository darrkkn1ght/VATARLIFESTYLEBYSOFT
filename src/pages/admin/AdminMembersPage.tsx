import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Ban,
  CheckCircle2,
  Eye,
  RefreshCw,
  Users,
  XCircle,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { PageContainer } from '@/components/layout/PageContainer';
import { CategoryFilter } from '@/components/shared/CategoryFilter';
import { EmptyState } from '@/components/shared/EmptyState';
import { SearchInput } from '@/components/shared/SearchInput';
import { Button } from '@/components/ui/Button';
import { MemberDetailDrawer } from '@/features/administration/components/MemberDetailDrawer';
import {
  MembershipStatusBadge,
  RoleBadge,
} from '@/features/administration/components/MembershipStatusBadge';
import { ReviewConfirmationModal } from '@/features/administration/components/ReviewConfirmationModal';
import {
  fetchAdminMembers,
  reviewMemberApplication,
} from '@/features/administration/services/adminService';
import type {
  AdminMemberRecord,
  MembershipSummaryCounts,
  ReviewActionStatus,
} from '@/features/administration/types/admin.types';
import { useAuth } from '@/features/auth/hooks/useAuth';
import type { MembershipStatus } from '@/lib/supabase/database.types';

const STATUS_FILTERS = ['All', 'Pending', 'Approved', 'Rejected', 'Suspended'] as const;
type StatusFilterLabel = (typeof STATUS_FILTERS)[number];

const FILTER_TO_STATUS: Record<Exclude<StatusFilterLabel, 'All'>, MembershipStatus> = {
  Pending: 'pending',
  Approved: 'approved',
  Rejected: 'rejected',
  Suspended: 'suspended',
};

function parseStatusParam(param: string | null): StatusFilterLabel {
  switch (param?.toLowerCase()) {
    case 'pending':
      return 'Pending';
    case 'approved':
      return 'Approved';
    case 'rejected':
      return 'Rejected';
    case 'suspended':
      return 'Suspended';
    default:
      return 'All';
  }
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function AdminMembersPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [members, setMembers] = useState<AdminMemberRecord[]>([]);
  const [counts, setCounts] = useState<MembershipSummaryCounts>({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    suspended: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<StatusFilterLabel>(() =>
    parseStatusParam(searchParams.get('status')),
  );

  const [inspectedUserId, setInspectedUserId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<{
    member: AdminMemberRecord;
    status: ReviewActionStatus;
  } | null>(null);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const loadMembers = useCallback(async (showFullLoader: boolean) => {
    if (showFullLoader) {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }
    setLoadError(null);

    const result = await fetchAdminMembers();
    if (result.error) {
      setLoadError(result.error);
    } else {
      setMembers(result.members);
      setCounts(result.counts);
    }

    setIsLoading(false);
    setIsRefreshing(false);
  }, []);

  useEffect(() => {
    void loadMembers(true);
  }, [loadMembers]);

  const handleFilterChange = (next: StatusFilterLabel) => {
    setSelectedFilter(next);
    if (next === 'All') {
      searchParams.delete('status');
    } else {
      searchParams.set('status', FILTER_TO_STATUS[next]);
    }
    setSearchParams(searchParams, { replace: true });
  };

  const filteredMembers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return members.filter((record) => {
      if (selectedFilter !== 'All') {
        const expectedStatus = FILTER_TO_STATUS[selectedFilter];
        if (record.membership.status !== expectedStatus) return false;
      }

      if (query.length === 0) return true;

      const fullName = record.profile?.full_name.toLowerCase() ?? '';
      const username = record.profile?.username.toLowerCase() ?? '';
      const lagosLife = record.profile?.lagos_life_username.toLowerCase() ?? '';
      const userId = record.userId.toLowerCase();

      return (
        fullName.includes(query) ||
        username.includes(query) ||
        lagosLife.includes(query) ||
        userId.includes(query)
      );
    });
  }, [members, searchQuery, selectedFilter]);

  const inspectedMember = useMemo(
    () => members.find((m) => m.userId === inspectedUserId) ?? null,
    [members, inspectedUserId],
  );

  const handleOpenReviewAction = (
    member: AdminMemberRecord,
    status: ReviewActionStatus,
  ) => {
    setReviewError(null);
    setPendingAction({ member, status });
  };

  const handleConfirmReview = async (reviewNote: string) => {
    if (!pendingAction) return;

    setIsSubmittingReview(true);
    setReviewError(null);

    const result = await reviewMemberApplication({
      targetUserId: pendingAction.member.userId,
      newStatus: pendingAction.status,
      reviewNote,
    });

    setIsSubmittingReview(false);

    if (result.error) {
      setReviewError(result.error);
      return;
    }

    const memberLabel =
      pendingAction.member.profile?.username
        ? `@${pendingAction.member.profile.username}`
        : pendingAction.member.profile?.full_name ?? 'Member';

    setFeedbackMessage(
      `Updated ${memberLabel} to ${pendingAction.status.toUpperCase()} and recorded an audit entry.`,
    );
    setPendingAction(null);
    await loadMembers(false);
  };

  return (
    <div className="bg-brand-black">
      {/* Header */}
      <section className="relative overflow-hidden border-b hairline-border bg-brand-obsidian">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 ambient-gold-glow"
        />
        <PageContainer className="relative py-12 sm:py-16">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div>
              <div className="flex items-center gap-3">
                <span aria-hidden="true" className="h-px w-8 bg-brand-gold" />
                <p className="heading-eyebrow">Admin Control Center</p>
              </div>
              <h1 className="heading-display mt-4 text-4xl text-brand-white sm:text-5xl">
                Membership Management
              </h1>
              <p className="mt-3 max-w-2xl font-body text-sm leading-relaxed text-brand-muted">
                Review incoming applications, inspect member profiles, and execute
                audited approval, rejection, or suspension decisions.
              </p>
            </div>

            <div className="flex items-center gap-4">
              <div className="border-r hairline-border pr-4 text-right">
                <p className="font-body text-[0.65rem] tracking-[0.2em] text-brand-muted uppercase">
                  Directory
                </p>
                <p className="mt-0.5 font-heading text-lg text-brand-gold">
                  {counts.total} Total &bull; {counts.pending} Pending
                </p>
              </div>
              <Button
                variant="subtle"
                size="sm"
                onClick={() => void loadMembers(false)}
                disabled={isLoading || isRefreshing}
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`}
                  aria-hidden="true"
                />
                Refresh
              </Button>
            </div>
          </div>
        </PageContainer>
      </section>

      <PageContainer className="py-10 sm:py-14">
        {feedbackMessage && (
          <div
            role="status"
            className="mb-6 flex items-center justify-between gap-4 border border-brand-gold/45 bg-brand-charcoal p-4 text-xs text-brand-cream"
          >
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-brand-gold" aria-hidden="true" />
              <p>{feedbackMessage}</p>
            </div>
            <button
              type="button"
              onClick={() => setFeedbackMessage(null)}
              className="cursor-pointer font-heading text-[0.68rem] tracking-[0.18em] text-brand-muted uppercase hover:text-brand-white"
            >
              Dismiss
            </button>
          </div>
        )}

        {loadError && (
          <div
            role="alert"
            className="mb-6 flex items-start gap-3 border border-red-400/40 bg-red-950/30 p-4 text-sm text-red-200"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" aria-hidden="true" />
            <p>{loadError}</p>
          </div>
        )}

        {/* Search & Status Filters */}
        <div className="flex flex-col gap-4 border-b hairline-border pb-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="w-full lg:max-w-md">
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search full name, VATAR or Lagos Life username..."
              ariaLabel="Search members"
            />
          </div>

          <CategoryFilter
            categories={STATUS_FILTERS}
            selected={selectedFilter}
            onSelect={handleFilterChange}
            ariaLabel="Filter members by status"
          />
        </div>

        {/* Member Directory */}
        <div className="mt-8">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((row) => (
                <div
                  key={row}
                  className="h-16 animate-pulse border hairline-border bg-brand-charcoal/45"
                />
              ))}
            </div>
          ) : filteredMembers.length === 0 ? (
            <EmptyState
              icon={<Users className="h-4 w-4" aria-hidden="true" />}
              eyebrow={selectedFilter === 'All' ? 'No Members Found' : `${selectedFilter} Queue`}
              title={
                searchQuery.trim().length > 0
                  ? `No members match "${searchQuery.trim()}"`
                  : `No ${selectedFilter === 'All' ? '' : `${selectedFilter.toLowerCase()} `}member records found`
              }
              description="Registered accounts will appear here automatically as members sign up through VATAR LIFESTYLE BY SOFT."
              action={
                searchQuery.length > 0 || selectedFilter !== 'All' ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setSearchQuery('');
                      handleFilterChange('All');
                    }}
                  >
                    Reset Filters
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden overflow-x-auto border hairline-border bg-brand-charcoal/45 lg:block">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b hairline-border bg-brand-obsidian font-heading text-[0.72rem] tracking-[0.2em] text-brand-muted uppercase">
                      <th scope="col" className="px-5 py-4 font-medium">
                        Member
                      </th>
                      <th scope="col" className="px-5 py-4 font-medium">
                        VATAR Username
                      </th>
                      <th scope="col" className="px-5 py-4 font-medium">
                        Lagos Life
                      </th>
                      <th scope="col" className="px-5 py-4 font-medium">
                        Email
                      </th>
                      <th scope="col" className="px-5 py-4 font-medium">
                        Status
                      </th>
                      <th scope="col" className="px-5 py-4 font-medium">
                        Registered
                      </th>
                      <th scope="col" className="px-5 py-4 text-right font-medium">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-cream/10">
                    {filteredMembers.map((record) => {
                      const isSelf = user?.id === record.userId;
                      return (
                        <tr
                          key={record.userId}
                          className="transition-colors hover:bg-brand-charcoal/80"
                        >
                          <td className="px-5 py-4">
                            <p className="font-heading text-sm tracking-[0.06em] text-brand-white uppercase">
                              {record.profile?.full_name ?? 'Profile Pending'}
                            </p>
                            {record.roles.length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1.5">
                                {record.roles.map((role) => (
                                  <RoleBadge key={role} role={role} />
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="px-5 py-4 font-body text-sm text-brand-cream">
                            {record.profile?.username ? `@${record.profile.username}` : '—'}
                          </td>
                          <td className="px-5 py-4 font-body text-sm text-brand-cream/85">
                            {record.profile?.lagos_life_username ?? '—'}
                          </td>
                          <td className="px-5 py-4 font-body text-xs text-brand-muted">
                            {isSelf && user?.email ? user.email : 'Auth-managed'}
                          </td>
                          <td className="px-5 py-4">
                            <MembershipStatusBadge status={record.membership.status} />
                          </td>
                          <td className="px-5 py-4 font-body text-xs text-brand-muted">
                            {formatDate(record.membership.created_at)}
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setInspectedUserId(record.userId)}
                                className="inline-flex cursor-pointer items-center gap-1.5 border hairline-border bg-brand-black px-2.5 py-1.5 font-heading text-[0.68rem] tracking-[0.16em] text-brand-cream uppercase transition-colors hover:border-brand-gold hover:text-brand-gold"
                              >
                                <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                                Inspect
                              </button>

                              {!isSelf && record.membership.status !== 'approved' && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenReviewAction(record, 'approved')}
                                  className="inline-flex cursor-pointer items-center gap-1 border border-brand-gold/60 bg-brand-gold/10 px-2.5 py-1.5 font-heading text-[0.68rem] tracking-[0.16em] text-brand-gold uppercase transition-colors hover:bg-brand-gold hover:text-brand-black"
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                                  Approve
                                </button>
                              )}

                              {!isSelf && record.membership.status === 'pending' && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenReviewAction(record, 'rejected')}
                                  className="inline-flex cursor-pointer items-center gap-1 border border-red-400/35 bg-red-950/25 px-2.5 py-1.5 font-heading text-[0.68rem] tracking-[0.16em] text-red-300 uppercase transition-colors hover:border-red-400 hover:text-red-200"
                                >
                                  <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                                  Reject
                                </button>
                              )}

                              {!isSelf && record.membership.status !== 'suspended' && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenReviewAction(record, 'suspended')}
                                  className="inline-flex cursor-pointer items-center gap-1 border hairline-border bg-brand-charcoal px-2.5 py-1.5 font-heading text-[0.68rem] tracking-[0.16em] text-brand-muted uppercase transition-colors hover:border-amber-400/60 hover:text-amber-300"
                                >
                                  <Ban className="h-3.5 w-3.5" aria-hidden="true" />
                                  Suspend
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile / Tablet Stacked Cards */}
              <div className="space-y-4 lg:hidden">
                {filteredMembers.map((record) => {
                  const isSelf = user?.id === record.userId;
                  return (
                    <article
                      key={record.userId}
                      className="border hairline-border bg-brand-charcoal/60 p-5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-heading text-lg tracking-[0.06em] text-brand-white uppercase">
                            {record.profile?.full_name ?? 'Profile Pending'}
                          </p>
                          <p className="mt-0.5 font-body text-xs text-brand-gold">
                            {record.profile?.username ? `@${record.profile.username}` : '—'}
                          </p>
                        </div>
                        <MembershipStatusBadge status={record.membership.status} />
                      </div>

                      <dl className="mt-4 grid grid-cols-2 gap-3 border-t hairline-border pt-4 text-xs">
                        <div>
                          <dt className="text-brand-muted uppercase">Lagos Life</dt>
                          <dd className="mt-0.5 text-brand-cream">
                            {record.profile?.lagos_life_username ?? '—'}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-brand-muted uppercase">Registered</dt>
                          <dd className="mt-0.5 text-brand-cream">
                            {formatDate(record.membership.created_at)}
                          </dd>
                        </div>
                        <div className="col-span-2">
                          <dt className="text-brand-muted uppercase">Email</dt>
                          <dd className="mt-0.5 text-brand-cream/85">
                            {isSelf && user?.email ? user.email : 'Auth-managed'}
                          </dd>
                        </div>
                      </dl>

                      <div className="mt-5 flex flex-wrap gap-2 border-t hairline-border pt-4">
                        <Button
                          variant="subtle"
                          size="sm"
                          onClick={() => setInspectedUserId(record.userId)}
                        >
                          Inspect
                        </Button>
                        {!isSelf && record.membership.status !== 'approved' && (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleOpenReviewAction(record, 'approved')}
                          >
                            Approve
                          </Button>
                        )}
                        {!isSelf && record.membership.status !== 'rejected' && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleOpenReviewAction(record, 'rejected')}
                          >
                            Reject
                          </Button>
                        )}
                        {!isSelf && record.membership.status !== 'suspended' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenReviewAction(record, 'suspended')}
                          >
                            Suspend
                          </Button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </PageContainer>

      <MemberDetailDrawer
        member={inspectedMember}
        currentUserId={user?.id ?? null}
        currentUserEmail={user?.email ?? null}
        onClose={() => setInspectedUserId(null)}
        onSelectAction={handleOpenReviewAction}
      />

      <ReviewConfirmationModal
        member={pendingAction?.member ?? null}
        actionStatus={pendingAction?.status ?? null}
        isSubmitting={isSubmittingReview}
        error={reviewError}
        onClose={() => {
          if (!isSubmittingReview) {
            setPendingAction(null);
            setReviewError(null);
          }
        }}
        onConfirm={handleConfirmReview}
      />
    </div>
  );
}
