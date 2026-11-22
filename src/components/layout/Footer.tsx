import { ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageContainer } from '@/components/layout/PageContainer';
import { ACTIVE_SOCIAL_CHANNELS, WHATSAPP_CHANNEL } from '@/config/socials';
import { ROUTES } from '@/routes/paths';
import type { NavItem } from '@/types/navigation';

const EXPLORE_LINKS: readonly NavItem[] = [
  { label: 'About', to: ROUTES.about },
  { label: 'Membership', to: ROUTES.membership },
  { label: 'Competitions', to: ROUTES.competitions },
  { label: 'Leaderboard', to: ROUTES.leaderboard },
  { label: 'Marketplace', to: ROUTES.marketplace },
  { label: 'Contact', to: ROUTES.contact },
];

const PORTAL_LINKS: readonly NavItem[] = [
  { label: 'Sign In', to: ROUTES.login },
  { label: 'Register', to: ROUTES.register },
  { label: 'Member Dashboard', to: ROUTES.dashboard },
];

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative border-t hairline-border bg-brand-obsidian">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-gold/40 to-transparent"
      />
      <PageContainer className="py-16 lg:py-20">
        <div className="grid gap-12 md:grid-cols-12">
          <div className="md:col-span-6 lg:col-span-5">
            <Link to={ROUTES.home} className="inline-flex items-center gap-3">
              <span
                aria-hidden="true"
                className="flex h-9 w-9 items-center justify-center border border-brand-gold/50 bg-brand-charcoal font-heading text-sm font-semibold text-brand-gold"
              >
                V
              </span>
              <span className="flex flex-col leading-none">
                <span className="font-heading text-lg font-semibold tracking-[0.16em] text-brand-white uppercase">
                  VATAR LIFESTYLE
                </span>
                <span className="mt-1 font-body text-[0.6rem] font-medium tracking-[0.36em] text-brand-gold uppercase">
                  BY SOFT
                </span>
              </span>
            </Link>

            <p className="mt-6 max-w-sm font-heading text-xs tracking-[0.2em] text-brand-cream uppercase">
              More Than A Game. A Lifestyle. A Community. A Legacy.
            </p>
            <p className="mt-3 max-w-md font-body text-sm leading-relaxed text-brand-muted">
              A gaming and lifestyle community built around competitive standards,
              shared identity, and lasting culture.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <a
                href={WHATSAPP_CHANNEL.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${WHATSAPP_CHANNEL.platform} — ${WHATSAPP_CHANNEL.name}`}
                className="inline-flex items-center gap-2 border border-brand-gold/35 bg-brand-charcoal/70 px-3.5 py-2 font-heading text-[0.7rem] tracking-[0.18em] text-brand-cream uppercase transition-colors hover:border-brand-gold hover:text-brand-gold"
              >
                <span>{WHATSAPP_CHANNEL.platform}</span>
                <span className="font-body text-[0.7rem] tracking-normal text-brand-gold normal-case">
                  Channel
                </span>
                <ExternalLink className="h-3 w-3 text-brand-gold" aria-hidden="true" />
              </a>

              {ACTIVE_SOCIAL_CHANNELS.map((channel) => (
                <a
                  key={channel.id}
                  href={channel.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${channel.platform} (${channel.handle})`}
                  className="inline-flex items-center gap-2 border border-brand-gold/35 bg-brand-charcoal/70 px-3.5 py-2 font-heading text-[0.7rem] tracking-[0.18em] text-brand-cream uppercase transition-colors hover:border-brand-gold hover:text-brand-gold"
                >
                  <span>{channel.platform}</span>
                  <span className="font-body text-[0.7rem] tracking-normal text-brand-gold normal-case">
                    {channel.handle}
                  </span>
                  <ExternalLink className="h-3 w-3 text-brand-gold" aria-hidden="true" />
                </a>
              ))}
            </div>
          </div>

          <div className="md:col-span-3 lg:col-span-3 lg:col-start-7">
            <h2 className="font-heading text-xs font-medium tracking-[0.24em] text-brand-gold uppercase">
              Explore
            </h2>
            <ul className="mt-5 space-y-3">
              {EXPLORE_LINKS.map((item) => (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className="font-body text-sm text-brand-muted transition-colors hover:text-brand-cream"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="md:col-span-3 lg:col-span-3">
            <h2 className="font-heading text-xs font-medium tracking-[0.24em] text-brand-gold uppercase">
              Member Access
            </h2>
            <ul className="mt-5 space-y-3">
              {PORTAL_LINKS.map((item) => (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className="font-body text-sm text-brand-muted transition-colors hover:text-brand-cream"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-16 flex flex-col items-start justify-between gap-4 border-t hairline-border pt-8 sm:flex-row sm:items-center">
          <p className="font-body text-xs tracking-[0.06em] text-brand-muted">
            &copy; {currentYear} VATAR LIFESTYLE BY SOFT. All rights reserved.
          </p>
          <p className="font-body text-[0.7rem] tracking-[0.2em] text-brand-gold/80 uppercase">
            Lagos &bull; Global Community
          </p>
        </div>
      </PageContainer>
    </footer>
  );
}
