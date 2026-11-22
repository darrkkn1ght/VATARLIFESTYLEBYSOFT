import { Link, NavLink, Outlet } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { cn } from '@/lib/utilities/cn';
import { ROUTES } from '@/routes/paths';
import type { NavItem } from '@/types/navigation';

interface PortalLayoutProps {
  sectionLabel: string;
  navItems?: readonly NavItem[];
}

export function PortalLayout({ sectionLabel, navItems }: PortalLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-brand-black text-brand-white">
      <header className="border-b hairline-border bg-brand-charcoal">
        <PageContainer className="flex h-20 items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <Link to={ROUTES.home} className="flex flex-col leading-none">
              <span className="font-heading text-base font-semibold tracking-[0.14em] text-brand-white uppercase sm:text-lg">
                VATAR LIFESTYLE
              </span>
              <span className="mt-1 font-body text-[0.6rem] font-medium tracking-[0.34em] text-brand-gold uppercase">
                BY SOFT
              </span>
            </Link>
            <span className="hidden h-6 w-px bg-brand-cream/15 sm:block" aria-hidden="true" />
            <span className="hidden font-body text-xs tracking-[0.2em] text-brand-muted uppercase sm:inline">
              {sectionLabel}
            </span>
          </div>

          <Link
            to={ROUTES.home}
            className="inline-flex items-center gap-2 font-body text-xs tracking-[0.16em] text-brand-muted uppercase transition-colors hover:text-brand-gold"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Return Home
          </Link>
        </PageContainer>

        {navItems && navItems.length > 0 && (
          <div className="border-t hairline-border bg-brand-black/60">
            <PageContainer>
              <nav
                aria-label={`${sectionLabel} navigation`}
                className="flex items-center gap-6 overflow-x-auto py-3"
              >
                {navItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === ROUTES.dashboard || item.to === ROUTES.admin}
                    className={({ isActive }) =>
                      cn(
                        'shrink-0 font-body text-xs font-medium tracking-[0.16em] uppercase transition-colors',
                        isActive
                          ? 'text-brand-gold'
                          : 'text-brand-muted hover:text-brand-white',
                      )
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
              </nav>
            </PageContainer>
          </div>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
