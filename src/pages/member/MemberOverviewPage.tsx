import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Calendar,
  CheckCircle2,
  ShieldCheck,
  Store,
  Trophy,
  User,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageContainer } from '@/components/layout/PageContainer';
import { EmptyState } from '@/components/shared/EmptyState';
import { SectionHeading } from '@/components/shared/SectionHeading';
import { Button } from '@/components/ui/Button';
import { MembershipStatusBadge } from '@/features/administration/components/MembershipStatusBadge';
import {
  AnnouncementPriorityBadge,
  PinnedBadge,
} from '@/features/announcements/components/AnnouncementBadges';
import { fetchMemberAnnouncements } from '@/features/announcements/services/announcementService';
import { ANNOUNCEMENT_CATEGORY_LABELS } from '@/features/announcements/types/announcement.types';
import { useAuth } from '@/features/auth/hooks/useAuth';
import type { MemberAnnouncementRow } from '@/lib/supabase/database.types';
import { ROUTES } from '@/routes/paths';

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

const QUICK_LINKS = [
  {
    title: 'My Profile',
    description: 'Manage your VATAR handle, Lagos Life username, and personal bio.',
    to: ROUTES.dashboardProfile,
    icon: User,
  },
  {
    title: 'My Membership',
    description: 'Inspect your verified membership status and approval history.',
    to: ROUTES.dashboardMembership,
    icon: ShieldCheck,
  },
  {
    title: 'Competitions',
    description: 'Explore upcoming tournaments, schedules, and competitive rules.',
    to: ROUTES.dashboardCompetitions,
    icon: Trophy,
  },
  {
    title: 'Leaderboard',
    description: 'Track seasonal standings and recognition across the community.',
    to: ROUTES.dashboardLeaderboard,
    icon: Activity,
  },
  {
    title: 'Marketplace',
    description: 'Browse moderated community listings and manage orders.',
    to: ROUTES.dashboardMarketplace,
    icon: Store,
  },
] as const;

export function MemberOverviewPage() {
  const { user, profile, membership } = useAuth();
  const [recentAnnouncements, setRecentAnnouncements] = useState<
    MemberAnnouncementRow[]
  >([]);
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

  const unreadAnnouncementsCount = recentAnnouncements.filter(
    (a) => !a.is_read,
  ).length;

  const completionItems = [
    { label: 'Full Name', complete: Boolean(profile?.full_name?.trim()) },
    { label: 'VATAR Username', complete: Boolean(profile?.username?.trim()) },
    {
      label: 'Lagos Life Username',
      complete: Boolean(profile?.lagos_life_username?.trim()),
    },
    { label: 'Member Bio', complete: Boolean(profile?.bio?.trim()) },
  ];

  const completedCount = completionItems.filter((item) => item.complete).length;
  const completionPercent = Math.round(
    (completedCount / completionItems.length) * 100,
  );

  const memberSince = membership?.reviewed_at ?? membership?.created_at ?? profile?.created_at;

  return (
    <div className="bg-brand-black">
      {/* Editorial Member Masthead */}
      <section className="relative overflow-hidden border-b hairline-border bg-brand-obsidian">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 ambient-gold-glow"
        />
        <PageContainer className="relative py-12 sm:py-16">
          <div className="grid items-end gap-8 lg:grid-cols-12">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
              className="lg:col-span-8"
            >
              <div className="flex flex-wrap items-center gap-3">
                <span aria-hidden="true" className="h-px w-8 bg-brand-gold" />
                <p className="heading-eyebrow">Member Portal</p>
                {membership && (
                  <MembershipStatusBadge status={membership.status} />
                )}
              </div>

              <h1 className="heading-display mt-4 text-4xl text-brand-white sm:text-5xl lg:text-6xl">
                Welcome Back,{' '}
                <span className="gold-text-gradient">
                  {profile?.full_name ?? 'Member'}
                </span>
              </h1>

              <p className="mt-4 max-w-2xl font-body text-sm leading-relaxed text-brand-muted sm:text-base">
                Your home inside VATAR LIFESTYLE BY SOFT — manage your verified
                identity, review your membership record, and stay aligned with the
                community.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.08, ease: 'easeOut' }}
              className="flex flex-wrap gap-3 lg:col-span-4 lg:justify-end"
            >
              <Button to={ROUTES.dashboardProfile} variant="primary" size="sm">
                Edit Profile
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
              <Button to={ROUTES.dashboardMembership} variant="secondary" size="sm">
                Membership Record
              </Button>
            </motion.div>
          </div>

          {/* Identity Strip */}
          <dl className="mt-10 grid gap-4 border-t hairline-border pt-7 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="font-body text-[0.65rem] tracking-[0.22em] text-brand-muted uppercase">
                VATAR Username
              </dt>
              <dd className="mt-1 font-heading text-lg tracking-[0.06em] text-brand-cream">
                {profile?.username ? `@${profile.username}` : '—'}
              </dd>
            </div>
            <div>
              <dt className="font-body text-[0.65rem] tracking-[0.22em] text-brand-muted uppercase">
                Lagos Life Username
              </dt>
              <dd className="mt-1 font-heading text-lg tracking-[0.06em] text-brand-cream">
                {profile?.lagos_life_username ?? '—'}
              </dd>
            </div>
            <div>
              <dt className="font-body text-[0.65rem] tracking-[0.22em] text-brand-muted uppercase">
                Account Email
              </dt>
              <dd className="mt-1 truncate font-body text-sm text-brand-cream/85">
                {user?.email ?? '—'}
              </dd>
            </div>
            <div>
              <dt className="font-body text-[0.65rem] tracking-[0.22em] text-brand-muted uppercase">
                Member Since
              </dt>
              <dd className="mt-1 inline-flex items-center gap-2 font-body text-sm text-brand-cream/85">
                <Calendar className="h-3.5 w-3.5 text-brand-gold" aria-hidden="true" />
                {formatDate(memberSince)}
              </dd>
            </div>
          </dl>
        </PageContainer>
      </section>

      <PageContainer className="py-12 sm:py-16">
        <div className="grid gap-12 lg:grid-cols-12">
          {/* Left: Quick Access + Announcements */}
          <div className="space-y-12 lg:col-span-8">
            <section>
              <SectionHeading
                index="01"
                eyebrow="Navigation"
                title="Quick Access"
                description="Move directly into your profile, membership record, or community spaces."
              />

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {QUICK_LINKS.map(({ title, description, to, icon: Icon }) => (
                  <Link
                    key={to}
                    to={to}
                    className="group flex flex-col justify-between border hairline-border bg-brand-charcoal/60 p-6 transition-colors duration-200 hover:border-brand-gold/50 hover:bg-brand-charcoal"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="flex h-9 w-9 items-center justify-center border border-brand-gold/35 bg-brand-black text-brand-gold">
                          <Icon className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <ArrowUpRight
                          className="h-4 w-4 text-brand-muted transition-colors group-hover:text-brand-gold"
                          aria-hidden="true"
                        />
                      </div>
                      <h3 className="heading-section mt-5 text-xl text-brand-white">
                        {title}
                      </h3>
                      <p className="mt-2 font-body text-xs leading-relaxed text-brand-muted">
                        {description}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>

            <section>
              <SectionHeading
                index="02"
                eyebrow={
                  unreadAnnouncementsCount > 0
                    ? `Dispatches • ${unreadAnnouncementsCount} Unread`
                    : 'Dispatches'
                }
                title="Community Announcements"
                action={
                  <Link
                    to={ROUTES.dashboardAnnouncements}
                    className="inline-flex items-center gap-1.5 font-heading text-xs tracking-[0.2em] text-brand-gold uppercase transition-colors hover:text-brand-cream"
                  >
                    All Announcements
                    <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                }
              />

              <div className="mt-6">
                {announcementsLoading ? (
                  <div className="h-32 animate-pulse border hairline-border bg-brand-charcoal/45" />
                ) : recentAnnouncements.length === 0 ? (
                  <EmptyState
                    icon={<Bell className="h-4 w-4" aria-hidden="true" />}
                    eyebrow="No Announcements Yet"
                    title="Official Community Bulletins Will Appear Here"
                    description="Official bulletins published by VATAR LIFESTYLE BY SOFT leadership will appear here."
                    compact
                  />
                ) : (
                  <div className="divide-y divide-brand-cream/10 border hairline-border bg-brand-charcoal/55">
                    {recentAnnouncements.slice(0, 3).map((item) => (
                      <Link
                        key={item.id}
                        to={ROUTES.dashboardAnnouncements}
                        className="block p-5 transition-colors hover:bg-brand-charcoal"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            {!item.is_read && (
                              <span
                                aria-label="Unread"
                                className="h-2 w-2 rounded-full bg-brand-gold"
                              />
                            )}
                            {item.is_pinned && <PinnedBadge />}
                            <AnnouncementPriorityBadge priority={item.priority} />
                            <span className="font-body text-[0.68rem] tracking-[0.18em] text-brand-gold uppercase">
                              {ANNOUNCEMENT_CATEGORY_LABELS[item.category]}
                            </span>
                          </div>
                          <span className="font-body text-xs text-brand-muted">
                            {formatDate(item.published_at ?? item.created_at)}
                          </span>
                        </div>
                        <h3 className="heading-section mt-2.5 text-lg text-brand-white">
                          {item.title}
                        </h3>
                        <p className="mt-1 line-clamp-2 font-body text-xs text-brand-muted">
                          {item.content}
                        </p>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* Right: Profile Completion Card */}
          <aside className="lg:col-span-4">
            <div className="border border-brand-gold/30 bg-brand-charcoal/70 p-6 sm:p-7">
              <p className="heading-eyebrow">Identity Readiness</p>
              <h2 className="heading-section mt-3 text-2xl text-brand-white">
                Profile Completion
              </h2>

              <div className="mt-5 flex items-baseline justify-between">
                <span className="font-heading text-4xl font-semibold text-brand-gold">
                  {completionPercent}%
                </span>
                <span className="font-body text-xs text-brand-muted">
                  {completedCount} of {completionItems.length} fields set
                </span>
              </div>

              <div
                aria-hidden="true"
                className="mt-3 h-1.5 w-full bg-brand-black"
              >
                <div
                  className="h-full bg-brand-gold transition-all duration-300"
                  style={{ width: `${completionPercent}%` }}
                />
              </div>

              <ul className="mt-6 space-y-3 border-t hairline-border pt-5">
                {completionItems.map((item) => (
                  <li
                    key={item.label}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="font-body text-brand-cream/85">
                      {item.label}
                    </span>
                    {item.complete ? (
                      <span className="inline-flex items-center gap-1.5 font-heading tracking-[0.14em] text-brand-gold uppercase">
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                        Set
                      </span>
                    ) : (
                      <span className="font-body text-brand-muted">Optional</span>
                    )}
                  </li>
                ))}
              </ul>

              <div className="mt-6 border-t hairline-border pt-5">
                <Button
                  to={ROUTES.dashboardProfile}
                  variant="secondary"
                  size="sm"
                  className="w-full"
                >
                  {completionPercent < 100 ? 'Complete Your Profile' : 'Update Profile'}
                </Button>
              </div>
            </div>
          </aside>
        </div>
      </PageContainer>
    </div>
  );
}
