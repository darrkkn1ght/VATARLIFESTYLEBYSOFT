import {
  Ban,
  Calendar,
  CheckCircle2,
  Clock,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { MembershipStatusBadge } from '@/features/administration/components/MembershipStatusBadge';
import { useAuth } from '@/features/auth/hooks/useAuth';
import type { MembershipStatus } from '@/lib/supabase/database.types';

const STATUS_DESCRIPTIONS: Record<
  MembershipStatus,
  { headline: string; detail: string; icon: typeof CheckCircle2; borderClass: string }
> = {
  approved: {
    headline: 'Active Verified Membership',
    detail:
      'Your membership has been verified and approved by VATAR LIFESTYLE BY SOFT administration. You hold full member portal access.',
    icon: CheckCircle2,
    borderClass: 'border-brand-gold/45',
  },
  pending: {
    headline: 'Application Under Review',
    detail:
      'Your membership application is awaiting review by VATAR administration.',
    icon: Clock,
    borderClass: 'border-brand-gold/35',
  },
  rejected: {
    headline: 'Application Declined',
    detail:
      'Your membership application was not approved for member-only access.',
    icon: XCircle,
    borderClass: 'border-red-400/45',
  },
  suspended: {
    headline: 'Membership Restricted',
    detail:
      'Access on this membership record is currently suspended.',
    icon: Ban,
    borderClass: 'border-amber-400/45',
  },
};

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function MemberMembershipPage() {
  const { user, profile, membership } = useAuth();

  const statusMeta = membership ? STATUS_DESCRIPTIONS[membership.status] : null;
  const StatusIcon = statusMeta?.icon ?? ShieldCheck;

  return (
    <div className="bg-brand-black">
      <section className="relative overflow-hidden border-b hairline-border bg-brand-obsidian">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 ambient-gold-glow"
        />
        <PageContainer className="relative py-12 sm:py-16">
          <div className="flex items-center gap-3">
            <span aria-hidden="true" className="h-px w-8 bg-brand-gold" />
            <p className="heading-eyebrow">Verified Standing</p>
          </div>
          <h1 className="heading-display mt-4 text-4xl text-brand-white sm:text-5xl">
            My Membership
          </h1>
          <p className="mt-3 max-w-2xl font-body text-sm leading-relaxed text-brand-muted">
            Your official VATAR LIFESTYLE BY SOFT membership record, approval timeline,
            and registered member identity.
          </p>
        </PageContainer>
      </section>

      <PageContainer className="py-12 sm:py-16">
        <div className="grid gap-10 lg:grid-cols-12">
          {/* Primary Membership Card */}
          <div className="lg:col-span-8">
            <article
              className={`border bg-brand-charcoal/75 p-6 sm:p-10 ${statusMeta?.borderClass ?? 'hairline-border'}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-4 border-b hairline-border pb-6">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center border border-brand-gold/40 bg-brand-black text-brand-gold">
                    <StatusIcon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="heading-eyebrow">Official Status</p>
                    <h2 className="heading-section mt-1 text-2xl text-brand-white">
                      {statusMeta?.headline ?? 'Membership Record'}
                    </h2>
                  </div>
                </div>

                {membership && (
                  <MembershipStatusBadge status={membership.status} />
                )}
              </div>

              <p className="mt-6 font-body text-sm leading-relaxed text-brand-muted">
                {statusMeta?.detail ??
                  'Membership standing is managed exclusively by VATAR administration.'}
              </p>

              {/* Timeline Dates */}
              <dl className="mt-8 grid gap-5 sm:grid-cols-2">
                <div className="border hairline-border bg-brand-black/65 p-5">
                  <dt className="flex items-center gap-2 font-body text-[0.68rem] tracking-[0.2em] text-brand-muted uppercase">
                    <Calendar className="h-3.5 w-3.5 text-brand-gold" aria-hidden="true" />
                    Application Date
                  </dt>
                  <dd className="mt-2 font-body text-sm text-brand-cream">
                    {formatDateTime(membership?.created_at)}
                  </dd>
                </div>

                <div className="border hairline-border bg-brand-black/65 p-5">
                  <dt className="flex items-center gap-2 font-body text-[0.68rem] tracking-[0.2em] text-brand-muted uppercase">
                    <CheckCircle2 className="h-3.5 w-3.5 text-brand-gold" aria-hidden="true" />
                    Approval / Review Date
                  </dt>
                  <dd className="mt-2 font-body text-sm text-brand-cream">
                    {membership?.reviewed_at
                      ? formatDateTime(membership.reviewed_at)
                      : 'Not yet recorded'}
                  </dd>
                </div>
              </dl>

              {membership?.review_note && (
                <div className="mt-6 border-l-2 border-brand-gold bg-brand-black/65 p-5">
                  <p className="font-heading text-xs tracking-[0.2em] text-brand-gold uppercase">
                    Administrator Review Note
                  </p>
                  <p className="mt-2 font-body text-sm leading-relaxed text-brand-cream/90">
                    {membership.review_note}
                  </p>
                </div>
              )}
            </article>
          </div>

          {/* Membership Identity Summary */}
          <aside className="lg:col-span-4">
            <div className="border hairline-border bg-brand-charcoal/55 p-6 sm:p-7">
              <p className="heading-eyebrow">Identity</p>
              <h2 className="heading-section mt-2 text-2xl text-brand-white">
                Member Credentials
              </h2>

              <dl className="mt-6 space-y-4 border-t hairline-border pt-5 text-sm">
                <div>
                  <dt className="font-body text-[0.65rem] tracking-[0.2em] text-brand-muted uppercase">
                    Full Name
                  </dt>
                  <dd className="mt-1 font-heading text-base tracking-[0.06em] text-brand-white uppercase">
                    {profile?.full_name ?? '—'}
                  </dd>
                </div>

                <div>
                  <dt className="font-body text-[0.65rem] tracking-[0.2em] text-brand-muted uppercase">
                    VATAR Username
                  </dt>
                  <dd className="mt-1 font-body text-brand-cream">
                    {profile?.username ? `@${profile.username}` : '—'}
                  </dd>
                </div>

                <div>
                  <dt className="font-body text-[0.65rem] tracking-[0.2em] text-brand-muted uppercase">
                    Lagos Life Username
                  </dt>
                  <dd className="mt-1 font-body text-brand-cream">
                    {profile?.lagos_life_username ?? '—'}
                  </dd>
                </div>

                <div>
                  <dt className="font-body text-[0.65rem] tracking-[0.2em] text-brand-muted uppercase">
                    Registered Email
                  </dt>
                  <dd className="mt-1 break-all font-body text-xs text-brand-cream/85">
                    {user?.email ?? '—'}
                  </dd>
                </div>

                <div className="border-t hairline-border pt-4">
                  <dt className="font-body text-[0.65rem] tracking-[0.2em] text-brand-muted uppercase">
                    Membership ID
                  </dt>
                  <dd className="mt-1 break-all font-mono text-[0.72rem] text-brand-muted">
                    {membership?.id ?? '—'}
                  </dd>
                </div>
              </dl>

              <p className="mt-6 border-t hairline-border pt-4 font-body text-xs leading-relaxed text-brand-muted">
                Membership status is read-only and controlled exclusively by authorized
                VATAR administrators.
              </p>
            </div>
          </aside>
        </div>
      </PageContainer>
    </div>
  );
}
