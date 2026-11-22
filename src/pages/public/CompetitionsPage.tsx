import { Calendar, CheckCircle2, Flame, History, ShieldAlert } from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { CTASection } from '@/components/shared/CTASection';
import { EmptyState } from '@/components/shared/EmptyState';
import { PublicPageHeader } from '@/components/shared/PublicPageHeader';
import { SectionHeading } from '@/components/shared/SectionHeading';
import { Button } from '@/components/ui/Button';
import { ROUTES } from '@/routes/paths';

const COMPETITION_STANDARDS = [
  {
    title: 'Verified Registration',
    description:
      'Participants must register through official VATAR channels within the published entry window before brackets or fixtures lock.',
  },
  {
    title: 'Fair Play & Integrity',
    description:
      'Exploits, unsportsmanlike conduct, account sharing, or manipulation of match outcomes result in immediate review and disqualification.',
  },
  {
    title: 'Official Scheduling',
    description:
      'Match schedules, check-in windows, and format rules are announced directly by VATAR administration ahead of each competition.',
  },
  {
    title: 'Verified Results',
    description:
      'Final standings and leaderboard points are awarded only after official match verification by competition moderators.',
  },
] as const;

export function CompetitionsPage() {
  return (
    <>
      <PublicPageHeader
        eyebrow="Competitive Arena"
        title="Competitions"
        description="Structured tournaments and community matchups built around discipline, fair play, and verified merit. Official schedules publish here as each event opens."
        metaLabel="Status"
        metaValue="Calendar Preparing"
        action={
          <Button to={ROUTES.register} variant="primary" size="md">
            Register To Compete
          </Button>
        }
      />

      {/* Active Competitions */}
      <section className="section-padding border-b hairline-border bg-brand-black">
        <PageContainer>
          <SectionHeading
            index="01"
            eyebrow="Live Now"
            title="Active Competitions"
            description="Competitions currently underway across the VATAR community."
          />

          <div className="mt-10">
            <EmptyState
              icon={<Flame className="h-4 w-4" aria-hidden="true" />}
              eyebrow="No Active Events"
              title="No Competitions Are Currently Live"
              description="When an official VATAR tournament or seasonal challenge is in progress, live brackets, format details, and status updates will appear here."
            />
          </div>
        </PageContainer>
      </section>

      {/* Upcoming Competitions */}
      <section className="section-padding border-b hairline-border bg-brand-obsidian">
        <PageContainer>
          <SectionHeading
            index="02"
            eyebrow="On The Horizon"
            title="Upcoming Competitions"
            description="Scheduled tournaments and open registration windows will be listed here prior to launch."
          />

          <div className="mt-10">
            <EmptyState
              icon={<Calendar className="h-4 w-4" aria-hidden="true" />}
              eyebrow="Schedule Pending"
              title="Upcoming Calendar Will Be Announced Soon"
              description="Official competition dates, rulesets, and entry instructions will be published here once confirmed by VATAR administration."
              action={
                <Button to={ROUTES.register} variant="secondary" size="sm">
                  Join For Updates
                </Button>
              }
            />
          </div>
        </PageContainer>
      </section>

      {/* Competition History */}
      <section className="section-padding border-b hairline-border bg-brand-black">
        <PageContainer>
          <SectionHeading
            index="03"
            eyebrow="Archive"
            title="Competition History"
            description="A permanent archive of completed VATAR competitions and verified outcomes."
          />

          <div className="mt-10">
            <EmptyState
              icon={<History className="h-4 w-4" aria-hidden="true" />}
              eyebrow="Archive Empty"
              title="Completed Events Will Be Preserved Here"
              description="As official competitions conclude, verified results and historical records will be archived here to honor every chapter of the VATAR legacy."
              compact
            />
          </div>
        </PageContainer>
      </section>

      {/* Rules & Participation Information */}
      <section className="section-padding bg-brand-obsidian">
        <PageContainer>
          <SectionHeading
            index="04"
            eyebrow="Standards"
            title="Rules & Participation Guidelines"
            description="Every competitor enters under the same clear expectations of conduct and verification."
          />

          <div className="mt-12 grid gap-6 md:grid-cols-2">
            {COMPETITION_STANDARDS.map((rule) => (
              <article
                key={rule.title}
                className="flex items-start gap-4 border hairline-border bg-brand-charcoal/65 p-7"
              >
                <CheckCircle2
                  className="mt-1 h-5 w-5 shrink-0 text-brand-gold"
                  aria-hidden="true"
                />
                <div>
                  <h3 className="heading-section text-xl text-brand-white">
                    {rule.title}
                  </h3>
                  <p className="mt-2 font-body text-sm leading-relaxed text-brand-muted">
                    {rule.description}
                  </p>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-8 flex items-start gap-3 border border-brand-gold/25 bg-brand-black/70 p-5">
            <ShieldAlert
              className="mt-0.5 h-4 w-4 shrink-0 text-brand-gold"
              aria-hidden="true"
            />
            <p className="font-body text-xs leading-relaxed text-brand-muted">
              Event-specific rulesets, eligibility details, and scoring formats will be
              published alongside each individual competition announcement.
            </p>
          </div>
        </PageContainer>
      </section>

      <CTASection
        eyebrow="Step Into The Arena"
        title="Prepare For The First Whistle"
        description="Register with VATAR LIFESTYLE BY SOFT so you are ready when official competition entries open."
        primaryLabel="Register Now"
        primaryTo={ROUTES.register}
        secondaryLabel="View Leaderboard"
        secondaryTo={ROUTES.leaderboard}
      />
    </>
  );
}
