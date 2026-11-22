import { lazy, Suspense, type ComponentType, type ReactElement } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { PageLoadingFallback } from '@/components/shared/PageLoadingFallback';
import {
  RedirectIfAuthenticated,
  RequireAdmin,
  RequireApprovedMember,
  RequireAuth,
} from '@/features/auth/components/RouteGuards';
import { ROUTES } from '@/routes/paths';
import type { NavItem } from '@/types/navigation';

// Public website pages (route-level code split)
const HomePage = lazy(() =>
  import('@/pages/public/HomePage').then((m) => ({ default: m.HomePage })),
);
const AboutPage = lazy(() =>
  import('@/pages/public/AboutPage').then((m) => ({ default: m.AboutPage })),
);
const MembershipPage = lazy(() =>
  import('@/pages/public/MembershipPage').then((m) => ({
    default: m.MembershipPage,
  })),
);
const CompetitionsPage = lazy(() =>
  import('@/pages/public/CompetitionsPage').then((m) => ({
    default: m.CompetitionsPage,
  })),
);
const LeaderboardPage = lazy(() =>
  import('@/pages/public/LeaderboardPage').then((m) => ({
    default: m.LeaderboardPage,
  })),
);
const MarketplacePage = lazy(() =>
  import('@/pages/public/MarketplacePage').then((m) => ({
    default: m.MarketplacePage,
  })),
);
const ContactPage = lazy(() =>
  import('@/pages/public/ContactPage').then((m) => ({
    default: m.ContactPage,
  })),
);
const NotFoundPage = lazy(() =>
  import('@/pages/public/NotFoundPage').then((m) => ({
    default: m.NotFoundPage,
  })),
);

// Authentication & password recovery pages
const LoginPage = lazy(() =>
  import('@/pages/public/LoginPage').then((m) => ({ default: m.LoginPage })),
);
const RegisterPage = lazy(() =>
  import('@/pages/public/RegisterPage').then((m) => ({
    default: m.RegisterPage,
  })),
);
const UpdatePasswordPage = lazy(() =>
  import('@/pages/public/UpdatePasswordPage').then((m) => ({
    default: m.UpdatePasswordPage,
  })),
);
const MembershipStatusPage = lazy(() =>
  import('@/pages/public/MembershipStatusPage').then((m) => ({
    default: m.MembershipStatusPage,
  })),
);

// Member Portal pages
const MemberOverviewPage = lazy(() =>
  import('@/pages/member/MemberOverviewPage').then((m) => ({
    default: m.MemberOverviewPage,
  })),
);
const MemberProfilePage = lazy(() =>
  import('@/pages/member/MemberProfilePage').then((m) => ({
    default: m.MemberProfilePage,
  })),
);
const MemberMembershipPage = lazy(() =>
  import('@/pages/member/MemberMembershipPage').then((m) => ({
    default: m.MemberMembershipPage,
  })),
);
const MemberAnnouncementsPage = lazy(() =>
  import('@/pages/member/MemberAnnouncementsPage').then((m) => ({
    default: m.MemberAnnouncementsPage,
  })),
);
const MemberActivityPage = lazy(() =>
  import('@/pages/member/MemberActivityPage').then((m) => ({
    default: m.MemberActivityPage,
  })),
);
const MemberCompetitionsPage = lazy(() =>
  import('@/pages/member/MemberCompetitionsPage').then((m) => ({
    default: m.MemberCompetitionsPage,
  })),
);
const MemberCompetitionDetailPage = lazy(() =>
  import('@/pages/member/MemberCompetitionDetailPage').then((m) => ({
    default: m.MemberCompetitionDetailPage,
  })),
);
const MemberLeaderboardPage = lazy(() =>
  import('@/pages/member/MemberLeaderboardPage').then((m) => ({
    default: m.MemberLeaderboardPage,
  })),
);
const MemberAchievementsPage = lazy(() =>
  import('@/pages/member/MemberAchievementsPage').then((m) => ({
    default: m.MemberAchievementsPage,
  })),
);
const MemberMarketplacePage = lazy(() =>
  import('@/pages/member/MemberMarketplacePage').then((m) => ({
    default: m.MemberMarketplacePage,
  })),
);
const MemberOrdersPage = lazy(() =>
  import('@/pages/member/MemberOrdersPage').then((m) => ({
    default: m.MemberOrdersPage,
  })),
);

// Admin Control Center pages
const AdminOverviewPage = lazy(() =>
  import('@/pages/admin/AdminOverviewPage').then((m) => ({
    default: m.AdminOverviewPage,
  })),
);
const AdminMembersPage = lazy(() =>
  import('@/pages/admin/AdminMembersPage').then((m) => ({
    default: m.AdminMembersPage,
  })),
);
const AdminCompetitionsPage = lazy(() =>
  import('@/pages/admin/AdminCompetitionsPage').then((m) => ({
    default: m.AdminCompetitionsPage,
  })),
);
const AdminLeaderboardPage = lazy(() =>
  import('@/pages/admin/AdminLeaderboardPage').then((m) => ({
    default: m.AdminLeaderboardPage,
  })),
);
const AdminMarketplacePage = lazy(() =>
  import('@/pages/admin/AdminMarketplacePage').then((m) => ({
    default: m.AdminMarketplacePage,
  })),
);
const AdminAnnouncementsPage = lazy(() =>
  import('@/pages/admin/AdminAnnouncementsPage').then((m) => ({
    default: m.AdminAnnouncementsPage,
  })),
);

function withSuspense(Component: ComponentType): ReactElement {
  return (
    <Suspense fallback={<PageLoadingFallback />}>
      <Component />
    </Suspense>
  );
}

const MEMBER_NAV_ITEMS: readonly NavItem[] = [
  { label: 'Overview', to: ROUTES.dashboard },
  { label: 'My Profile', to: ROUTES.dashboardProfile },
  { label: 'My Membership', to: ROUTES.dashboardMembership },
  { label: 'Announcements', to: ROUTES.dashboardAnnouncements },
  { label: 'Community Activity', to: ROUTES.dashboardActivity },
  { label: 'Competitions', to: ROUTES.dashboardCompetitions },
  { label: 'Leaderboard', to: ROUTES.dashboardLeaderboard },
  { label: 'Achievements', to: ROUTES.dashboardAchievements },
  { label: 'Marketplace', to: ROUTES.dashboardMarketplace },
  { label: 'My Orders', to: ROUTES.dashboardMarketplaceOrders },
];

const ADMIN_NAV_ITEMS: readonly NavItem[] = [
  { label: 'Overview', to: ROUTES.admin },
  { label: 'Members', to: ROUTES.adminMembers },
  { label: 'Competitions', to: ROUTES.adminCompetitions },
  { label: 'Leaderboard', to: ROUTES.adminLeaderboard },
  { label: 'Marketplace', to: ROUTES.adminMarketplace },
  { label: 'Announcements', to: ROUTES.adminAnnouncements },
];

export const router = createBrowserRouter([
  // Public website
  {
    element: <PublicLayout />,
    children: [
      { path: ROUTES.home, element: withSuspense(HomePage) },
      { path: ROUTES.about, element: withSuspense(AboutPage) },
      { path: ROUTES.membership, element: withSuspense(MembershipPage) },
      { path: ROUTES.competitions, element: withSuspense(CompetitionsPage) },
      { path: ROUTES.leaderboard, element: withSuspense(LeaderboardPage) },
      { path: ROUTES.marketplace, element: withSuspense(MarketplacePage) },
      { path: ROUTES.contact, element: withSuspense(ContactPage) },
    ],
  },

  // Authentication pages (redirect away if already signed in)
  {
    element: <RedirectIfAuthenticated />,
    children: [
      { path: ROUTES.login, element: withSuspense(LoginPage) },
      { path: ROUTES.register, element: withSuspense(RegisterPage) },
    ],
  },

  // Password recovery completion route
  {
    path: ROUTES.updatePassword,
    element: withSuspense(UpdatePasswordPage),
  },

  // Authenticated membership status page (accessible to pending/approved/rejected/suspended users)
  {
    element: <RequireAuth />,
    children: [
      {
        path: ROUTES.membershipStatus,
        element: withSuspense(MembershipStatusPage),
      },
    ],
  },

  // Protected Member Portal (requires authenticated + approved membership)
  {
    element: <RequireApprovedMember />,
    children: [
      {
        element: <PortalLayout sectionLabel="Member Portal" navItems={MEMBER_NAV_ITEMS} />,
        children: [
          { path: ROUTES.dashboard, element: withSuspense(MemberOverviewPage) },
          { path: ROUTES.dashboardProfile, element: withSuspense(MemberProfilePage) },
          { path: ROUTES.dashboardMembership, element: withSuspense(MemberMembershipPage) },
          { path: ROUTES.dashboardAnnouncements, element: withSuspense(MemberAnnouncementsPage) },
          { path: ROUTES.dashboardActivity, element: withSuspense(MemberActivityPage) },
          { path: ROUTES.dashboardCompetitions, element: withSuspense(MemberCompetitionsPage) },
          { path: ROUTES.dashboardCompetitionDetail, element: withSuspense(MemberCompetitionDetailPage) },
          { path: ROUTES.dashboardLeaderboard, element: withSuspense(MemberLeaderboardPage) },
          { path: ROUTES.dashboardAchievements, element: withSuspense(MemberAchievementsPage) },
          { path: ROUTES.dashboardMarketplace, element: withSuspense(MemberMarketplacePage) },
          { path: ROUTES.dashboardMarketplaceOrders, element: withSuspense(MemberOrdersPage) },
        ],
      },
    ],
  },

  // Protected Administration routes (requires database-backed active admin or super_admin role)
  {
    element: <RequireAdmin />,
    children: [
      {
        element: <PortalLayout sectionLabel="Administration" navItems={ADMIN_NAV_ITEMS} />,
        children: [
          { path: ROUTES.admin, element: withSuspense(AdminOverviewPage) },
          { path: ROUTES.adminMembers, element: withSuspense(AdminMembersPage) },
          { path: ROUTES.adminCompetitions, element: withSuspense(AdminCompetitionsPage) },
          { path: ROUTES.adminLeaderboard, element: withSuspense(AdminLeaderboardPage) },
          { path: ROUTES.adminMarketplace, element: withSuspense(AdminMarketplacePage) },
          { path: ROUTES.adminAnnouncements, element: withSuspense(AdminAnnouncementsPage) },
        ],
      },
    ],
  },

  {
    path: '*',
    element: withSuspense(NotFoundPage),
  },
]);
