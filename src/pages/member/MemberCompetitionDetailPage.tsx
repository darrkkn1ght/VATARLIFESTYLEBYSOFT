import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Loader2,
  Trophy,
  Users,
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { PageContainer } from '@/components/layout/PageContainer';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/Button';
import {
  CompetitionStatusBadge,
  RegistrationStatusBadge,
} from '@/features/competitions/components/CompetitionStatusBadge';
import {
  fetchMemberCompetitionDetail,
  registerMemberForCompetition,
} from '@/features/competitions/services/competitionService';
import type { CompetitionWithMeta } from '@/features/competitions/types/competition.types';
import { useAuth } from '@/features/auth/hooks/useAuth';
import type { PublishedCompetitionResultRow } from '@/lib/supabase/database.types';
import { ROUTES } from '@/routes/paths';

function formatDateTime(iso: string | null): string {
  if (!iso) return 'TBA';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function MemberCompetitionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  const [item, setItem] = useState<CompetitionWithMeta | null>(null);
  const [publishedResults, setPublishedResults] = useState<
    PublishedCompetitionResultRow[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);

  const loadDetail = useCallback(async () => {
    if (!id || !user) return;
    setIsLoading(true);
    setError(null);

    const res = await fetchMemberCompetitionDetail(id, user.id);
    if (res.error) setError(res.error);
    setItem(res.item);
    setPublishedResults(res.publishedResults);
    setIsLoading(false);
  }, [id, user]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const handleRegister = async () => {
    if (!id) return;
    setActionError(null);
    setActionSuccess(null);
    setIsRegistering(true);

    const res = await registerMemberForCompetition(id);
    setIsRegistering(false);

    if (res.error) {
      setActionError(res.error);
      return;
    }

    setActionSuccess('You are officially registered for this competition.');
    await loadDetail();
  };

  if (isLoading) {
    return (
      <PageContainer className="py-16">
        <div className="h-64 animate-pulse border hairline-border bg-brand-charcoal/50" />
      </PageContainer>
    );
  }

  if (!item) {
    return (
      <PageContainer className="py-16">
        <EmptyState
          icon={<Trophy className="h-4 w-4" aria-hidden="true" />}
          eyebrow="Competition Not Found"
          title="This Competition Could Not Be Loaded"
          description={
            error ??
            'The competition may not exist or has not been published for members yet.'
          }
          action={
            <Button to={ROUTES.dashboardCompetitions} variant="secondary" size="sm">
              Back to Competitions
            </Button>
          }
        />
      </PageContainer>
    );
  }

  const { competition, registeredCount, myRegistration } = item;
  const now = Date.now();
  const regStartsAt = competition.registration_start
    ? new Date(competition.registration_start).getTime()
    : null;
  const regEndsAt = competition.registration_end
    ? new Date(competition.registration_end).getTime()
    : null;

  const isWithinWindow =
    (regStartsAt === null || now >= regStartsAt) &&
    (regEndsAt === null || now <= regEndsAt);

  const isAtCapacity =
    competition.participant_limit !== null &&
    registeredCount >= competition.participant_limit;

  const canRegister =
    !myRegistration &&
    competition.status === 'registration_open' &&
    isWithinWindow &&
    !isAtCapacity;

  return (
    <div className="bg-brand-black">
      <section className="relative overflow-hidden border-b hairline-border bg-brand-obsidian">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 ambient-gold-glow"
        />
        <PageContainer className="relative py-12 sm:py-16">
          <Link
            to={ROUTES.dashboardCompetitions}
            className="inline-flex items-center gap-2 font-body text-xs tracking-[0.18em] text-brand-muted uppercase transition-colors hover:text-brand-gold"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            All Competitions
          </Link>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <span className="font-body text-xs tracking-[0.22em] text-brand-gold uppercase">
              {competition.competition_type}
            </span>
            <CompetitionStatusBadge status={competition.status} />
            {myRegistration && (
              <RegistrationStatusBadge status={myRegistration.status} />
            )}
          </div>

          <h1 className="heading-display mt-4 text-4xl text-brand-white sm:text-6xl">
            {competition.title}
          </h1>
          <p className="body-lead mt-4 max-w-3xl">{competition.description}</p>
        </PageContainer>
      </section>

      <PageContainer className="py-12 sm:py-16">
        <div className="grid gap-10 lg:grid-cols-12">
          {/* Left: Details, Rules & Published Results */}
          <div className="space-y-10 lg:col-span-8">
            <section className="border hairline-border bg-brand-charcoal/60 p-6 sm:p-8">
              <p className="heading-eyebrow">Schedule &amp; Capacity</p>
              <dl className="mt-5 grid gap-5 sm:grid-cols-2">
                <div className="border hairline-border bg-brand-black/60 p-4">
                  <dt className="flex items-center gap-2 text-[0.68rem] tracking-[0.2em] text-brand-muted uppercase">
                    <Calendar className="h-3.5 w-3.5 text-brand-gold" aria-hidden="true" />
                    Registration Window
                  </dt>
                  <dd className="mt-2 font-body text-xs leading-relaxed text-brand-cream">
                    Opens: {formatDateTime(competition.registration_start)}
                    <br />
                    Closes: {formatDateTime(competition.registration_end)}
                  </dd>
                </div>

                <div className="border hairline-border bg-brand-black/60 p-4">
                  <dt className="flex items-center gap-2 text-[0.68rem] tracking-[0.2em] text-brand-muted uppercase">
                    <Calendar className="h-3.5 w-3.5 text-brand-gold" aria-hidden="true" />
                    Competition Dates
                  </dt>
                  <dd className="mt-2 font-body text-xs leading-relaxed text-brand-cream">
                    Starts: {formatDateTime(competition.competition_start)}
                    <br />
                    Ends: {formatDateTime(competition.competition_end)}
                  </dd>
                </div>
              </dl>
            </section>

            <section className="border hairline-border bg-brand-charcoal/60 p-6 sm:p-8">
              <p className="heading-eyebrow">Regulations</p>
              <h2 className="heading-section mt-2 text-2xl text-brand-white">
                Rules &amp; Scoring Format
              </h2>
              <p className="mt-4 whitespace-pre-line font-body text-sm leading-relaxed text-brand-muted">
                {competition.rules ??
                  'Standard VATAR fair-play guidelines apply. Competition-specific scoring rules will be published by administration.'}
              </p>
            </section>

            {/* Published Results */}
            <section>
              <p className="heading-eyebrow">Verified Standings</p>
              <h2 className="heading-section mt-2 text-2xl text-brand-white">
                Competition Results
              </h2>

              <div className="mt-5">
                {publishedResults.length === 0 ? (
                  <EmptyState
                    icon={<Trophy className="h-4 w-4" aria-hidden="true" />}
                    eyebrow="Results Pending"
                    title="No Published Results Yet"
                    description="Official placements and points will appear here once administrators verify and publish final competition results."
                    compact
                  />
                ) : (
                  <div className="overflow-x-auto border hairline-border bg-brand-charcoal/50">
                    <table className="w-full border-collapse text-left">
                      <thead>
                        <tr className="border-b hairline-border bg-brand-obsidian font-heading text-xs tracking-[0.2em] text-brand-muted uppercase">
                          <th scope="col" className="px-5 py-3.5">Place</th>
                          <th scope="col" className="px-5 py-3.5">Competitor</th>
                          <th scope="col" className="px-5 py-3.5 text-right">Points</th>
                          <th scope="col" className="px-5 py-3.5">Note</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-brand-cream/10">
                        {publishedResults.map((row) => (
                          <tr key={row.result_id}>
                            <td className="px-5 py-3.5 font-heading text-sm text-brand-gold">
                              #{row.placement}
                            </td>
                            <td className="px-5 py-3.5 font-heading text-sm tracking-[0.06em] text-brand-white uppercase">
                              @{row.username}
                            </td>
                            <td className="px-5 py-3.5 text-right font-heading text-sm text-brand-cream">
                              {row.points_awarded.toLocaleString()}
                            </td>
                            <td className="px-5 py-3.5 font-body text-xs text-brand-muted">
                              {row.result_note ?? '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* Right: Registration Action Card */}
          <aside className="lg:col-span-4">
            <div className="sticky top-28 border border-brand-gold/35 bg-brand-charcoal/80 p-6 sm:p-7">
              <p className="heading-eyebrow">Participation</p>
              <h2 className="heading-section mt-2 text-2xl text-brand-white">
                Registration
              </h2>

              <div className="mt-5 flex items-center justify-between border-t border-b hairline-border py-4">
                <span className="inline-flex items-center gap-2 font-body text-xs text-brand-muted">
                  <Users className="h-4 w-4 text-brand-gold" aria-hidden="true" />
                  Participants
                </span>
                <span className="font-heading text-lg text-brand-cream">
                  {registeredCount}
                  {competition.participant_limit
                    ? ` / ${competition.participant_limit}`
                    : ''}
                </span>
              </div>

              {actionSuccess && (
                <div
                  role="status"
                  className="mt-5 flex items-start gap-2.5 border border-brand-gold/50 bg-brand-black p-3.5 text-xs text-brand-cream"
                >
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-gold" aria-hidden="true" />
                  <p>{actionSuccess}</p>
                </div>
              )}

              {actionError && (
                <div
                  role="alert"
                  className="mt-5 flex items-start gap-2.5 border border-red-400/40 bg-red-950/30 p-3.5 text-xs text-red-200"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" aria-hidden="true" />
                  <p>{actionError}</p>
                </div>
              )}

              <div className="mt-6">
                {myRegistration ? (
                  <div className="space-y-3 border hairline-border bg-brand-black/70 p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-body text-xs text-brand-muted">
                        Your Status
                      </span>
                      <RegistrationStatusBadge status={myRegistration.status} />
                    </div>
                    <p className="font-body text-xs text-brand-muted">
                      Registered on {formatDateTime(myRegistration.registered_at)}
                    </p>
                    {myRegistration.status_reason && (
                      <p className="border-l border-brand-gold/40 pl-3 font-body text-xs text-brand-cream/85">
                        Note: {myRegistration.status_reason}
                      </p>
                    )}
                  </div>
                ) : canRegister ? (
                  <Button
                    variant="primary"
                    size="lg"
                    className="w-full"
                    disabled={isRegistering}
                    onClick={handleRegister}
                  >
                    {isRegistering ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        Registering...
                      </>
                    ) : (
                      'Register For Competition'
                    )}
                  </Button>
                ) : (
                  <p className="border hairline-border bg-brand-black/60 p-4 font-body text-xs leading-relaxed text-brand-muted">
                    {isAtCapacity
                      ? 'This competition has reached its participant limit.'
                      : competition.status !== 'registration_open'
                        ? `Registration is currently unavailable (status: ${competition.status.replace('_', ' ')}).`
                        : 'Registration is outside the active entry window.'}
                  </p>
                )}
              </div>
            </div>
          </aside>
        </div>
      </PageContainer>
    </div>
  );
}
