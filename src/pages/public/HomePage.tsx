import { useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Crown,
  ExternalLink,
  Send,
  ShieldCheck,
  Sparkles,
  Store,
  Trophy,
  Wallet,
  Wifi,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import heroEditorialImg from '@/assets/hero-editorial.webp';
import { PageContainer } from '@/components/layout/PageContainer';
import { Button } from '@/components/ui/Button';
import { ACTIVE_SOCIAL_CHANNELS, WHATSAPP_CHANNEL } from '@/config/socials';
import {
  calculateTrillionQuoteNgn,
  formatTrillionLabel,
  HALF_TRILLION_RATE_NGN,
  LIVE_RATE_NGN_PER_TRILLION,
  MAX_ORDER_TRILLIONS,
  MIN_ORDER_TRILLIONS,
  normalizeTrillions,
  TRILLION_PRESETS,
  VIP_TIERS,
} from '@/features/marketplace/services/moneyPackService';
import { ReviewsSection } from '@/features/reviews/components/ReviewsSection';
import { ROUTES } from '@/routes/paths';

const QUICK_PILLARS = [
  {
    icon: Store,
    title: 'Marketplace & VIP',
    summary: 'Buy LagosLife currency from 1T–1000T or unlock up to 20% off.',
    to: ROUTES.dashboardMarketplace,
  },
  {
    icon: Wallet,
    title: 'VATAR Treasury',
    summary: 'Single, bulk, and LagosLife party Auto-Sprayer in one hub.',
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
  const navigate = useNavigate();
  const [trillionsInput, setTrillionsInput] = useState<string>('0.5');

  const parsedT = normalizeTrillions(trillionsInput);
  const displayLabel = formatTrillionLabel(parsedT);
  const { finalPrice } = calculateTrillionQuoteNgn(parsedT, 0);

  return (
    <div className="bg-brand-black">
      {/* Compact Hero + Live Quote Calculator */}
      <section className="relative overflow-hidden border-b hairline-border bg-brand-black">
        <img
          src={heroEditorialImg}
          alt="VATAR LIFESTYLE BY SOFT backdrop"
          width={1376}
          height={768}
          loading="eager"
          fetchPriority="high"
          decoding="async"
          className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center opacity-45"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-brand-black via-brand-black/88 to-brand-black/60"
        />

        <PageContainer className="relative z-10 py-10 sm:py-16">
          <div className="grid items-start gap-8 lg:grid-cols-12">
            {/* Left: Headline + Key Metrics */}
            <div className="lg:col-span-6">
              <div className="flex items-center gap-3">
                <span aria-hidden="true" className="h-px w-8 bg-brand-gold" />
                <p className="heading-eyebrow">VATAR LIFESTYLE BY SOFT</p>
              </div>

              <h1 className="heading-display mt-3 text-4xl text-brand-white sm:text-5xl">
                Buy LagosLife Funds{' '}
                <span className="gold-text-gradient">Straight &amp; Fast.</span>
              </h1>

              <p className="mt-3 max-w-lg font-body text-sm leading-relaxed text-brand-cream/80">
                Official currency marketplace, VIP discount tiers up to 20% off, and
                tracked multi-pipeline delivery.
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Button to={ROUTES.dashboardMarketplace} variant="primary" size="lg">
                  Buy Currency
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button to={ROUTES.login} variant="secondary" size="lg">
                  Sign In
                </Button>
                <Button to={ROUTES.register} variant="subtle" size="lg">
                  Create Account
                </Button>
              </div>

              {/* 3-Column Live Metrics Strip */}
              <div className="mt-8 grid grid-cols-3 gap-4 border-t hairline-border pt-5">
                <div>
                  <p className="font-heading text-[0.62rem] tracking-[0.18em] text-brand-muted uppercase">
                    Live Rate
                  </p>
                  <p className="mt-1 font-heading text-sm font-semibold text-brand-white sm:text-base">
                    ₦{LIVE_RATE_NGN_PER_TRILLION.toLocaleString()} / 1T
                  </p>
                </div>
                <div>
                  <p className="font-heading text-[0.62rem] tracking-[0.18em] text-brand-muted uppercase">
                    Minimum Order
                  </p>
                  <p className="mt-1 font-heading text-sm font-semibold text-brand-gold sm:text-base">
                    500B (₦{HALF_TRILLION_RATE_NGN.toLocaleString()})
                  </p>
                </div>
                <div>
                  <p className="font-heading text-[0.62rem] tracking-[0.18em] text-brand-muted uppercase">
                    Tracked
                  </p>
                  <p className="mt-1 font-heading text-sm font-semibold text-brand-white sm:text-base">
                    Every batch
                  </p>
                </div>
              </div>
            </div>

            {/* Right: Live Quote Card */}
            <div className="border border-brand-gold/45 bg-brand-charcoal/90 p-5 sm:p-6 lg:col-span-6">
              <div className="flex items-center justify-between gap-2">
                <span className="font-heading text-xs tracking-[0.2em] text-brand-muted uppercase">
                  Live Quote
                </span>
                <span className="inline-flex items-center gap-1.5 border border-brand-gold/40 bg-brand-gold/15 px-2.5 py-1 font-mono text-xs text-brand-gold">
                  <Sparkles className="h-3 w-3" aria-hidden="true" />
                  ₦{LIVE_RATE_NGN_PER_TRILLION.toLocaleString()} / 1T
                </span>
              </div>

              <label
                htmlFor="home-quote-trillions"
                className="mt-4 block font-body text-xs text-brand-cream/85"
              >
                How much do you want to buy?
              </label>
              <div className="relative mt-2">
                <input
                  id="home-quote-trillions"
                  type="number"
                  min={MIN_ORDER_TRILLIONS}
                  max={MAX_ORDER_TRILLIONS}
                  step={0.5}
                  value={trillionsInput}
                  onChange={(e) => setTrillionsInput(e.target.value)}
                  className="w-full border hairline-border bg-brand-black py-3 pr-12 pl-4 font-heading text-2xl font-semibold text-brand-white focus:border-brand-gold focus:outline-none"
                />
                <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full border hairline-border bg-brand-charcoal font-heading text-xs text-brand-gold">
                  T
                </span>
              </div>

              {/* Preset Chips */}
              <div className="mt-3 flex flex-wrap gap-2">
                {TRILLION_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setTrillionsInput(String(preset))}
                    className={`cursor-pointer border px-3 py-1 font-mono text-xs transition-colors ${
                      parsedT === preset
                        ? 'border-brand-gold bg-brand-gold text-brand-black font-semibold'
                        : 'hairline-border bg-brand-black text-brand-cream hover:border-brand-gold'
                    }`}
                  >
                    {preset}T
                  </button>
                ))}
              </div>

              {/* Quote Summary Box */}
              <div className="mt-4 space-y-2 border hairline-border bg-brand-black/80 p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-body text-xs text-brand-muted">You pay</span>
                  <span className="font-heading text-2xl font-semibold text-brand-white">
                    ₦{finalPrice.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-body text-xs text-brand-muted">Game currency</span>
                  <span className="font-mono text-xs font-semibold text-brand-gold">
                    {displayLabel}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  navigate(`${ROUTES.dashboardMarketplace}?t=${parsedT}`)
                }
                className="mt-4 inline-flex w-full cursor-pointer items-center justify-center gap-2 border border-brand-gold bg-brand-gold px-5 py-3 font-heading text-xs font-semibold tracking-[0.2em] text-brand-black uppercase transition-colors hover:border-brand-cream hover:bg-brand-cream"
              >
                Continue
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>

              <div className="mt-3 flex flex-wrap items-center justify-center gap-4 font-heading text-[0.62rem] tracking-[0.16em] text-brand-muted uppercase">
                <span className="inline-flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5 text-brand-gold" />
                  Verified Payments
                </span>
                <span className="inline-flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5 text-brand-gold" />
                  Tracked Delivery
                </span>
              </div>
            </div>
          </div>
        </PageContainer>
      </section>

      {/* VIP Discount Tiers Preview */}
      <section className="border-b hairline-border bg-brand-obsidian py-10">
        <PageContainer>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="heading-eyebrow flex items-center gap-1.5">
                <Crown className="h-3.5 w-3.5 text-brand-gold" />
                Membership Discounts
              </p>
              <h2 className="heading-section mt-1 text-2xl text-brand-white">
                Save up to 20% on every purchase
              </h2>
            </div>
            <Button to={ROUTES.dashboardMarketplace} variant="secondary" size="sm">
              Unlock Discount Tier
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {VIP_TIERS.map((tier) => (
              <Link
                key={tier.code}
                to={ROUTES.dashboardMarketplace}
                className={`border p-4 transition-transform hover:-translate-y-0.5 ${tier.accentClass}`}
              >
                <p className="font-heading text-xs font-semibold tracking-[0.18em] uppercase">
                  {tier.name}
                </p>
                <p className="mt-1 font-heading text-lg font-semibold text-brand-white">
                  ₦{tier.monthlyPriceNgn.toLocaleString()}
                  <span className="text-xs font-normal text-brand-muted">/mo</span>
                </p>
                <p className="mt-1 font-mono text-xs">{tier.discountPercent}% off every order</p>
              </Link>
            ))}
          </div>
        </PageContainer>
      </section>

      {/* Core Services + VATAR Data Coming Soon + Verified Reviews + Official Channels */}
      <section className="bg-brand-black py-10">
        <PageContainer className="space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
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

            {/* VATAR Data Coming Soon Teaser */}
            <div className="relative flex flex-col justify-between border border-brand-gold/45 bg-brand-charcoal/70 p-5">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <Wifi className="h-5 w-5 text-brand-gold" aria-hidden="true" />
                  <span className="border border-brand-gold bg-brand-gold/15 px-2 py-0.5 font-heading text-[0.58rem] font-semibold tracking-[0.16em] text-brand-gold uppercase">
                    Coming Soon
                  </span>
                </div>
                <h3 className="heading-section mt-3 text-lg text-brand-white">
                  VATAR Data Hub
                </h3>
                <p className="mt-1.5 font-body text-xs leading-relaxed text-brand-muted">
                  Buy real MTN Daily &amp; Weekly mobile data (1GB – 20GB) directly with
                  LagosLife in-game money.
                </p>
              </div>
              <span className="mt-4 font-mono text-[11px] text-brand-gold">
                From 150B (1GB) &bull; Launching Soon
              </span>
            </div>
          </div>

          {/* Real Member Reviews & 5-Star Ratings */}
          <ReviewsSection />

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
