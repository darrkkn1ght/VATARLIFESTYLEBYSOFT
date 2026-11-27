import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  Ban,
  CheckCircle2,
  Clock,
  RefreshCw,
  Users,
  XCircle,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageContainer } from '@/components/layout/PageContainer';
import { EmptyState } from '@/components/shared/EmptyState';
import { SectionHeading } from '@/components/shared/SectionHeading';
import { Button } from '@/components/ui/Button';
import { RoleBadge } from '@/features/administration/components/MembershipStatusBadge';
import { AdminLiveActivityPanel } from '@/features/administration/components/AdminLiveActivityPanel';
import {
  fetchAdminMembers,
  fetchRecentAuditActivity,
} from '@/features/administration/services/adminService';
import type {
  AdminAuditEntry,
  MembershipSummaryCounts,
} from '@/features/administration/types/admin.types';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { ROUTES } from '@/routes/paths';

const INITIAL_COUNTS: MembershipSummaryCounts = {
  total: 0,
  pending: 0,
  approved: 0,
  rejected: 0,
  suspended: 0,
};

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatActionTitle(entry: AdminAuditEntry): string {
  switch (entry.log.action) {
    case 'membership.status_updated':
      return entry.previousStatus && entry.newStatus
        ? `Membership ${entry.previousStatus} → ${entry.newStatus}`
        : 'Membership status updated';
    case 'role.granted':
      return entry.roleLabel ? `Role granted: ${entry.roleLabel}` : 'Role granted';
    case 'role.updated':
      return entry.roleLabel ? `Role updated: ${entry.roleLabel}` : 'Role updated';
    case 'role.revoked':
      return entry.roleLabel ? `Role revoked: ${entry.roleLabel}` : 'Role revoked';
    default:
      return entry.log.action;
  }
}

export function AdminOverviewPage() {
  const { profile, roles } = useAuth();
  const [counts, setCounts] = useState<MembershipSummaryCounts>(INITIAL_COUNTS);
  const [auditEntries, setAuditEntries] = useState<AdminAuditEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadOverview = useCallback(async (showFullLoader: boolean) => {
    if (showFullLoader) {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }
    setError(null);

    const membersResult = await fetchAdminMembers();
    if (membersResult.error) {
      setError(membersResult.error);
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    setCounts(membersResult.counts);

    const auditResult = await fetchRecentAuditActivity(membersResult.profileMap, 10);
    if (auditResult.error) {
      setError(auditResult.error);
    } else {
      setAuditEntries(auditResult.entries);
    }

    setIsLoading(false);
    setIsRefreshing(false);
  }, []);

  useEffect(() => {
    void loadOverview(true);
  }, [loadOverview]);

  return (
    <div className="bg-brand-black">
      {/* Control Center Masthead */}
      <section className="relative overflow-hidden border-b hairline-border bg-brand-obsidian">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 ambient-gold-glow"
        />
        <PageContainer className="relative py-12 sm:py-16">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <span aria-hidden="true" className="h-px w-8 bg-brand-gold" />
                <p className="heading-eyebrow">Admin Control Center</p>
                {roles.map((role) => (
                  <RoleBadge key={role} role={role} />
                ))}
              </div>
              <h1 className="heading-display mt-4 text-4xl text-brand-white sm:text-5xl">
                Operations Overview
              </h1>
              <p className="mt-3 max-w-2xl font-body text-sm leading-relaxed text-brand-muted">
                Signed in as{' '}
                <span className="text-brand-cream">
                  {profile?.full_name ?? 'Administrator'}
                </span>
                {profile?.username ? ` (@${profile.username})` : ''}. Live membership
                metrics and audited governance activity powered directly by Supabase.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="subtle"
                size="sm"
                onClick={() => void loadOverview(false)}
                disabled={isLoading || isRefreshing}
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`}
                  aria-hidden="true"
                />
                {isRefreshing ? 'Refreshing...' : 'Refresh'}
              </Button>
              <Button to={ROUTES.adminMembers} variant="primary" size="sm">
                Manage Members
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            </div>
          </div>
        </PageContainer>
      </section>

      <PageContainer className="space-y-8 py-6 sm:py-10">
        {error && (
          <div
            role="alert"
            className="flex items-start gap-3 border border-red-400/40 bg-red-950/30 p-4 text-sm text-red-200"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" aria-hidden="true" />
            <p>{error}</p>
          </div>
        )}

        {/* Live Online Users + Unified Transaction Feed */}
        <AdminLiveActivityPanel />

        {/* Membership Metrics */}
        <section aria-label="Membership summary metrics">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-12">
            {/* Highlighted Pending Queue */}
            <article className="flex flex-col justify-between border border-brand-gold/45 bg-brand-charcoal/85 p-6 sm:p-7 lg:col-span-4">
              <div className="flex items-center justify-between gap-3">
                <p className="heading-eyebrow">Pending Applications</p>
                <Clock className="h-4 w-4 text-brand-gold" aria-hidden="true" />
              </div>

              <div className="mt-5">
                <p className="font-heading text-5xl font-semibold tracking-[0.04em] text-brand-gold">
                  {isLoading ? '—' : counts.pending}
                </p>
                <p className="mt-2 font-body text-xs text-brand-muted">
                  Awaiting administrator verification and approval.
                </p>
              </div>

              <div className="mt-6 border-t hairline-border pt-4">
                <Link
                  to={`${ROUTES.adminMembers}?status=pending`}
                  className="inline-flex items-center gap-1.5 font-heading text-xs tracking-[0.18em] text-brand-cream uppercase transition-colors hover:text-brand-gold"
                >
                  Review Pending Queue
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </div>
            </article>

            {/* Remaining 4 Counters */}
            <div className="grid gap-4 sm:grid-cols-2 lg:col-span-8">
              <article className="border hairline-border bg-brand-charcoal/55 p-6">
                <div className="flex items-center justify-between">
                  <p className="font-body text-[0.7rem] tracking-[0.2em] text-brand-muted uppercase">
                    Total Members
                  </p>
                  <Users className="h-4 w-4 text-brand-gold/80" aria-hidden="true" />
                </div>
                <p className="mt-4 font-heading text-4xl font-semibold text-brand-white">
                  {isLoading ? '—' : counts.total}
                </p>
                <p className="mt-1.5 font-body text-xs text-brand-muted">
                  All registered membership records
                </p>
              </article>

              <article className="border hairline-border bg-brand-charcoal/55 p-6">
                <div className="flex items-center justify-between">
                  <p className="font-body text-[0.7rem] tracking-[0.2em] text-brand-muted uppercase">
                    Approved Members
                  </p>
                  <CheckCircle2 className="h-4 w-4 text-emerald-400/80" aria-hidden="true" />
                </div>
                <p className="mt-4 font-heading text-4xl font-semibold text-brand-white">
                  {isLoading ? '—' : counts.approved}
                </p>
                <p className="mt-1.5 font-body text-xs text-brand-muted">
                  Active verified member access
                </p>
              </article>

              <article className="border hairline-border bg-brand-charcoal/55 p-6">
                <div className="flex items-center justify-between">
                  <p className="font-body text-[0.7rem] tracking-[0.2em] text-brand-muted uppercase">
                    Rejected Applications
                  </p>
                  <XCircle className="h-4 w-4 text-red-400/80" aria-hidden="true" />
                </div>
                <p className="mt-4 font-heading text-4xl font-semibold text-brand-white">
                  {isLoading ? '—' : counts.rejected}
                </p>
                <p className="mt-1.5 font-body text-xs text-brand-muted">
                  Declined membership applications
                </p>
              </article>

              <article className="border hairline-border bg-brand-charcoal/55 p-6">
                <div className="flex items-center justify-between">
                  <p className="font-body text-[0.7rem] tracking-[0.2em] text-brand-muted uppercase">
                    Suspended Accounts
                  </p>
                  <Ban className="h-4 w-4 text-amber-400/80" aria-hidden="true" />
                </div>
                <p className="mt-4 font-heading text-4xl font-semibold text-brand-white">
                  {isLoading ? '—' : counts.suspended}
                </p>
                <p className="mt-1.5 font-body text-xs text-brand-muted">
                  Restricted member &amp; admin access
                </p>
              </article>
            </div>
          </div>
        </section>

        {/* Recent Activity + Quick Navigation */}
        <section className="mt-14 grid gap-10 lg:grid-cols-12">
          {/* Audit Activity Ledger */}
          <div className="lg:col-span-8">
            <SectionHeading
              index="01"
              eyebrow="Audit Trail"
              title="Recent Membership Activity"
              description="Immutable administrative records written automatically to public.audit_logs."
            />

            <div className="mt-6">
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((slot) => (
                    <div
                      key={slot}
                      className="h-20 animate-pulse border hairline-border bg-brand-charcoal/45"
                    />
                  ))}
                </div>
              ) : auditEntries.length === 0 ? (
                <EmptyState
                  icon={<Activity className="h-4 w-4" aria-hidden="true" />}
                  eyebrow="No Audit Records Yet"
                  title="No Administrative Activity Logged"
                  description="Membership approvals, rejections, suspensions, and role assignments will appear here automatically."
                  compact
                />
              ) : (
                <div className="divide-y divide-brand-cream/10 border hairline-border bg-brand-charcoal/50">
                  {auditEntries.map((entry) => (
                    <article
                      key={entry.log.id}
                      className="flex flex-col justify-between gap-3 p-5 sm:flex-row sm:items-start"
                    >
                      <div>
                        <p className="font-heading text-sm tracking-[0.14em] text-brand-cream uppercase">
                          {formatActionTitle(entry)}
                        </p>
                        <p className="mt-1 font-body text-xs text-brand-muted">
                          Target:{' '}
                          <span className="text-brand-white">{entry.targetLabel}</span>
                          {' • '}Actor:{' '}
                          <span className="text-brand-gold">{entry.actorLabel}</span>
                        </p>
                        {entry.reviewNote && (
                          <p className="mt-2 border-l border-brand-gold/40 pl-3 font-body text-xs text-brand-cream/80">
                            “{entry.reviewNote}”
                          </p>
                        )}
                      </div>

                      <span className="shrink-0 font-body text-xs text-brand-muted">
                        {formatTimestamp(entry.log.created_at)}
                      </span>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Control Center Navigation Rail */}
          <aside className="lg:col-span-4">
            <div className="border hairline-border bg-brand-charcoal/65 p-6 sm:p-7">
              <p className="heading-eyebrow">Quick Access</p>
              <h2 className="heading-section mt-3 text-2xl text-brand-white">
                Membership Operations
              </h2>
              <p className="mt-2 font-body text-xs leading-relaxed text-brand-muted">
                Jump directly into filtered member queues to review applications or
                inspect member dossiers.
              </p>

              <nav aria-label="Membership quick filters" className="mt-6 divide-y divide-brand-cream/10 border-t border-b hairline-border">
                <Link
                  to={ROUTES.adminMembers}
                  className="flex items-center justify-between py-3.5 font-heading text-xs tracking-[0.18em] text-brand-cream uppercase transition-colors hover:text-brand-gold"
                >
                  <span>All Members ({isLoading ? '—' : counts.total})</span>
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
                <Link
                  to={`${ROUTES.adminMembers}?status=pending`}
                  className="flex items-center justify-between py-3.5 font-heading text-xs tracking-[0.18em] text-brand-gold uppercase transition-colors hover:text-brand-cream"
                >
                  <span>Pending Queue ({isLoading ? '—' : counts.pending})</span>
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
                <Link
                  to={`${ROUTES.adminMembers}?status=approved`}
                  className="flex items-center justify-between py-3.5 font-heading text-xs tracking-[0.18em] text-brand-cream uppercase transition-colors hover:text-brand-gold"
                >
                  <span>Approved ({isLoading ? '—' : counts.approved})</span>
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
                <Link
                  to={`${ROUTES.adminMembers}?status=suspended`}
                  className="flex items-center justify-between py-3.5 font-heading text-xs tracking-[0.18em] text-brand-cream uppercase transition-colors hover:text-brand-gold"
                >
                  <span>Suspended ({isLoading ? '—' : counts.suspended})</span>
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </nav>

              <p className="mt-6 font-body text-xs leading-relaxed text-brand-muted">
                Competitions, Leaderboard, Marketplace, and Announcements administration
                modules are scheduled for subsequent milestones.
              </p>
            </div>
          </aside>
        </section>
      </PageContainer>
    </div>
  );
}
