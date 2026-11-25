import { ArrowRight, Coins, ExternalLink, Send, Store, Trophy, Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';
import heroEditorialImg from '@/assets/hero-editorial.webp';
import { PageContainer } from '@/components/layout/PageContainer';
import { Button } from '@/components/ui/Button';
import { ACTIVE_SOCIAL_CHANNELS, WHATSAPP_CHANNEL } from '@/config/socials';
import { OFFICIAL_MONEY_PACKS } from '@/features/marketplace/services/moneyPackService';
import { ROUTES } from '@/routes/paths';

const QUICK_PILLARS = [
  {
    icon: Store,
    title: 'Money Packs & Marketplace',
    summary: 'Buy official LagosLife funds or trade with verified members.',
    to: ROUTES.dashboardMarketplace,
  },
  {
    icon: Wallet,
    title: 'VATAR Treasury',
    summary: 'Single, bulk, and scheduled LagosLife transfers from one hub.',
    to: ROUTES.dashboardTreasury,
  },
  {
    icon: Trophy,
    title: 'Competitions & Rankings',
    summary: 'Join community tournaments and climb the verified leaderboard.',
    to: ROUTES.competitions,
  },
] as const;

export function HomePage() {
  return (
    <div className="bg-brand-black">
      {/* Compact Business Hero */}
      <section className="relative overflow-hidden border-b hairline-border bg-brand-black">
        <img
          src={heroEditorialImg}
          alt="VATAR LIFESTYLE BY SOFT backdrop"
          width={1376}
          height={768}
          loading="eager"
          fetchPriority="high"
          decoding="async"
          className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center opacity-55"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-brand-black via-brand-black/85 to-brand-black/50"
        />

        <PageContainer className="relative z-10 py-14 sm:py-20">
          <div className="max-w-3xl">
            <div className="flex items-center gap-3">
              <span aria-hidden="true" className="h-px w-8 bg-brand-gold" />
              <p className="heading-eyebrow">VATAR LIFESTYLE BY SOFT</p>
            </div>

            <h1 className="heading-display mt-4 text-4xl text-brand-white sm:text-6xl">
              Lagos Life Funds, Treasury &amp;{' '}
              <span className="gold-text-gradient">Community Hub.</span>
            </h1>

            <p className="mt-4 max-w-xl font-body text-sm leading-relaxed text-brand-cream/80 sm:text-base">
              Buy official LagosLife money packs, automate transfers, compete in tournaments,
              and connect with verified members — fast and direct.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Button to={ROUTES.register} variant="primary" size="lg">
                Create Account
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button to={ROUTES.login} variant="secondary" size="lg">
                Sign In
              </Button>
              <Button to={ROUTES.dashboardMarketplace} variant="subtle" size="lg">
                <Coins className="h-4 w-4 text-brand-gold" aria-hidden="true" />
                Buy Money Packs
              </Button>
            </div>
          </div>
        </PageContainer>
      </section>

      {/* Official Money Pack Rates — Straight to Business */}
      <section className="border-b hairline-border bg-brand-obsidian py-10 sm:py-12">
        <PageContainer>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="heading-eyebrow">Official Rates — By Soft</p>
              <h2 className="heading-section mt-1 text-2xl text-brand-white sm:text-3xl">
                LagosLife Money Packs
              </h2>
            </div>
            <Button to={ROUTES.dashboardMarketplace} variant="primary" size="sm">
              Order Now
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-5">
            {OFFICIAL_MONEY_PACKS.map((pack) => (
              <Link
                key={pack.code}
                to={ROUTES.dashboardMarketplace}
                className="group relative flex flex-col border hairline-border bg-brand-charcoal/70 px-4 py-3 transition-colors hover:border-brand-gold"
              >
                {pack.popular && (
                  <span className="absolute top-1.5 right-2 font-heading text-[0.55rem] tracking-[0.16em] text-brand-gold uppercase">
                    Popular
                  </span>
                )}
                <span className="font-heading text-lg font-semibold text-brand-white group-hover:text-brand-gold">
                  {pack.label}
                </span>
                <span className="mt-0.5 font-body text-xs font-medium text-brand-gold">
                  ₦{pack.priceNgn.toLocaleString()}
                </span>
              </Link>
            ))}
          </div>
        </PageContainer>
      </section>

      {/* Core Services + Official Channels */}
      <section className="bg-brand-black py-10 sm:py-12">
        <PageContainer className="space-y-8">
          <div className="grid gap-4 md:grid-cols-3">
            {QUICK_PILLARS.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.title}
                  to={item.to}
                  className="group flex flex-col justify-between border hairline-border bg-brand-charcoal/55 p-5 transition-colors hover:border-brand-gold/60"
                >
                  <div>
                    <Icon className="h-5 w-5 text-brand-gold" aria-hidden="true" />
                    <h3 className="heading-section mt-3 text-lg text-brand-white group-hover:text-brand-gold">
                      {item.title}
                    </h3>
                    <p className="mt-1.5 font-body text-xs leading-relaxed text-brand-muted">
                      {item.summary}
                    </p>
                  </div>
                  <span className="mt-4 inline-flex items-center gap-1.5 font-heading text-[0.68rem] tracking-[0.18em] text-brand-gold uppercase">
                    Open
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                </Link>
              );
            })}
          </div>

          {/* Direct Community Links Strip */}
          <div className="flex flex-wrap items-center justify-between gap-4 border hairline-border bg-brand-charcoal/40 px-5 py-4">
            <p className="font-heading text-xs tracking-[0.18em] text-brand-cream uppercase">
              Official Channels
            </p>
            <div className="flex flex-wrap items-center gap-2.5">
              <a
                href={WHATSAPP_CHANNEL.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 border border-brand-gold/40 bg-brand-black px-3 py-1.5 font-heading text-[0.68rem] tracking-[0.14em] text-brand-cream uppercase hover:border-brand-gold hover:text-brand-gold"
              >
                <Send className="h-3 w-3 text-brand-gold" aria-hidden="true" />
                WhatsApp
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
              {ACTIVE_SOCIAL_CHANNELS.map((channel) => (
                <a
                  key={channel.id}
                  href={channel.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 border hairline-border bg-brand-black px-3 py-1.5 font-heading text-[0.68rem] tracking-[0.14em] text-brand-cream uppercase hover:border-brand-gold hover:text-brand-gold"
                >
                  {channel.platform}
                  <ExternalLink className="h-3 w-3 text-brand-gold" aria-hidden="true" />
                </a>
              ))}
            </div>
          </div>
        </PageContainer>
      </section>
    </div>
  );
}
