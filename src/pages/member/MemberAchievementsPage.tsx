import { useEffect, useState } from 'react';
import { AlertCircle, Award, CheckCircle2, Lock, Trophy } from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { EmptyState } from '@/components/shared/EmptyState';
import { SectionHeading } from '@/components/shared/SectionHeading';
import { Button } from '@/components/ui/Button';
import { deriveAchievementsFromResults } from '@/features/achievements/utils/deriveAchievements';
import { fetchMemberPublishedResults } from '@/features/competitions/services/competitionService';
import { useAuth } from '@/features/auth/hooks/useAuth';
import type { CompetitionResultRecord } from '@/lib/supabase/database.types';
import { ROUTES } from '@/routes/paths';

export function MemberAchievementsPage() {
  const { user } = useAuth();
  const [results, setResults] = useState<
    Array<{ result: CompetitionResultRecord; competitionTitle: string }>
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let active = true;
    void fetchMemberPublishedResults(user.id).then((res) => {
      if (!active) return;
      if (res.error) setError(res.error);
      else setResults(res.results);
      setIsLoading(false);
    });
    return () => {
      active = false;
    };
  }, [user]);

  const achievements = deriveAchievementsFromResults(results.map((r) => r.result));
  const earnedCount = achievements.filter((a) => a.earned).length;

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
            <p className="heading-eyebrow">Verified Honors</p>
          </div>
          <h1 className="heading-display mt-4 text-4xl text-brand-white sm:text-5xl">
            Achievements
          </h1>
          <p className="mt-3 max-w-2xl font-body text-sm leading-relaxed text-brand-muted">
            Achievements are derived strictly from your published VATAR competition
            results ({earnedCount} of {achievements.length} unlocked).
          </p>
        </PageContainer>
      </section>

      <PageContainer className="py-12 sm:py-16">
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
          <div className="grid gap-5 sm:grid-cols-2">
            {[1, 2, 3, 4].map((slot) => (
              <div
                key={slot}
                className="h-40 animate-pulse border hairline-border bg-brand-charcoal/45"
              />
            ))}
          </div>
        ) : (
          <>
            <div className="grid gap-5 sm:grid-cols-2">
              {achievements.map((item) => (
                <article
                  key={item.id}
                  className={
                    item.earned
                      ? 'border border-brand-gold/50 bg-brand-charcoal/80 p-6'
                      : 'border hairline-border bg-brand-charcoal/40 p-6 opacity-80'
                  }
                >
                  <div className="flex items-center justify-between gap-3">
                    <span
                      className={
                        item.earned
                          ? 'flex h-10 w-10 items-center justify-center border border-brand-gold bg-brand-gold/15 text-brand-gold'
                          : 'flex h-10 w-10 items-center justify-center border hairline-border bg-brand-black text-brand-muted'
                      }
                    >
                      {item.earned ? (
                        <Award className="h-5 w-5" aria-hidden="true" />
                      ) : (
                        <Lock className="h-4 w-4" aria-hidden="true" />
                      )}
                    </span>

                    <span
                      className={
                        item.earned
                          ? 'inline-flex items-center gap-1.5 font-heading text-xs tracking-[0.18em] text-brand-gold uppercase'
                          : 'font-body text-xs text-brand-muted'
                      }
                    >
                      {item.earned && (
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      {item.progressLabel}
                    </span>
                  </div>

                  <h2 className="heading-section mt-5 text-xl text-brand-white">
                    {item.title}
                  </h2>
                  <p className="mt-2 font-body text-xs leading-relaxed text-brand-muted">
                    {item.description}
                  </p>
                </article>
              ))}
            </div>

            <section className="mt-14">
              <SectionHeading
                index="01"
                eyebrow="Source Of Truth"
                title="Your Published Competition Results"
              />

              <div className="mt-6">
                {results.length === 0 ? (
                  <EmptyState
                    icon={<Trophy className="h-4 w-4" aria-hidden="true" />}
                    eyebrow="No Results Recorded"
                    title="Complete Your First Competition To Unlock Honors"
                    description="As soon as your placement is verified and published in an official VATAR competition, your results and unlocked achievements will appear here."
                    action={
                      <Button to={ROUTES.dashboardCompetitions} variant="primary" size="sm">
                        Browse Competitions
                      </Button>
                    }
                    compact
                  />
                ) : (
                  <div className="divide-y divide-brand-cream/10 border hairline-border bg-brand-charcoal/50">
                    {results.map(({ result, competitionTitle }) => (
                      <div
                        key={result.id}
                        className="flex flex-wrap items-center justify-between gap-4 p-5"
                      >
                        <div>
                          <p className="font-heading text-base tracking-[0.06em] text-brand-white uppercase">
                            {competitionTitle}
                          </p>
                          {result.result_note && (
                            <p className="mt-1 font-body text-xs text-brand-muted">
                              {result.result_note}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="font-heading text-base text-brand-gold">
                            #{result.placement} &bull; {result.points_awarded} pts
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </PageContainer>
    </div>
  );
}
