import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { PageContainer } from '@/components/layout/PageContainer';
import { cn } from '@/lib/utilities/cn';
import { ROUTES } from '@/routes/paths';
import type { NavItem } from '@/types/navigation';

const PUBLIC_NAV_ITEMS: readonly NavItem[] = [
  { label: 'About', to: ROUTES.about },
  { label: 'Membership', to: ROUTES.membership },
  { label: 'Competitions', to: ROUTES.competitions },
  { label: 'Leaderboard', to: ROUTES.leaderboard },
  { label: 'Marketplace', to: ROUTES.marketplace },
  { label: 'Contact', to: ROUTES.contact },
];

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!mobileMenuOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileMenuOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen]);

  return (
    <header className="sticky top-0 z-50 border-b hairline-border bg-brand-black/95 backdrop-blur-sm">
      <PageContainer className="flex h-20 items-center justify-between gap-6">
        <Link
          to={ROUTES.home}
          className="group flex flex-col leading-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-gold"
          aria-label="VATAR LIFESTYLE BY SOFT Home"
        >
          <span className="font-heading text-lg font-semibold tracking-[0.14em] text-brand-white uppercase transition-colors group-hover:text-brand-cream sm:text-xl">
            VATAR LIFESTYLE
          </span>
          <span className="mt-1 font-body text-[0.625rem] font-medium tracking-[0.34em] text-brand-gold uppercase">
            BY SOFT
          </span>
        </Link>

        <nav aria-label="Primary navigation" className="hidden items-center gap-7 lg:flex">
          {PUBLIC_NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'font-body text-xs font-medium tracking-[0.16em] uppercase transition-colors duration-200',
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

        <div className="hidden items-center gap-3 lg:flex">
          <Button to={ROUTES.login} variant="ghost" size="sm">
            Sign In
          </Button>
          <Button to={ROUTES.register} variant="primary" size="sm">
            Register
          </Button>
        </div>

        <button
          type="button"
          onClick={() => setMobileMenuOpen((prev) => !prev)}
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-navigation"
          aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          className="inline-flex h-10 w-10 items-center justify-center border hairline-border text-brand-cream transition-colors hover:border-brand-gold hover:text-brand-gold lg:hidden"
        >
          {mobileMenuOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
        </button>
      </PageContainer>

      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            id="mobile-navigation"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="border-t hairline-border bg-brand-charcoal lg:hidden"
          >
            <PageContainer className="py-6">
              <nav aria-label="Mobile navigation" className="flex flex-col gap-1">
                {PUBLIC_NAV_ITEMS.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        'border-b border-brand-cream/5 py-3 font-heading text-sm tracking-[0.16em] uppercase transition-colors',
                        isActive
                          ? 'text-brand-gold'
                          : 'text-brand-cream hover:text-brand-gold',
                      )
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
              </nav>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Button
                  to={ROUTES.register}
                  variant="primary"
                  size="md"
                  className="w-full sm:w-auto"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Register
                </Button>
                <Button
                  to={ROUTES.login}
                  variant="secondary"
                  size="md"
                  className="w-full sm:w-auto"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Sign In
                </Button>
              </div>
            </PageContainer>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
