import { Link } from 'react-router-dom';
import { PageContainer } from '@/components/layout/PageContainer';
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
    <footer className="border-t hairline-border bg-brand-charcoal">
      <PageContainer className="py-16">
        <div className="grid gap-12 md:grid-cols-12">
          <div className="md:col-span-6">
            <Link to={ROUTES.home} className="inline-flex flex-col leading-none">
              <span className="font-heading text-xl font-semibold tracking-[0.14em] text-brand-white uppercase">
                VATAR LIFESTYLE
              </span>
              <span className="mt-1 font-body text-[0.625rem] font-medium tracking-[0.34em] text-brand-gold uppercase">
                BY SOFT
              </span>
            </Link>
            <p className="mt-5 max-w-md font-body text-sm leading-relaxed text-brand-cream/85">
              More Than A Game. A Lifestyle. A Community. A Legacy.
            </p>
          </div>

          <div className="md:col-span-3">
            <h2 className="font-heading text-xs font-medium tracking-[0.22em] text-brand-gold uppercase">
              Explore
            </h2>
            <ul className="mt-4 space-y-2.5">
              {EXPLORE_LINKS.map((item) => (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className="font-body text-sm text-brand-muted transition-colors hover:text-brand-white"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="md:col-span-3">
            <h2 className="font-heading text-xs font-medium tracking-[0.22em] text-brand-gold uppercase">
              Access
            </h2>
            <ul className="mt-4 space-y-2.5">
              {PORTAL_LINKS.map((item) => (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className="font-body text-sm text-brand-muted transition-colors hover:text-brand-white"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-14 flex flex-col items-start justify-between gap-4 border-t hairline-border pt-8 sm:flex-row sm:items-center">
          <p className="font-body text-xs tracking-[0.08em] text-brand-muted">
            &copy; {currentYear} VATAR LIFESTYLE BY SOFT. All rights reserved.
          </p>
          <p className="font-body text-xs tracking-[0.14em] text-brand-muted/80 uppercase">
            Foundation Architecture
          </p>
        </div>
      </PageContainer>
    </footer>
  );
}
