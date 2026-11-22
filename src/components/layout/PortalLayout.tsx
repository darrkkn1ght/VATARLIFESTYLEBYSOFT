import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { ArrowLeft, LogOut } from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { fetchUnreadAnnouncementsCount } from '@/features/announcements/services/announcementService';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { cn } from '@/lib/utilities/cn';
import { ROUTES } from '@/routes/paths';
import type { NavItem } from '@/types/navigation';

interface PortalLayoutProps {
  sectionLabel: string;
  navItems?: readonly NavItem[];
}

export function PortalLayout({ sectionLabel, navItems }: PortalLayoutProps) {
  const { isAuthenticated, isApprovedMember, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [unreadAnnouncements, setUnreadAnnouncements] = useState(0);

  const hasMemberAnnouncementsLink = Boolean(
    navItems?.some((item) => item.to === ROUTES.dashboardAnnouncements),
  );

  useEffect(() => {
    if (!isAuthenticated || !isApprovedMember || !hasMemberAnnouncementsLink) {
      setUnreadAnnouncements(0);
      return;
    }

    let active = true;
    const loadCount = () => {
      void fetchUnreadAnnouncementsCount().then((res) => {
        if (active && !res.error) {
          setUnreadAnnouncements(res.count);
        }
      });
    };

    loadCount();
    window.addEventListener('vatar:announcements-updated', loadCount);
    return () => {
      active = false;
      window.removeEventListener('vatar:announcements-updated', loadCount);
    };
  }, [isAuthenticated, isApprovedMember, hasMemberAnnouncementsLink]);

  const handleSignOut = async () => {
    await signOut();
    navigate(ROUTES.login, { replace: true });
  };

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

          <div className="flex items-center gap-5">
            {profile?.username && (
              <span className="hidden font-body text-xs text-brand-cream/80 md:inline">
                @{profile.username}
              </span>
            )}
            <Link
              to={ROUTES.home}
              className="inline-flex items-center gap-2 font-body text-xs tracking-[0.16em] text-brand-muted uppercase transition-colors hover:text-brand-gold"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Home
            </Link>
            {isAuthenticated && (
              <button
                type="button"
                onClick={handleSignOut}
                className="inline-flex cursor-pointer items-center gap-1.5 font-body text-xs tracking-[0.16em] text-brand-muted uppercase transition-colors hover:text-brand-gold"
              >
                <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                Sign Out
              </button>
            )}
          </div>
        </PageContainer>

        {navItems && navItems.length > 0 && (
          <div className="border-t hairline-border bg-brand-black/60">
            <PageContainer>
              <nav
                aria-label={`${sectionLabel} navigation`}
                className="flex items-center gap-6 overflow-x-auto py-3"
              >
                {navItems.map((item) => {
                  const showUnread =
                    item.to === ROUTES.dashboardAnnouncements &&
                    unreadAnnouncements > 0;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.to === ROUTES.dashboard || item.to === ROUTES.admin}
                      className={({ isActive }) =>
                        cn(
                          'inline-flex shrink-0 items-center gap-2 font-body text-xs font-medium tracking-[0.16em] uppercase transition-colors',
                          isActive
                            ? 'text-brand-gold'
                            : 'text-brand-muted hover:text-brand-white',
                        )
                      }
                    >
                      <span>{item.label}</span>
                      {showUnread && (
                        <span className="inline-flex h-4 min-w-4 items-center justify-center bg-brand-gold px-1 font-heading text-[0.62rem] font-semibold text-brand-black">
                          {unreadAnnouncements}
                        </span>
                      )}
                    </NavLink>
                  );
                })}
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
