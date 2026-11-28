import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { LogOut, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { PageContainer } from '@/components/layout/PageContainer';
import { useAuth } from '@/features/auth/hooks/useAuth';
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
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, isApprovedMember, isAdmin, membershipStatus, signOut } = useAuth();

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

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

  const handleSignOut = async () => {
    await signOut();
    navigate(ROUTES.home);
  };

  const canAccessAdmin =
    isAdmin && membershipStatus !== 'suspended' && membershipStatus !== 'rejected';

  const accountDestination = canAccessAdmin
    ? ROUTES.admin
    : isApprovedMember
      ? ROUTES.dashboard
      : ROUTES.membershipStatus;

  const accountLabel = canAccessAdmin
    ? 'Admin'
    : isApprovedMember
      ? 'Dashboard'
      : 'Status';

  return (
    <header className="sticky top-0 z-50 border-b hairline-border bg-brand-black/90 backdrop-blur-md">
      <PageContainer className="flex h-20 items-center justify-between gap-6">
        <Link
          to={ROUTES.home}
          className="group flex items-center gap-3 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-gold"
          aria-label="VATAR LIFESTYLE BY SOFT Home"
        >
          <span
            aria-hidden="true"
            className="flex h-8 w-8 items-center justify-center border border-brand-gold/50 bg-brand-charcoal font-heading text-sm font-semibold tracking-wider text-brand-gold transition-colors group-hover:border-brand-gold group-hover:bg-brand-gold group-hover:text-brand-black"
          >
            V
          </span>
          <span className="flex flex-col leading-none">
            <span className="font-heading text-base font-semibold tracking-[0.16em] text-brand-white uppercase transition-colors group-hover:text-brand-cream sm:text-lg">
              VATAR LIFESTYLE
            </span>
            <span className="mt-1 font-body text-[0.58rem] font-medium tracking-[0.36em] text-brand-gold uppercase">
              BY SOFT
            </span>
          </span>
        </Link>

        <nav aria-label="Primary navigation" className="hidden items-center gap-7 xl:flex">
          {PUBLIC_NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'relative py-1 font-body text-[0.72rem] font-medium tracking-[0.18em] uppercase transition-colors duration-200',
                  isActive
                    ? 'text-brand-gold'
                    : 'text-brand-muted hover:text-brand-cream',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {item.label}
                  {isActive && (
                    <span
                      aria-hidden="true"
                      className="absolute right-0 -bottom-1 left-0 h-px bg-brand-gold"
                    />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="hidden items-center gap-3 xl:flex">
          {isAuthenticated ? (
            <>
              <Button to={accountDestination} variant="primary" size="sm">
                {accountLabel}
              </Button>
              <Button variant="ghost" size="sm" onClick={handleSignOut}>
                <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                Sign Out
              </Button>
            </>
          ) : (
            <>
              <Button to={ROUTES.login} variant="ghost" size="sm">
                Sign In
              </Button>
              <Button to={ROUTES.register} variant="primary" size="sm">
                Register
              </Button>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 xl:hidden">
          {isAuthenticated && (
            <Button to={accountDestination} variant="primary" size="sm">
              {accountLabel}
            </Button>
          )}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-navigation"
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            className="inline-flex h-10 w-10 items-center justify-center border hairline-border bg-brand-charcoal/80 text-brand-cream transition-colors hover:border-brand-gold hover:text-brand-gold"
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Menu className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
        </div>
      </PageContainer>

      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            id="mobile-navigation"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="overflow-hidden border-t hairline-border bg-brand-obsidian xl:hidden"
          >
            <PageContainer className="py-6">
              <nav aria-label="Mobile navigation" className="flex flex-col">
                {PUBLIC_NAV_ITEMS.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center justify-between border-b border-brand-cream/8 py-3.5 font-heading text-sm tracking-[0.18em] uppercase transition-colors',
                        isActive
                          ? 'text-brand-gold'
                          : 'text-brand-cream hover:text-brand-gold',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <span>{item.label}</span>
                        {isActive && (
                          <span className="h-1.5 w-1.5 bg-brand-gold" aria-hidden="true" />
                        )}
                      </>
                    )}
                  </NavLink>
                ))}
              </nav>

              <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {isAuthenticated ? (
                  <>
                    <Button
                      to={accountDestination}
                      variant="primary"
                      size="md"
                      className="w-full"
                    >
                      {accountLabel}
                    </Button>
                    <Button
                      variant="secondary"
                      size="md"
                      className="w-full"
                      onClick={handleSignOut}
                    >
                      Sign Out
                    </Button>
                  </>
                ) : (
                  <>
                    <Button to={ROUTES.register} variant="primary" size="md" className="w-full">
                      Register
                    </Button>
                    <Button to={ROUTES.login} variant="secondary" size="md" className="w-full">
                      Sign In
                    </Button>
                  </>
                )}
              </div>
            </PageContainer>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
