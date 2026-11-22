import { Award, Shield, Trophy, Users } from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { CTASection } from '@/components/shared/CTASection';
import { PublicPageHeader } from '@/components/shared/PublicPageHeader';
import { SectionHeading } from '@/components/shared/SectionHeading';
import { Button } from '@/components/ui/Button';
import { ROUTES } from '@/routes/paths';

const MEMBERSHIP_BENEFITS = [
  {
    icon: Users,
    title: 'Community Participation',
    description:
      'Join official community discussions, announcements, and member-led initiatives guided by clear standards of respect and maturity.',
  },
  {
    icon: Trophy,
    title: 'Competition Access',
    description:
      'Receive eligibility to enter structured VATAR competitions, seasonal events, and curated matchups as the calendar opens.',
  },
  {
    icon: Award,
    title: 'Achievements & Recognition',
    description:
      'Build a verified member profile that records earned achievements, leaderboard standings, and competitive milestones over time.',
  },
  {
    icon: Shield,
    title: 'Moderated Ecosystem',
    description:
      'Engage within an organized platform supported by clear rules, community moderation, and transparent announcements.',
  },
] as const;

const PARTICIPATION_STEPS = [
  {
    step: '01',
    title: 'Register Your Profile',
    description:
      'Create your VATAR member account once authentication onboarding opens so your identity and activity stay unified across the platform.',
  },
  {
    step: '02',
    title: 'Engage With The Community',
    description:
      'Follow official announcements, join community channels, and uphold the standards that keep VATAR disciplined and welcoming.',
  },
  {
    step: '03',
    title: 'Compete & Build Your Record',
    description:
      'Participate in official competitions, climb verified leaderboards, and earn permanent recognition for your contributions.',
  },
] as const;

export function MembershipPage() {
  return (
    <>
      <PublicPageHeader
        eyebrow="Membership"
        title="Belong To A Higher Standard"
        description="Membership is your gateway into VATAR LIFESTYLE BY SOFT — connecting you to organized competitions, community participation, and verified recognition."
        metaLabel="Access"
        metaValue="Community Onboarding"
        action={
          <Button to={ROUTES.register} variant="primary" size="md">
            Register Now
          </Button>
        }
      />

      {/* Benefits of Joining */}
      <section className="section-padding border-b hairline-border bg-brand-black">
        <PageContainer>
          <SectionHeading
            index="01"
            eyebrow="What Membership Unlocks"
            title="Core Pillars Of Membership"
            description="Every member enters the same disciplined environment designed for participation, progression, and lasting belonging."
          />

          <div className="mt-12 grid gap-6 md:grid-cols-2">
            {MEMBERSHIP_BENEFITS.map(({ icon: Icon, title, description }) => (
              <article
                key={title}
                className="border hairline-border bg-brand-charcoal/60 p-8 transition-colors hover:border-brand-gold/45"
              >
                <span className="flex h-11 w-11 items-center justify-center border border-brand-gold/35 bg-brand-black text-brand-gold">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="heading-section mt-6 text-2xl text-brand-white">
                  {title}
                </h3>
                <p className="mt-3 font-body text-sm leading-relaxed text-brand-muted">
                  {description}
                </p>
              </article>
            ))}
          </div>
        </PageContainer>
      </section>

      {/* Community Participation & Competition Access */}
      <section className="section-padding border-b hairline-border bg-brand-obsidian">
        <PageContainer>
          <SectionHeading
            index="02"
            eyebrow="Participation"
            title="How Members Engage"
            description="A straightforward progression from joining the community to competing and building your legacy."
          />

          <div className="mt-12 grid gap-8 lg:grid-cols-3">
            {PARTICIPATION_STEPS.map((item) => (
              <article
                key={item.step}
                className="relative border-t border-brand-gold/40 pt-6"
              >
                <span className="font-heading text-3xl font-semibold text-brand-gold/60">
                  {item.step}
                </span>
                <h3 className="heading-section mt-3 text-2xl text-brand-white">
                  {item.title}
                </h3>
                <p className="mt-3 font-body text-sm leading-relaxed text-brand-muted">
                  {item.description}
                </p>
              </article>
            ))}
          </div>
        </PageContainer>
      </section>

      {/* Achievements & Recognition */}
      <section className="section-padding bg-brand-black">
        <PageContainer>
          <div className="grid items-center gap-10 border hairline-border bg-brand-charcoal/65 p-8 sm:p-12 lg:grid-cols-12">
            <div className="lg:col-span-8">
              <p className="heading-eyebrow">Achievements &amp; Recognition</p>
              <h2 className="heading-section mt-4 text-3xl text-brand-white sm:text-4xl">
                Merit That Stays On Your Record
              </h2>
              <p className="body-lead mt-4">
                Inside VATAR LIFESTYLE BY SOFT, recognition is earned through verified
                competition results and sustained community contribution. Member profiles
                and official leaderboards preserve those honors as part of your legacy.
              </p>
            </div>
            <div className="flex flex-col gap-3 lg:col-span-4 lg:items-end">
              <Button to={ROUTES.leaderboard} variant="secondary" size="md">
                View Leaderboard
              </Button>
              <Button to={ROUTES.competitions} variant="ghost" size="sm">
                Explore Competitions
              </Button>
            </div>
          </div>
        </PageContainer>
      </section>

      <CTASection
        eyebrow="Join VATAR"
        title="Step Into The Community"
        description="Register your interest today and prepare for full member onboarding, competitions, and recognition."
        primaryLabel="Register Now"
        primaryTo={ROUTES.register}
        secondaryLabel="Have Questions? Contact Us"
        secondaryTo={ROUTES.contact}
      />
    </>
  );
}
