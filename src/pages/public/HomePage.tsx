import { motion } from 'framer-motion';
import {
  ArrowRight,
  ArrowUpRight,
  Bell,
  Compass,
  Crown,
  ShieldCheck,
  Store,
  Trophy,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import heroEditorialImg from '@/assets/hero-editorial.webp';
import lifestyleAmbienceImg from '@/assets/lifestyle-ambience.webp';
import { PageContainer } from '@/components/layout/PageContainer';
import { CTASection } from '@/components/shared/CTASection';
import { EmptyState } from '@/components/shared/EmptyState';
import { LeaderboardTable } from '@/components/shared/LeaderboardTable';
import { SectionHeading } from '@/components/shared/SectionHeading';
import { Button } from '@/components/ui/Button';
import { ROUTES } from '@/routes/paths';
import type { LeaderboardEntry } from '@/types/content';

interface PillarItem {
  index: string;
  label: string;
  headline: string;
  description: string;
  to: string;
  actionLabel: string;
}

const PILLARS: readonly PillarItem[] = [
  {
    index: '01',
    label: 'A Lifestyle',
    headline: 'Elevated Presence On And Off The Screen',
    description:
      'VATAR LIFESTYLE BY SOFT treats gaming culture with the discipline and taste of a luxury house — defined by composure, identity, and deliberate craft.',
    to: ROUTES.about,
    actionLabel: 'Read The Philosophy',
  },
  {
    index: '02',
    label: 'A Community',
    headline: 'Connected By Standard, Not Noise',
    description:
      'A curated circle where members compete, trade through a moderated marketplace, and build real relationships rooted in mutual respect.',
    to: ROUTES.membership,
    actionLabel: 'Explore Membership',
  },
  {
    index: '03',
    label: 'A Legacy',
    headline: 'Built To Outlast A Single Season',
    description:
      'Every competition entered, milestone earned, and standard upheld contributes to a lasting record that carries the VATAR name forward.',
    to: ROUTES.leaderboard,
    actionLabel: 'View Standings',
  },
];

const MARKETPLACE_CATEGORIES = [
  'Lagos Life Game Funds',
  'Digital Goods',
  'Digital Services',
  'Community Products & Services',
] as const;

const PREVIEW_LEADERBOARD: readonly LeaderboardEntry[] = [];

export function HomePage() {
  return (
    <>
      {/* 1. Cinematic Editorial Hero */}
      <section className="relative flex min-h-[88vh] items-end overflow-hidden border-b hairline-border bg-brand-black">
        <img
          src={heroEditorialImg}
          alt="Dark obsidian and brushed gold architectural backdrop for VATAR LIFESTYLE BY SOFT"
          width={1376}
          height={768}
          loading="eager"
          fetchPriority="high"
          decoding="async"
          className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center opacity-75"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-brand-black via-brand-black/82 to-brand-black/25"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-brand-black via-transparent to-brand-black/50"
        />

        <PageContainer className="relative z-10 pt-28 pb-14 sm:pt-36 sm:pb-20">
          <div className="max-w-4xl">
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="flex items-center gap-4"
            >
              <span aria-hidden="true" className="h-px w-10 bg-brand-gold" />
              <p className="heading-eyebrow">VATAR LIFESTYLE BY SOFT</p>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.08, ease: 'easeOut' }}
              className="heading-display mt-6 text-5xl text-brand-white sm:text-7xl lg:text-[5.5rem]"
            >
              More Than A Game.
              <span className="gold-text-gradient mt-2 block">
                A Lifestyle. A Community. A Legacy.
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.16, ease: 'easeOut' }}
              className="body-lead mt-8 max-w-xl text-base text-brand-cream/80 sm:text-lg"
            >
              An intentional home for competitive players, creators, and modern culture
              builders — uniting organized tournaments, verified recognition, and a
              moderated community exchange under one black-and-gold standard.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.24, ease: 'easeOut' }}
              className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center"
            >
              <Button to={ROUTES.register} variant="primary" size="lg">
                Join The Community
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button to={ROUTES.about} variant="secondary" size="lg">
                Explore Community
              </Button>
            </motion.div>
          </div>

          {/* Editorial bottom index rail */}
          <div className="mt-16 grid gap-6 border-t hairline-border pt-7 sm:grid-cols-3 lg:mt-24">
            <div className="flex items-baseline gap-3">
              <span className="font-heading text-xs tracking-[0.22em] text-brand-gold">
                01
              </span>
              <div>
                <p className="font-heading text-xs tracking-[0.2em] text-brand-cream uppercase">
                  Competitive Arena
                </p>
                <p className="mt-1 font-body text-xs text-brand-muted">
                  Structured tournaments and verified rankings
                </p>
              </div>
            </div>
            <div className="flex items-baseline gap-3">
              <span className="font-heading text-xs tracking-[0.22em] text-brand-gold">
                02
              </span>
              <div>
                <p className="font-heading text-xs tracking-[0.2em] text-brand-cream uppercase">
                  Community Exchange
                </p>
                <p className="mt-1 font-body text-xs text-brand-muted">
                  Moderated discovery for Lagos Life funds &amp; digital goods
                </p>
              </div>
            </div>
            <div className="flex items-baseline gap-3">
              <span className="font-heading text-xs tracking-[0.22em] text-brand-gold">
                03
              </span>
              <div>
                <p className="font-heading text-xs tracking-[0.2em] text-brand-cream uppercase">
                  Enduring Identity
                </p>
                <p className="mt-1 font-body text-xs text-brand-muted">
                  Built on respect, recognition, and shared legacy
                </p>
              </div>
            </div>
          </div>
        </PageContainer>
      </section>

      {/* 2. Community Identity — The Three Pillars */}
      <section className="section-padding border-b hairline-border bg-brand-black">
        <PageContainer>
          <SectionHeading
            index="01"
            eyebrow="Community Identity"
            title="Three Pillars Of The VATAR Standard"
            description="Everything we build is anchored by the three principles that define VATAR LIFESTYLE BY SOFT."
          />

          <div className="mt-14 grid items-start gap-12 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <div className="relative overflow-hidden border hairline-border bg-brand-charcoal">
                <img
                  src={lifestyleAmbienceImg}
                  alt="Moody charcoal and warm brass architectural lounge representing the VATAR lifestyle"
                  width={1200}
                  height={896}
                  loading="lazy"
                  decoding="async"
                  className="aspect-[4/3] w-full object-cover"
                />
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 bg-gradient-to-t from-brand-black/80 via-transparent to-transparent"
                />
                <div className="absolute right-0 bottom-0 left-0 p-6">
                  <p className="heading-eyebrow">The Ethos</p>
                  <p className="mt-2 font-heading text-xl tracking-[0.08em] text-brand-cream uppercase">
                    Culture With Discipline
                  </p>
                </div>
              </div>

              <p className="mt-6 font-body text-sm leading-relaxed text-brand-muted">
                We reject loud, disposable hype in favor of substance — a house where
                every member knows what the name stands for and carries it with pride.
              </p>
            </div>

            <div className="divide-y divide-brand-cream/12 border-t border-b hairline-border lg:col-span-7">
              {PILLARS.map((pillar) => (
                <article
                  key={pillar.index}
                  className="group grid gap-4 py-8 transition-colors sm:grid-cols-12 sm:gap-6"
                >
                  <div className="sm:col-span-3">
                    <span className="font-heading text-4xl font-semibold tracking-[0.06em] text-brand-gold/45 transition-colors group-hover:text-brand-gold sm:text-5xl">
                      {pillar.index}
                    </span>
                    <p className="mt-2 font-heading text-xs tracking-[0.22em] text-brand-gold uppercase">
                      {pillar.label}
                    </p>
                  </div>

                  <div className="sm:col-span-9">
                    <h3 className="heading-section text-2xl text-brand-white">
                      {pillar.headline}
                    </h3>
                    <p className="mt-3 font-body text-sm leading-relaxed text-brand-muted">
                      {pillar.description}
                    </p>
                    <Link
                      to={pillar.to}
                      className="mt-5 inline-flex items-center gap-2 font-heading text-xs tracking-[0.2em] text-brand-cream uppercase transition-colors hover:text-brand-gold"
                    >
                      {pillar.actionLabel}
                      <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </PageContainer>
      </section>

      {/* 3. Featured Competitions & Community Announcements */}
      <section className="section-padding border-b hairline-border bg-brand-obsidian">
        <PageContainer>
          <div className="grid gap-14 lg:grid-cols-12">
            {/* Featured Competitions */}
            <div className="lg:col-span-7">
              <SectionHeading
                index="02"
                eyebrow="Competitive Calendar"
                title="Featured Competitions"
                action={
                  <Link
                    to={ROUTES.competitions}
                    className="inline-flex items-center gap-1.5 font-heading text-xs tracking-[0.2em] text-brand-gold uppercase transition-colors hover:text-brand-cream"
                  >
                    All Competitions
                    <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                }
              />

              <div className="mt-8">
                <EmptyState
                  icon={<Trophy className="h-4 w-4" aria-hidden="true" />}
                  eyebrow="Schedule Pending"
                  title="Official Competitions Will Be Announced Shortly"
                  description="Upcoming and active VATAR tournaments, formats, and registration windows will appear here as soon as the official competition calendar opens."
                  action={
                    <Button to={ROUTES.competitions} variant="secondary" size="sm">
                      Competition Hub
                    </Button>
                  }
                />
              </div>
            </div>

            {/* Community Announcements */}
            <div className="lg:col-span-5">
              <SectionHeading
                index="03"
                eyebrow="Dispatches"
                title="Announcements"
                action={
                  <Link
                    to={ROUTES.contact}
                    className="inline-flex items-center gap-1.5 font-heading text-xs tracking-[0.2em] text-brand-gold uppercase transition-colors hover:text-brand-cream"
                  >
                    Stay Connected
                    <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                }
              />

              <div className="mt-8">
                <EmptyState
                  icon={<Bell className="h-4 w-4" aria-hidden="true" />}
                  eyebrow="No Dispatches Yet"
                  title="Official Updates Publish Here"
                  description="Community bulletins, seasonal announcements, and house notices from VATAR leadership will be posted here once live publishing is connected."
                  compact
                />
              </div>
            </div>
          </div>
        </PageContainer>
      </section>

      {/* 4. Leaderboard Preview */}
      <section className="section-padding border-b hairline-border bg-brand-black">
        <PageContainer>
          <SectionHeading
            index="04"
            eyebrow="Recognition & Merit"
            title="Leaderboard Preview"
            description="Every point is earned through verified participation. Leading contenders receive permanent recognition across the community."
            action={
              <Button to={ROUTES.leaderboard} variant="secondary" size="sm">
                Full Leaderboard
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            }
          />

          <div className="mt-10">
            <LeaderboardTable
              entries={PREVIEW_LEADERBOARD}
              emptyTitle="Seasonal Standings Are Preparing To Launch"
              emptyDescription="No rankings are fabricated here. Verified member positions, points, and earned achievements will populate automatically when official competitions begin."
            />
          </div>
        </PageContainer>
      </section>

      {/* 5. Featured Marketplace Area */}
      <section className="section-padding border-b hairline-border bg-brand-obsidian">
        <PageContainer>
          <SectionHeading
            index="05"
            eyebrow="Community Exchange"
            title="VATAR Marketplace"
            description="A moderated discovery space for legitimate community buying and selling — arranged directly between buyers and sellers."
            action={
              <Button to={ROUTES.marketplace} variant="secondary" size="sm">
                Enter Marketplace
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            }
          />

          <div className="mt-10 grid gap-8 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <div className="border hairline-border bg-brand-charcoal/70 p-6 sm:p-7">
                <p className="heading-eyebrow">Supported Categories</p>
                <ul className="mt-5 divide-y divide-brand-cream/10">
                  {MARKETPLACE_CATEGORIES.map((category, idx) => (
                    <li
                      key={category}
                      className="flex items-center justify-between py-3.5 font-heading text-sm tracking-[0.12em] text-brand-cream uppercase"
                    >
                      <span>{category}</span>
                      <span className="font-body text-xs text-brand-gold">
                        0{idx + 1}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="mt-6 flex items-start gap-3 border-t hairline-border pt-5">
                  <ShieldCheck
                    className="mt-0.5 h-4 w-4 shrink-0 text-brand-gold"
                    aria-hidden="true"
                  />
                  <p className="font-body text-xs leading-relaxed text-brand-muted">
                    VATAR provides listing discovery and moderation. Never share
                    passwords, banking PINs, or OTPs with anyone.
                  </p>
                </div>
              </div>
            </div>

            <div className="lg:col-span-8">
              <EmptyState
                icon={<Store className="h-4 w-4" aria-hidden="true" />}
                eyebrow="Verified Listings Coming Soon"
                title="Marketplace Discovery Is Ready For Community Listings"
                description="Approved listings across Lagos Life game funds, digital goods, digital services, and community products will appear here once seller submissions go live."
                className="flex h-full items-center"
                action={
                  <Button to={ROUTES.marketplace} variant="primary" size="sm">
                    Browse Categories
                  </Button>
                }
              />
            </div>
          </div>
        </PageContainer>
      </section>

      {/* 6. Membership Invitation */}
      <section className="section-padding bg-brand-black">
        <PageContainer>
          <div className="relative overflow-hidden border border-brand-gold/30 bg-brand-charcoal p-8 sm:p-12 lg:p-16">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-brand-gold/10 blur-3xl"
            />
            <div className="relative grid items-center gap-10 lg:grid-cols-12">
              <div className="lg:col-span-8">
                <div className="flex items-center gap-3">
                  <Crown className="h-4 w-4 text-brand-gold" aria-hidden="true" />
                  <p className="heading-eyebrow">Membership Invitation</p>
                </div>
                <h2 className="heading-display mt-4 text-3xl text-brand-white sm:text-5xl">
                  Claim Your Place Inside VATAR LIFESTYLE BY SOFT
                </h2>
                <p className="body-lead mt-5 max-w-2xl">
                  Membership connects you directly to organized competitions, official
                  leaderboard progression, verified achievement recognition, and a
                  disciplined community that values legacy over hype.
                </p>
              </div>

              <div className="flex flex-col gap-3 lg:col-span-4 lg:items-end">
                <Button
                  to={ROUTES.membership}
                  variant="secondary"
                  size="lg"
                  className="w-full lg:w-auto"
                >
                  <Compass className="h-4 w-4" aria-hidden="true" />
                  Explore Membership
                </Button>
              </div>
            </div>
          </div>
        </PageContainer>
      </section>

      {/* 7. Final Registration CTA */}
      <CTASection
        eyebrow="Begin Your Legacy"
        title="Ready To Step Beyond The Game?"
        description="Join VATAR LIFESTYLE BY SOFT and be part of a community built for competition, craft, and permanence."
        primaryLabel="Join The Community"
        primaryTo={ROUTES.register}
        secondaryLabel="Contact Us"
        secondaryTo={ROUTES.contact}
      />
    </>
  );
}
