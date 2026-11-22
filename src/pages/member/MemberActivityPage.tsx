import { Activity, ArrowUpRight, Bell, Store, Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageContainer } from '@/components/layout/PageContainer';
import { EmptyState } from '@/components/shared/EmptyState';
import { SectionHeading } from '@/components/shared/SectionHeading';
import { Button } from '@/components/ui/Button';
import { ROUTES } from '@/routes/paths';

export function MemberActivityPage() {
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
            <p className="heading-eyebrow">Community Feed</p>
          </div>
          <h1 className="heading-display mt-4 text-4xl text-brand-white sm:text-5xl">
            Community Activity
          </h1>
          <p className="mt-3 max-w-2xl font-body text-sm leading-relaxed text-brand-muted">
            Official VATAR announcements, competition updates, and member-visible
            community dispatches will gather here as live modules come online.
          </p>
        </PageContainer>
      </section>

      <PageContainer className="py-12 sm:py-16">
        <div className="space-y-14">
          <section>
            <SectionHeading
              index="01"
              eyebrow="Official Dispatches"
              title="Community Announcements"
              description="Direct updates published by VATAR LIFESTYLE BY SOFT leadership."
            />

            <div className="mt-6">
              <EmptyState
                icon={<Bell className="h-4 w-4" aria-hidden="true" />}
                eyebrow="Awaiting Announcements Module"
                title="No Announcements Published Yet"
                description="Official community announcements will appear here once the announcements database table and publishing pipeline are introduced in an upcoming milestone."
                action={
                  <Button to={ROUTES.contact} variant="secondary" size="sm">
                    Community Channels
                  </Button>
                }
              />
            </div>
          </section>

          <section>
            <SectionHeading
              index="02"
              eyebrow="Member Pulse"
              title="Recent Community Highlights"
              description="Competition milestones, leaderboard updates, and approved marketplace highlights."
            />

            <div className="mt-6">
              <EmptyState
                icon={<Activity className="h-4 w-4" aria-hidden="true" />}
                eyebrow="No Activity Yet"
                title="Your Community Feed Is Ready"
                description="We do not display fabricated activity or placeholder stats. Verified updates will populate here as competitions, leaderboard seasons, and marketplace listings launch."
                compact
              />
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <Link
                to={ROUTES.competitions}
                className="group flex items-center justify-between border hairline-border bg-brand-charcoal/55 p-5 transition-colors hover:border-brand-gold/45"
              >
                <div className="flex items-center gap-3">
                  <Trophy className="h-4 w-4 text-brand-gold" aria-hidden="true" />
                  <span className="font-heading text-xs tracking-[0.18em] text-brand-cream uppercase">
                    Competitions
                  </span>
                </div>
                <ArrowUpRight
                  className="h-4 w-4 text-brand-muted transition-colors group-hover:text-brand-gold"
                  aria-hidden="true"
                />
              </Link>

              <Link
                to={ROUTES.leaderboard}
                className="group flex items-center justify-between border hairline-border bg-brand-charcoal/55 p-5 transition-colors hover:border-brand-gold/45"
              >
                <div className="flex items-center gap-3">
                  <Activity className="h-4 w-4 text-brand-gold" aria-hidden="true" />
                  <span className="font-heading text-xs tracking-[0.18em] text-brand-cream uppercase">
                    Leaderboard
                  </span>
                </div>
                <ArrowUpRight
                  className="h-4 w-4 text-brand-muted transition-colors group-hover:text-brand-gold"
                  aria-hidden="true"
                />
              </Link>

              <Link
                to={ROUTES.marketplace}
                className="group flex items-center justify-between border hairline-border bg-brand-charcoal/55 p-5 transition-colors hover:border-brand-gold/45"
              >
                <div className="flex items-center gap-3">
                  <Store className="h-4 w-4 text-brand-gold" aria-hidden="true" />
                  <span className="font-heading text-xs tracking-[0.18em] text-brand-cream uppercase">
                    Marketplace
                  </span>
                </div>
                <ArrowUpRight
                  className="h-4 w-4 text-brand-muted transition-colors group-hover:text-brand-gold"
                  aria-hidden="true"
                />
              </Link>
            </div>
          </section>
        </div>
      </PageContainer>
    </div>
  );
}
