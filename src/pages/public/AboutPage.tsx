import lifestyleAmbienceImg from '@/assets/lifestyle-ambience.webp';
import { PageContainer } from '@/components/layout/PageContainer';
import { CTASection } from '@/components/shared/CTASection';
import { PublicPageHeader } from '@/components/shared/PublicPageHeader';
import { SectionHeading } from '@/components/shared/SectionHeading';
import { Button } from '@/components/ui/Button';
import { ROUTES } from '@/routes/paths';

interface ValueItem {
  number: string;
  title: string;
  description: string;
}

const COMMUNITY_VALUES: readonly ValueItem[] = [
  {
    number: '01',
    title: 'Integrity',
    description:
      'Fair competition, honest trade, and clear accountability form the bedrock of trust across every interaction.',
  },
  {
    number: '02',
    title: 'Respect',
    description:
      'Every member — whether seasoned competitor or newcomer — is met with dignity, sportsmanship, and maturity.',
  },
  {
    number: '03',
    title: 'Ambition',
    description:
      'We encourage members to sharpen their skill, elevate their personal standards, and pursue excellence with composure.',
  },
  {
    number: '04',
    title: 'Longevity',
    description:
      'Decisions are made for lasting cultural impact rather than short-lived attention, preserving a legacy members are proud to represent.',
  },
];

export function AboutPage() {
  return (
    <>
      <PublicPageHeader
        eyebrow="About The Brand"
        title="More Than A Game. A Lifestyle. A Community. A Legacy."
        description="VATAR LIFESTYLE BY SOFT was created to elevate gaming culture into a cohesive lifestyle house — where competitive ambition, community belonging, and enduring standards meet."
        metaLabel="Identity"
        metaValue="VATAR LIFESTYLE BY SOFT"
        action={
          <Button to={ROUTES.membership} variant="secondary" size="sm">
            Explore Membership
          </Button>
        }
      />

      {/* Brand Introduction */}
      <section className="section-padding border-b hairline-border bg-brand-black">
        <PageContainer>
          <div className="grid items-center gap-12 lg:grid-cols-12">
            <div className="lg:col-span-6">
              <p className="heading-eyebrow">Brand Introduction</p>
              <h2 className="heading-section mt-4 text-3xl text-brand-white sm:text-4xl">
                A Modern House Built Around Culture And Craft
              </h2>
              <p className="body-lead mt-6">
                VATAR LIFESTYLE BY SOFT began with a simple conviction: the people who
                gather around competitive play deserve an environment that reflects
                ambition, order, and taste.
              </p>
              <p className="mt-4 font-body text-sm leading-relaxed text-brand-muted">
                Rather than treating gaming as a passing pastime, we frame it as a shared
                lifestyle — connecting members through organized competitions, earned
                recognition, transparent community exchange, and a recognizable visual
                identity.
              </p>
            </div>

            <div className="lg:col-span-6">
              <div className="relative overflow-hidden border hairline-border bg-brand-charcoal">
                <img
                  src={lifestyleAmbienceImg}
                  alt="Editorial dark stone and brushed brass architectural interior"
                  width={1200}
                  height={896}
                  loading="lazy"
                  decoding="async"
                  className="aspect-[4/3] w-full object-cover"
                />
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 bg-gradient-to-t from-brand-black/70 via-transparent to-transparent"
                />
              </div>
            </div>
          </div>
        </PageContainer>
      </section>

      {/* Mission & Vision */}
      <section className="section-padding border-b hairline-border bg-brand-obsidian">
        <PageContainer>
          <SectionHeading
            index="01"
            eyebrow="Direction"
            title="Mission & Vision"
          />

          <div className="mt-12 grid gap-8 md:grid-cols-2">
            <article className="border hairline-border bg-brand-charcoal/70 p-8 sm:p-10">
              <p className="heading-eyebrow">Our Mission</p>
              <h3 className="heading-section mt-4 text-2xl text-brand-cream sm:text-3xl">
                Unite Competition, Community, And Everyday Lifestyle
              </h3>
              <p className="mt-5 font-body text-sm leading-relaxed text-brand-muted sm:text-base">
                To build a disciplined, welcoming, and high-standard digital community
                where members participate in structured competitions, earn meaningful
                recognition, and engage in responsible community exchange under a unified
                lifestyle brand.
              </p>
            </article>

            <article className="border border-brand-gold/30 bg-brand-charcoal/70 p-8 sm:p-10">
              <p className="heading-eyebrow">Our Vision</p>
              <h3 className="heading-section mt-4 text-2xl text-brand-cream sm:text-3xl">
                Establish A Lasting Cultural Legacy
              </h3>
              <p className="mt-5 font-body text-sm leading-relaxed text-brand-muted sm:text-base">
                To stand as the defining black-and-gold standard for modern gaming and
                lifestyle communities — recognized for integrity, competitive excellence,
                and a legacy that endures across generations of members.
              </p>
            </article>
          </div>
        </PageContainer>
      </section>

      {/* Community Values */}
      <section className="section-padding border-b hairline-border bg-brand-black">
        <PageContainer>
          <SectionHeading
            index="02"
            eyebrow="Principles"
            title="Community Values"
            description="The shared expectations that guide how we compete, communicate, and represent VATAR LIFESTYLE BY SOFT."
          />

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {COMMUNITY_VALUES.map((value) => (
              <article
                key={value.number}
                className="border hairline-border bg-brand-charcoal/55 p-7 transition-colors hover:border-brand-gold/45"
              >
                <span className="font-heading text-xs tracking-[0.24em] text-brand-gold">
                  {value.number}
                </span>
                <h3 className="heading-section mt-4 text-2xl text-brand-white">
                  {value.title}
                </h3>
                <p className="mt-3 font-body text-sm leading-relaxed text-brand-muted">
                  {value.description}
                </p>
              </article>
            ))}
          </div>
        </PageContainer>
      </section>

      {/* Brand Philosophy */}
      <section className="section-padding bg-brand-obsidian">
        <PageContainer>
          <div className="mx-auto max-w-4xl border-l-2 border-brand-gold pl-6 sm:pl-10">
            <p className="heading-eyebrow">Brand Philosophy</p>
            <blockquote className="heading-display mt-4 text-3xl text-brand-cream sm:text-5xl">
              “Excellence is never accidental. It is a habit practiced in play, carried
              into community, and remembered as legacy.”
            </blockquote>
            <p className="mt-6 max-w-2xl font-body text-sm leading-relaxed text-brand-muted sm:text-base">
              Every touchpoint of VATAR LIFESTYLE BY SOFT — from the restraint of our
              black-and-gold palette to the fairness of our competitive spaces — is
              designed to remind members that how you show up matters just as much as the
              result.
            </p>
          </div>
        </PageContainer>
      </section>

      <CTASection
        eyebrow="Membership"
        title="Become Part Of The VATAR Story"
        description="Explore what membership unlocks or register your interest to step into the community."
        primaryLabel="Register Now"
        primaryTo={ROUTES.register}
        secondaryLabel="View Membership"
        secondaryTo={ROUTES.membership}
      />
    </>
  );
}
