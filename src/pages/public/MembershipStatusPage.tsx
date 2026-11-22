import { useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Ban,
  CheckCircle2,
  Clock,
  LogOut,
  RefreshCw,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { PageContainer } from '@/components/layout/PageContainer';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/features/auth/hooks/useAuth';
import type { MembershipStatus } from '@/lib/supabase/database.types';
import { ROUTES } from '@/routes/paths';

interface StatusPresentation {
  badge: string;
  headline: string;
  description: string;
  icon: typeof Clock;
  accentClass: string;
}

const STATUS_CONTENT: Record<MembershipStatus, StatusPresentation> = {
  pending: {
    badge: 'Pending Review',
    headline: 'Your Membership Application Is Under Review',
    description:
      'Thank you for registering with VATAR LIFESTYLE BY SOFT. Your profile is in the review queue. Once an administrator approves your membership, full access to the Member Dashboard will unlock automatically.',
    icon: Clock,
    accentClass: 'border-brand-gold/50 text-brand-gold',
  },
  approved: {
    badge: 'Approved Member',
    headline: 'Your Membership Is Active',
    description:
      'Welcome to VATAR LIFESTYLE BY SOFT. Your account has been verified and approved for full member access.',
    icon: CheckCircle2,
    accentClass: 'border-brand-gold bg-brand-gold/10 text-brand-gold',
  },
  rejected: {
    badge: 'Application Declined',
    headline: 'Your Membership Application Was Not Approved',
    description:
      'At this time, your membership application could not be approved for member-only access. If you believe this was in error or would like clarification, please reach out through our contact channels.',
    icon: XCircle,
    accentClass: 'border-red-400/50 text-red-300',
  },
  suspended: {
    badge: 'Account Restricted',
    headline: 'Your Member Access Is Currently Suspended',
    description:
      'Access to member-only areas of VATAR LIFESTYLE BY SOFT has been restricted on this account. Please contact VATAR administration for review details.',
    icon: Ban,
    accentClass: 'border-red-400/60 bg-red-950/30 text-red-300',
  },
};

export function MembershipStatusPage() {
  const {
    user,
    profile,
    membership,
    membershipStatus,
    accountError,
    isAdmin,
    refreshAccountData,
    signOut,
  } = useAuth();
  const navigate = useNavigate();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshAccountData();
    setIsRefreshing(false);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate(ROUTES.login, { replace: true });
  };

  const hasDataError = Boolean(accountError);
  const resolvedStatus =
    !hasDataError && membershipStatus ? STATUS_CONTENT[membershipStatus] : null;
  const StatusIcon = hasDataError
    ? AlertTriangle
    : (resolvedStatus?.icon ?? ShieldAlert);

  const canAccessAdmin =
    isAdmin && membershipStatus !== 'suspended' && membershipStatus !== 'rejected';

  return (
    <div className="flex min-h-screen flex-col bg-brand-black text-brand-white">
      <header className="border-b hairline-border bg-brand-obsidian">
        <PageContainer className="flex h-20 items-center justify-between gap-4">
          <Link to={ROUTES.home} className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="flex h-8 w-8 items-center justify-center border border-brand-gold/50 bg-brand-charcoal font-heading text-sm font-semibold text-brand-gold"
            >
              V
            </span>
            <span className="flex flex-col leading-none">
              <span className="font-heading text-base font-semibold tracking-[0.16em] text-brand-white uppercase">
                VATAR LIFESTYLE
              </span>
              <span className="mt-1 font-body text-[0.58rem] font-medium tracking-[0.36em] text-brand-gold uppercase">
                BY SOFT
              </span>
            </span>
          </Link>

          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
            Sign Out
          </Button>
        </PageContainer>
      </header>

      <main className="flex flex-1 items-center py-16 sm:py-24">
        <PageContainer>
          <div className="mx-auto max-w-3xl border hairline-border bg-brand-charcoal/75 p-8 sm:p-12">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b hairline-border pb-6">
              <div className="flex items-center gap-3">
                <span
                  className={`flex h-11 w-11 items-center justify-center border bg-brand-black ${
                    hasDataError
                      ? 'border-red-400/60 bg-red-950/30 text-red-300'
                      : (resolvedStatus?.accentClass ?? 'border-brand-gold/40 text-brand-gold')
                  }`}
                >
                  <StatusIcon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="heading-eyebrow">Membership Status</p>
                  <p className="mt-0.5 font-heading text-sm tracking-[0.18em] text-brand-cream uppercase">
                    {hasDataError
                      ? 'Account Data Error'
                      : (resolvedStatus?.badge ?? 'Status Unavailable')}
                  </p>
                </div>
              </div>

              <Button
                variant="subtle"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing}
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`}
                  aria-hidden="true"
                />
                {isRefreshing ? 'Checking...' : 'Refresh Status'}
              </Button>
            </div>

            {hasDataError && accountError ? (
              <div className="mt-8">
                <h1 className="heading-display text-3xl text-brand-white sm:text-5xl">
                  Unable To Retrieve Account Records
                </h1>
                <p className="body-lead mt-5">
                  You are signed in, but the application could not load your profile or
                  membership record from Supabase. This is a database permission or
                  connectivity issue rather than a missing membership.
                </p>

                <div
                  role="alert"
                  className="mt-6 border border-red-400/40 bg-red-950/30 p-4 font-body text-xs leading-relaxed text-red-200"
                >
                  <p className="font-heading tracking-[0.18em] text-red-300 uppercase">
                    Error Details
                    {accountError.code ? ` (Code ${accountError.code})` : ''}
                  </p>
                  <p className="mt-1.5 break-words text-red-200/90">
                    {accountError.message}
                  </p>
                </div>
              </div>
            ) : (
              <div className="mt-8">
                <h1 className="heading-display text-3xl text-brand-white sm:text-5xl">
                  {resolvedStatus?.headline ?? 'Membership Record Not Found'}
                </h1>
                <p className="body-lead mt-5">
                  {resolvedStatus?.description ??
                    'We could not locate an active membership record for your account. Please refresh or contact VATAR support.'}
                </p>

                {membership?.review_note && (
                  <div className="mt-6 border-l-2 border-brand-gold bg-brand-black/60 p-4">
                    <p className="font-heading text-xs tracking-[0.2em] text-brand-gold uppercase">
                      Administrator Note
                    </p>
                    <p className="mt-1.5 font-body text-sm text-brand-cream/90">
                      {membership.review_note}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Account Summary */}
            <dl className="mt-8 grid gap-4 border-t border-b hairline-border py-6 sm:grid-cols-3">
              <div>
                <dt className="font-body text-[0.68rem] tracking-[0.2em] text-brand-muted uppercase">
                  Member
                </dt>
                <dd className="mt-1 font-heading text-base tracking-[0.06em] text-brand-white uppercase">
                  {profile?.full_name ?? user?.email ?? '—'}
                </dd>
              </div>
              <div>
                <dt className="font-body text-[0.68rem] tracking-[0.2em] text-brand-muted uppercase">
                  VATAR Username
                </dt>
                <dd className="mt-1 font-body text-sm text-brand-cream">
                  {profile?.username ? `@${profile.username}` : '—'}
                </dd>
              </div>
              <div>
                <dt className="font-body text-[0.68rem] tracking-[0.2em] text-brand-muted uppercase">
                  Lagos Life Username
                </dt>
                <dd className="mt-1 font-body text-sm text-brand-cream">
                  {profile?.lagos_life_username ?? '—'}
                </dd>
              </div>
            </dl>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              {!hasDataError && membershipStatus === 'approved' && (
                <Button to={ROUTES.dashboard} variant="primary" size="md">
                  Enter Member Dashboard
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              )}

              {!hasDataError && canAccessAdmin && (
                <Button to={ROUTES.admin} variant="secondary" size="md">
                  Open Administration
                </Button>
              )}

              {(!hasDataError &&
                (membershipStatus === 'rejected' ||
                  membershipStatus === 'suspended')) && (
                <Button to={ROUTES.contact} variant="secondary" size="md">
                  Contact Support
                </Button>
              )}

              <Button to={ROUTES.home} variant="ghost" size="md">
                Return to Public Site
              </Button>
            </div>
          </div>
        </PageContainer>
      </main>
    </div>
  );
}
