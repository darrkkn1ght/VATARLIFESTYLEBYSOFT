import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { PageContainer } from '@/components/layout/PageContainer';
import { SectionHeader } from '@/components/shared/SectionHeader';
import { ROUTES } from '@/routes/paths';

interface BrandPillar {
  index: string;
  title: string;
  description: string;
  to: string;
  ctaLabel: string;
}

const BRAND_PILLARS: readonly BrandPillar[] = [
  {
    index: '01',
    title: 'A Lifestyle',
    description:
      'Rooted in discipline, craft, and presence. VATAR LIFESTYLE BY SOFT brings together an elevated standard on and off the field.',
    to: ROUTES.membership,
    ctaLabel: 'Explore Membership',
  },
  {
    index: '02',
    title: 'A Community',
    description:
      'A curated circle connected through shared ambition, organized competitions, and enduring respect for the culture.',
    to: ROUTES.competitions,
    ctaLabel: 'View Competitions',
  },
  {
    index: '03',
    title: 'A Legacy',
    description:
      'Built for longevity rather than passing trends — honoring standards, continuity, and the people who carry the name forward.',
    to: ROUTES.about,
    ctaLabel: 'Read Our Story',
  },
];

export function HomePage() {
  return (
    <>
      <section className="relative overflow-hidden border-b hairline-border bg-brand-black">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_75%_25%,rgba(198,161,91,0.12),transparent_52%)]"
        />

        <PageContainer className="relative py-24 sm:py-32 lg:py-40">
          <div className="grid items-center gap-16 lg:grid-cols-12">
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: 'easeOut' }}
              className="lg:col-span-8"
            >
              <p className="heading-eyebrow">VATAR LIFESTYLE BY SOFT</p>

              <h1 className="heading-display mt-5 text-4xl text-brand-white sm:text-6xl lg:text-7xl">
                More Than A Game.
                <span className="mt-2 block text-brand-cream">
                  A Lifestyle. A Community. A Legacy.
                </span>
              </h1>

              <p className="body-lead mt-8 max-w-xl">
                Welcome to VATAR LIFESTYLE BY SOFT — a modern home for those who treat
                sport, community, and personal standard as one cohesive way of life.
              </p>

              <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
                <Button to={ROUTES.register} variant="primary" size="lg">
                  Join The Community
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button to={ROUTES.about} variant="secondary" size="lg">
                  Explore Community
                </Button>
              </div>
            </motion.div>

            <motion.aside
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, delay: 0.12, ease: 'easeOut' }}
              aria-label="Brand emblem"
              className="lg:col-span-4"
            >
              <div className="relative border border-brand-gold/30 bg-brand-charcoal p-8 sm:p-10">
                <div
                  aria-hidden="true"
                  className="mb-8 h-px w-12 bg-brand-gold"
                />
                <p className="font-heading text-xs tracking-[0.26em] text-brand-gold uppercase">
                  Identity
                </p>
                <p className="mt-4 font-heading text-3xl font-semibold tracking-[0.08em] text-brand-white uppercase">
                  VATAR
                </p>
                <p className="mt-1 font-body text-xs tracking-[0.28em] text-brand-cream/80 uppercase">
                  LIFESTYLE BY SOFT
                </p>
                <div className="mt-8 border-t hairline-border pt-6">
                  <p className="font-body text-sm leading-relaxed text-brand-muted">
                    Designed with restraint, purpose, and permanence — uniting members,
                    competitions, and curated culture under one roof.
                  </p>
                </div>
              </div>
            </motion.aside>
          </div>
        </PageContainer>
      </section>

      <section className="section-padding bg-brand-black">
        <PageContainer>
          <SectionHeader
            eyebrow="The Ethos"
            title="Built On Three Enduring Pillars"
            description="Every experience within VATAR LIFESTYLE BY SOFT is shaped around clarity, belonging, and lasting craft."
          />

          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {BRAND_PILLARS.map((pillar) => (
              <article
                key={pillar.index}
                className="flex flex-col justify-between border hairline-border bg-brand-charcoal/60 p-8 transition-colors duration-200 hover:border-brand-gold/40"
              >
                <div>
                  <span className="font-heading text-xs tracking-[0.24em] text-brand-gold">
                    {pillar.index}
                  </span>
                  <h3 className="heading-section mt-4 text-2xl text-brand-white">
                    {pillar.title}
                  </h3>
                  <p className="mt-4 font-body text-sm leading-relaxed text-brand-muted">
                    {pillar.description}
                  </p>
                </div>

                <div className="mt-8 border-t hairline-border pt-5">
                  <Link
                    to={pillar.to}
                    className="inline-flex items-center gap-2 font-heading text-xs tracking-[0.18em] text-brand-cream uppercase transition-colors hover:text-brand-gold"
                  >
                    {pillar.ctaLabel}
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </PageContainer>
      </section>
    </>
  );
}
