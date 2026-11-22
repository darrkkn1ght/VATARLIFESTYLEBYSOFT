import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowUpRight,
  Calendar,
  RefreshCw,
  Trophy,
  Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageContainer } from '@/components/layout/PageContainer';
import { CategoryFilter } from '@/components/shared/CategoryFilter';
import { EmptyState } from '@/components/shared/EmptyState';
import { SearchInput } from '@/components/shared/SearchInput';
import { Button } from '@/components/ui/Button';
import {
  CompetitionStatusBadge,
  RegistrationStatusBadge,
} from '@/features/competitions/components/CompetitionStatusBadge';
import { fetchMemberCompetitions } from '@/features/competitions/services/competitionService';
import type { CompetitionWithMeta } from '@/features/competitions/types/competition.types';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { ROUTES } from '@/routes/paths';

const MEMBER_FILTERS = ['All', 'Open', 'Upcoming', 'In Progress', 'Completed'] as const;
type MemberFilter = (typeof MEMBER_FILTERS)[number];

function formatDate(iso: string | null): string {
  if (!iso) return 'TBA';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function MemberCompetitionsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<CompetitionWithMeta[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<MemberFilter>('All');

  const loadCompetitions = useCallback(
    async (fullLoad: boolean) => {
      if (!user) return;
      if (fullLoad) setIsLoading(true);
      else setIsRefreshing(true);
      setError(null);

      const res = await fetchMemberCompetitions(user.id);
      if (res.error) setError(res.error);
      else setItems(res.items);

      setIsLoading(false);
      setIsRefreshing(false);
    },
    [user],
  );

  useEffect(() => {
    void loadCompetitions(true);
  }, [loadCompetitions]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return items.filter(({ competition }) => {
      if (selectedFilter === 'Open' && competition.status !== 'registration_open')
        return false;
      if (
        selectedFilter === 'Upcoming' &&
        competition.status !== 'published' &&
        competition.status !== 'registration_open' &&
        competition.status !== 'registration_closed'
      )
        return false;
      if (selectedFilter === 'In Progress' && competition.status !== 'in_progress')
        return false;
      if (selectedFilter === 'Completed' && competition.status !== 'completed')
        return false;

      if (!q) return true;
      return (
        competition.title.toLowerCase().includes(q) ||
        competition.description.toLowerCase().includes(q) ||
        competition.competition_type.toLowerCase().includes(q)
      );
    });
  }, [items, searchQuery, selectedFilter]);

  return (
    <div className="bg-brand-black">
      <section className="relative overflow-hidden border-b hairline-border bg-brand-obsidian">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 ambient-gold-glow"
        />
        <PageContainer className="relative py-12 sm:py-16">
          <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
            <div>
              <div className="flex items-center gap-3">
                <span aria-hidden="true" className="h-px w-8 bg-brand-gold" />
                <p className="heading-eyebrow">Competitive Arena</p>
              </div>
              <h1 className="heading-display mt-4 text-4xl text-brand-white sm:text-5xl">
                Competitions
              </h1>
              <p className="mt-3 max-w-2xl font-body text-sm leading-relaxed text-brand-muted">
                Browse official VATAR tournaments, inspect schedules and rules, register
                during open windows, and review published results.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="subtle"
                size="sm"
                onClick={() => void loadCompetitions(false)}
                disabled={isLoading || isRefreshing}
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`}
                  aria-hidden="true"
                />
                Refresh
              </Button>
              <Button to={ROUTES.dashboardLeaderboard} variant="secondary" size="sm">
                Leaderboard
              </Button>
            </div>
          </div>
        </PageContainer>
      </section>

      <PageContainer className="py-10 sm:py-14">
        {error && (
          <div
            role="alert"
            className="mb-6 flex items-start gap-3 border border-red-400/40 bg-red-950/30 p-4 text-sm text-red-200"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" aria-hidden="true" />
            <p>{error}</p>
          </div>
        )}

        <div className="flex flex-col gap-4 border-b hairline-border pb-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="w-full lg:max-w-md">
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search competitions..."
              ariaLabel="Search competitions"
            />
          </div>
          <CategoryFilter
            categories={MEMBER_FILTERS}
            selected={selectedFilter}
            onSelect={setSelectedFilter}
            ariaLabel="Filter competitions"
          />
        </div>

        <div className="mt-8">
          {isLoading ? (
            <div className="grid gap-6 md:grid-cols-2">
              {[1, 2].map((slot) => (
                <div
                  key={slot}
                  className="h-56 animate-pulse border hairline-border bg-brand-charcoal/45"
                />
              ))}
            </div>
          ) : filteredItems.length === 0 ? (
            <EmptyState
              icon={<Trophy className="h-4 w-4" aria-hidden="true" />}
              eyebrow="Competition Calendar"
              title={
                searchQuery.trim()
                  ? `No competitions match "${searchQuery.trim()}"`
                  : 'No Published Competitions Available'
              }
              description="Official VATAR tournaments will appear here as soon as administrators publish upcoming events."
              action={
                searchQuery || selectedFilter !== 'All' ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedFilter('All');
                    }}
                  >
                    Reset Filters
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {filteredItems.map(({ competition, registeredCount, myRegistration }) => (
                <article
                  key={competition.id}
                  className="group flex flex-col justify-between border hairline-border bg-brand-charcoal/65 p-6 transition-colors hover:border-brand-gold/50 sm:p-7"
                >
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-body text-[0.68rem] tracking-[0.22em] text-brand-muted uppercase">
                        {competition.competition_type}
                      </span>
                      <div className="flex flex-wrap items-center gap-2">
                        <CompetitionStatusBadge status={competition.status} />
                        {myRegistration && (
                          <RegistrationStatusBadge status={myRegistration.status} />
                        )}
                      </div>
                    </div>

                    <h2 className="heading-section mt-4 text-2xl text-brand-white transition-colors group-hover:text-brand-cream">
                      {competition.title}
                    </h2>

                    <p className="mt-2.5 line-clamp-3 font-body text-sm leading-relaxed text-brand-muted">
                      {competition.description}
                    </p>
                  </div>

                  <div className="mt-6 border-t hairline-border pt-5">
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-brand-cream/85">
                      <span className="inline-flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-brand-gold" aria-hidden="true" />
                        Reg closes: {formatDate(competition.registration_end)}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5 text-brand-gold" aria-hidden="true" />
                        {registeredCount}
                        {competition.participant_limit
                          ? ` / ${competition.participant_limit}`
                          : ' registered'}
                      </span>
                    </div>

                    <Link
                      to={`/dashboard/competitions/${competition.id}`}
                      className="mt-5 inline-flex items-center gap-1.5 font-heading text-xs tracking-[0.2em] text-brand-gold uppercase transition-colors hover:text-brand-cream"
                    >
                      View Details &amp; Register
                      <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </PageContainer>
    </div>
  );
}
