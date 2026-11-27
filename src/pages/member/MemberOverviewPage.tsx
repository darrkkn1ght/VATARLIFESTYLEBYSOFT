import { useEffect, useState } from 'react';
import {
  Activity,
  ArrowRight,
  Bell,
  Coins,
  ShieldCheck,
  Store,
  Trophy,
  User,
  Wallet,
  Wifi,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageContainer } from '@/components/layout/PageContainer';
import { Button } from '@/components/ui/Button';
import { MembershipStatusBadge } from '@/features/administration/components/MembershipStatusBadge';
import {
  AnnouncementPriorityBadge,
  PinnedBadge,
} from '@/features/announcements/components/AnnouncementBadges';
import { fetchMemberAnnouncements } from '@/features/announcements/services/announcementService';
import { useAuth } from '@/features/auth/hooks/useAuth';
import type { MemberAnnouncementRow } from '@/lib/supabase/database.types';
import { ROUTES } from '@/routes/paths';

const QUICK_ACTIONS = [
  {
    title: 'Buy Money Packs',
    subtitle: 'Official 100B – 1T packs & member listings',
    to: ROUTES.dashboardMarketplace,
    icon: Store,
    highlight: true,
  },
  {
    title: 'VATAR Data Hub',
    subtitle: 'Buy MTN daily & weekly data with LagosLife funds',
    to: ROUTES.dashboardDataHub,
    icon: Wifi,
    highlight: true,
  },
  {
    title: 'VATAR Treasury',
    subtitle: 'Single, bulk & Auto-Spray LagosLife sends',
    to: ROUTES.dashboardTreasury,
    icon: Wallet,
    highlight: false,
  },
  {
    title: 'Competitions',
    subtitle: 'Join tournaments & view rules',
    to: ROUTES.dashboardCompetitions,
    icon: Trophy,
    highlight: false,
  },
  {
    title: 'Leaderboard',
    subtitle: 'Official standings & rankings',
    to: ROUTES.dashboardLeaderboard,
    icon: Activity,
    highlight: false,
  },
  {
    title: 'My Profile',
    subtitle: 'LagosLife handle & account details',
    to: ROUTES.dashboardProfile,
    icon: User,
    highlight: false,
  },
  {
    title: 'Membership',
    subtitle: 'Verified status & access details',
    to: ROUTES.dashboardMembership,
    icon: ShieldCheck,
    highlight: false,
  },
] as const;

export function MemberOverviewPage() {
  const { profile, membership } = useAuth();
  const [recentAnnouncements, setRecentAnnouncements] = useState<MemberAnnouncementRow[]>([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void fetchMemberAnnouncements(null).then((res) => {
      if (!active) return;
      if (!res.error) {
        setRecentAnnouncements(res.announcements);
      }
      setAnnouncementsLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const unreadCount = recentAnnouncements.filter((a) => !a.is_read).length;

  return (
    <div className="bg-brand-black">
      {/* Compact Member Header */}
      <section className="border-b hairline-border bg-brand-obsidian">
        <PageContainer className="py-6 sm:py-8">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="heading-display text-2xl text-brand-white sm:text-3xl">
                  Welcome, {profile?.full_name || profile?.username || 'Member'}
                </h1>
                {membership?.status && (
                  <MembershipStatusBadge status={membership.status} />
                )}
              </div>
              <p className="mt-1 font-body text-xs text-brand-muted">
                @{profile?.username || 'member'}
                {profile?.lagos_life_username
                  ? ` • LagosLife: ${profile.lagos_life_username}`
                  : ''}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <Button to={ROUTES.dashboardMarketplace} variant="primary" size="sm">
                <Coins className="h-3.5 w-3.5" aria-hidden="true" />
                Buy Money Packs
              </Button>
              <Button to={ROUTES.dashboardTreasury} variant="secondary" size="sm">
                <Wallet className="h-3.5 w-3.5 text-brand-gold" aria-hidden="true" />
                Money Sender
              </Button>
            </div>
          </div>
        </PageContainer>
      </section>

      <PageContainer className="space-y-8 py-6 sm:py-8">
        {/* Straight-to-Business Quick Actions Grid */}
        <section>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {QUICK_ACTIONS.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`group flex items-center justify-between gap-4 border p-4 transition-colors ${
                    item.highlight
                      ? 'border-brand-gold/55 bg-brand-gold/10 hover:border-brand-gold'
                      : 'hairline-border bg-brand-charcoal/55 hover:border-brand-gold/50'
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center border border-brand-gold/35 bg-brand-black text-brand-gold">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div>
                      <h2 className="font-heading text-sm font-semibold tracking-[0.12em] text-brand-white uppercase group-hover:text-brand-gold">
                        {item.title}
                      </h2>
                      <p className="mt-0.5 font-body text-xs text-brand-muted">
                        {item.subtitle}
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-brand-muted group-hover:text-brand-gold" />
                </Link>
              );
            })}
          </div>
        </section>

        {/* Compact Latest Announcements */}
        {!announcementsLoading && recentAnnouncements.length > 0 && (
          <section className="border hairline-border bg-brand-charcoal/45 p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-brand-gold" aria-hidden="true" />
                <h2 className="font-heading text-xs font-semibold tracking-[0.18em] text-brand-cream uppercase">
                  Latest Announcements
                  {unreadCount > 0 ? ` (${unreadCount} New)` : ''}
                </h2>
              </div>
              <Link
                to={ROUTES.dashboardAnnouncements}
                className="font-heading text-[0.68rem] tracking-[0.16em] text-brand-gold uppercase hover:underline"
              >
                View All
              </Link>
            </div>

            <div className="mt-3 divide-y divide-brand-cream/10">
              {recentAnnouncements.slice(0, 3).map((item) => (
                <Link
                  key={item.id}
                  to={ROUTES.dashboardAnnouncements}
                  className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm transition-colors hover:text-brand-gold"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {item.is_pinned && <PinnedBadge />}
                    <AnnouncementPriorityBadge priority={item.priority} />
                    <span className="font-medium text-brand-white">{item.title}</span>
                  </div>
                  {!item.is_read && (
                    <span className="font-heading text-[0.62rem] tracking-[0.16em] text-brand-gold uppercase">
                      Unread
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </section>
        )}
      </PageContainer>
    </div>
  );
}
