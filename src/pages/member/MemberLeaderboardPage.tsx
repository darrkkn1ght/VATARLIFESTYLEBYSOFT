import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Crown, RefreshCw, Trophy } from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/Button';
import { fetchMemberCompetitions } from '@/features/competitions/services/competitionService';
import { fetchLeaderboardRankings } from '@/features/leaderboard/services/leaderboardService';
import { useAuth } from '@/features/auth/hooks/useAuth';
import type {
  CompetitionRecord,
  LeaderboardRankRow,
} from '@/lib/supabase/database.types';
import { cn } from '@/lib/utilities/cn';

function rankBadgeClass(rank: number): string {
  if (rank === 1) return 'border-brand-gold bg-brand-gold/15 text-brand-gold';
  if (rank === 2) return 'border-brand-cream/45 bg-brand-cream/10 text-brand-cream';
  if (rank === 3) return 'border-brand-gold-deep bg-brand-gold-deep/20 text-brand-gold-hover';
  return 'border-brand-cream/15 bg-brand-black text-brand-muted';
}

export function MemberLeaderboardPage() {
  const { user } = useAuth();
  const [rankings, setRankings] = useState<LeaderboardRankRow[]>([]);
  const [competitions, setCompetitions] = useState<CompetitionRecord[]>([]);
  const [selectedCompetitionId, setSelectedCompetitionId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(
    async (compId: string, fullLoad: boolean) => {
      if (fullLoad) setIsLoading(true);
      else setIsRefreshing(true);
      setError(null);

      const [rankRes, compsRes] = await Promise.all([
        fetchLeaderboardRankings(compId || null),
        user ? fetchMemberCompetitions(user.id) : Promise.resolve({ items: [], error: null }),
      ]);

      if (rankRes.error) setError(rankRes.error);
      else setRankings(rankRes.rankings);

      if (!compsRes.error) {
        setCompetitions(compsRes.items.map((i) => i.competition));
      }

      setIsLoading(false);
      setIsRefreshing(false);
    },
    [user],
  );

  useEffect(() => {
    void loadData(selectedCompetitionId, true);
  }, [selectedCompetitionId, loadData]);

  return (
    <div className="bg-brand-black">
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
                <p className="heading-eyebrow">Verified Standings</p>
              </div>
              <h1 className="heading-display mt-4 text-4xl text-brand-white sm:text-5xl">
                Community Leaderboard
              </h1>
              <p className="mt-3 max-w-2xl font-body text-sm leading-relaxed text-brand-muted">
                Aggregated directly from published VATAR competition results. Tie-breaks
                follow total points, wins, podiums, best finish, participations, then
                username.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <select
                aria-label="Filter leaderboard by competition"
                value={selectedCompetitionId}
                onChange={(e) => setSelectedCompetitionId(e.target.value)}
                className="border hairline-border bg-brand-charcoal px-3.5 py-2 font-body text-xs text-brand-cream focus:border-brand-gold focus:outline-none"
              >
                <option value="">All Published Competitions</option>
                {competitions.map((comp) => (
                  <option key={comp.id} value={comp.id}>
                    {comp.title}
                  </option>
                ))}
              </select>

              <Button
                variant="subtle"
                size="sm"
                onClick={() => void loadData(selectedCompetitionId, false)}
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
        {error && (
          <div
            role="alert"
            className="mb-6 flex items-start gap-3 border border-red-400/40 bg-red-950/30 p-4 text-sm text-red-200"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" aria-hidden="true" />
            <p>{error}</p>
          </div>
        )}

        {isLoading ? (
          <div className="h-64 animate-pulse border hairline-border bg-brand-charcoal/45" />
        ) : rankings.length === 0 ? (
          <EmptyState
            icon={<Trophy className="h-4 w-4" aria-hidden="true" />}
            eyebrow="No Published Standings"
            title="Leaderboard Awaiting Verified Results"
            description="Rankings are calculated exclusively from published competition results. No standings are fabricated."
          />
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden overflow-x-auto border hairline-border bg-brand-charcoal/45 md:block">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b hairline-border bg-brand-obsidian font-heading text-xs tracking-[0.2em] text-brand-muted uppercase">
                    <th scope="col" className="px-5 py-4">Rank</th>
                    <th scope="col" className="px-5 py-4">VATAR Username</th>
                    <th scope="col" className="px-5 py-4 text-right">Total Points</th>
                    <th scope="col" className="px-5 py-4 text-right">Competitions</th>
                    <th scope="col" className="px-5 py-4 text-right">Wins</th>
                    <th scope="col" className="px-5 py-4 text-right">Podiums</th>
                    <th scope="col" className="px-5 py-4 text-right">Best Finish</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-cream/10">
                  {rankings.map((row) => {
                    const isMe = user?.id === row.user_id;
                    return (
                      <tr
                        key={row.user_id}
                        className={cn(
                          'transition-colors hover:bg-brand-charcoal/80',
                          isMe && 'bg-brand-gold/5',
                        )}
                      >
                        <td className="px-5 py-4">
                          <span
                            className={cn(
                              'inline-flex h-8 w-8 items-center justify-center border font-heading text-xs font-semibold',
                              rankBadgeClass(row.rank_position),
                            )}
                          >
                            #{row.rank_position}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className="inline-flex items-center gap-2 font-heading text-base tracking-[0.06em] text-brand-white uppercase">
                            {row.rank_position === 1 && (
                              <Crown className="h-4 w-4 text-brand-gold" aria-hidden="true" />
                            )}
                            @{row.username}
                            {isMe && (
                              <span className="border border-brand-gold/40 px-1.5 py-0.5 font-body text-[0.6rem] text-brand-gold">
                                You
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right font-heading text-base text-brand-gold">
                          {row.total_points.toLocaleString()}
                        </td>
                        <td className="px-5 py-4 text-right font-body text-sm text-brand-cream">
                          {row.competitions_played}
                        </td>
                        <td className="px-5 py-4 text-right font-body text-sm text-brand-cream">
                          {row.wins}
                        </td>
                        <td className="px-5 py-4 text-right font-body text-sm text-brand-cream">
                          {row.podiums}
                        </td>
                        <td className="px-5 py-4 text-right font-body text-sm text-brand-muted">
                          #{row.best_placement}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="space-y-3 md:hidden">
              {rankings.map((row) => (
                <article
                  key={row.user_id}
                  className="flex items-center justify-between border hairline-border bg-brand-charcoal/60 p-4"
                >
                  <div className="flex items-center gap-3.5">
                    <span
                      className={cn(
                        'inline-flex h-9 w-9 shrink-0 items-center justify-center border font-heading text-xs font-semibold',
                        rankBadgeClass(row.rank_position),
                      )}
                    >
                      #{row.rank_position}
                    </span>
                    <div>
                      <p className="font-heading text-base text-brand-white uppercase">
                        @{row.username}
                      </p>
                      <p className="font-body text-xs text-brand-muted">
                        {row.competitions_played} played &bull; {row.wins} wins &bull; Best #{row.best_placement}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-heading text-lg text-brand-gold">
                      {row.total_points.toLocaleString()}
                    </p>
                    <p className="font-body text-[0.62rem] tracking-[0.16em] text-brand-muted uppercase">
                      PTS
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </PageContainer>
    </div>
  );
}
