import { useState } from 'react';
import { Award, Crown, Medal } from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { CategoryFilter } from '@/components/shared/CategoryFilter';
import { CTASection } from '@/components/shared/CTASection';
import { LeaderboardTable } from '@/components/shared/LeaderboardTable';
import { PublicPageHeader } from '@/components/shared/PublicPageHeader';
import { SectionHeading } from '@/components/shared/SectionHeading';
import { ROUTES } from '@/routes/paths';
import type { LeaderboardEntry } from '@/types/content';

const PERIOD_OPTIONS = ['All Time', 'Current Season', 'Monthly'] as const;
type PeriodLabel = (typeof PERIOD_OPTIONS)[number];

const PERIOD_DESCRIPTIONS: Record<PeriodLabel, string> = {
  'All Time': 'Cumulative verified points and honors across all VATAR competitions.',
  'Current Season': 'Official standings for the active competitive season.',
  Monthly: 'Top verified performances recorded within the current calendar month.',
};

const PODIUM_RECOGNITION = [
  {
    rank: '1st Place',
    title: 'Gold Standard',
    description:
      'Reserved for the top verified competitor in each period, recognized with premier leaderboard distinction.',
    icon: Crown,
    accentClass: 'border-brand-gold/50 text-brand-gold',
  },
  {
    rank: '2nd Place',
    title: 'Second Contender',
    description:
      'Honors sustained excellence and podium consistency across official competitive fixtures.',
    icon: Medal,
    accentClass: 'border-brand-cream/35 text-brand-cream',
  },
  {
    rank: '3rd Place',
    title: 'Third Contender',
    description:
      'Recognizes top-three placement and verified competitive discipline within the community.',
    icon: Award,
    accentClass: 'border-brand-gold-deep/60 text-brand-gold-hover',
  },
] as const;

const LEADERBOARD_ENTRIES: readonly LeaderboardEntry[] = [];

export function LeaderboardPage() {
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodLabel>('All Time');

  return (
    <>
      <PublicPageHeader
        eyebrow="Standings & Merit"
        title="Leaderboard"
        description="Official community rankings powered by verified competition results, earned points, and recognized achievements."
        metaLabel="Selected View"
        metaValue={selectedPeriod}
      />

      {/* Leading Positions Recognition */}
      <section className="section-padding border-b hairline-border bg-brand-black">
        <PageContainer>
          <SectionHeading
            index="01"
            eyebrow="Top Honors"
            title="Recognition For Leading Positions"
            description="Every top-three placement represents verified performance earned through official VATAR competitions."
          />

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {PODIUM_RECOGNITION.map(({ rank, title, description, icon: Icon, accentClass }) => (
              <article
                key={rank}
                className="border hairline-border bg-brand-charcoal/65 p-7"
              >
                <div className="flex items-center justify-between gap-3">
                  <span
                    className={`inline-flex h-10 w-10 items-center justify-center border bg-brand-black ${accentClass}`}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="font-heading text-xs tracking-[0.22em] text-brand-gold uppercase">
                    {rank}
                  </span>
                </div>
                <h3 className="heading-section mt-5 text-2xl text-brand-white">
                  {title}
                </h3>
                <p className="mt-2.5 font-body text-sm leading-relaxed text-brand-muted">
                  {description}
                </p>
              </article>
            ))}
          </div>
        </PageContainer>
      </section>

      {/* Standings Table */}
      <section className="section-padding bg-brand-obsidian">
        <PageContainer>
          <div className="flex flex-col justify-between gap-6 border-b hairline-border pb-6 lg:flex-row lg:items-end">
            <div>
              <p className="heading-eyebrow">02 — Official Rankings</p>
              <h2 className="heading-section mt-3 text-3xl text-brand-white sm:text-4xl">
                {selectedPeriod} Standings
              </h2>
              <p className="mt-2 font-body text-sm text-brand-muted">
                {PERIOD_DESCRIPTIONS[selectedPeriod]}
              </p>
            </div>

            <CategoryFilter
              categories={PERIOD_OPTIONS}
              selected={selectedPeriod}
              onSelect={setSelectedPeriod}
              ariaLabel="Select ranking period"
            />
          </div>

          <div className="mt-10">
            <LeaderboardTable
              entries={LEADERBOARD_ENTRIES}
              emptyTitle={`No Verified ${selectedPeriod} Rankings Yet`}
              emptyDescription="Leaderboard entries are never fabricated. Official positions, usernames, points, and achievements will appear automatically once live competition data is connected."
            />
          </div>
        </PageContainer>
      </section>

      <CTASection
        eyebrow="Earn Your Rank"
        title="Compete For Your Place On The Board"
        description="Join VATAR LIFESTYLE BY SOFT to participate in upcoming competitions and build your verified record."
        primaryLabel="Register Now"
        primaryTo={ROUTES.register}
        secondaryLabel="View Competitions"
        secondaryTo={ROUTES.competitions}
      />
    </>
  );
}
