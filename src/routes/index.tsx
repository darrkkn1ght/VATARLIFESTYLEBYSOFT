import { createBrowserRouter } from 'react-router-dom';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { RouteErrorFallback } from '@/components/shared/RouteErrorFallback';
import {
  RedirectIfAuthenticated,
  RequireAdmin,
  RequireApprovedMember,
  RequireAuth,
} from '@/features/auth/components/RouteGuards';
import { AdminAnnouncementsPage } from '@/pages/admin/AdminAnnouncementsPage';
import { AdminCompetitionsPage } from '@/pages/admin/AdminCompetitionsPage';
import { AdminLeaderboardPage } from '@/pages/admin/AdminLeaderboardPage';
import { AdminMarketplacePage } from '@/pages/admin/AdminMarketplacePage';
import { AdminMembersPage } from '@/pages/admin/AdminMembersPage';
import { AdminOverviewPage } from '@/pages/admin/AdminOverviewPage';
import { MemberAchievementsPage } from '@/pages/member/MemberAchievementsPage';
import { MemberActivityPage } from '@/pages/member/MemberActivityPage';
import { MemberAnnouncementsPage } from '@/pages/member/MemberAnnouncementsPage';
import { MemberCompetitionDetailPage } from '@/pages/member/MemberCompetitionDetailPage';
import { MemberCompetitionsPage } from '@/pages/member/MemberCompetitionsPage';
import { MemberLeaderboardPage } from '@/pages/member/MemberLeaderboardPage';
import { MemberMarketplacePage } from '@/pages/member/MemberMarketplacePage';
import { MemberMembershipPage } from '@/pages/member/MemberMembershipPage';
import { MemberOrdersPage } from '@/pages/member/MemberOrdersPage';
import { MemberOverviewPage } from '@/pages/member/MemberOverviewPage';
import { MemberProfilePage } from '@/pages/member/MemberProfilePage';
import { MemberTreasuryPage } from '@/pages/member/MemberTreasuryPage';
import { MemberVendorsPage } from '@/pages/member/MemberVendorsPage';
import { AboutPage } from '@/pages/public/AboutPage';
import { CompetitionsPage } from '@/pages/public/CompetitionsPage';
import { ContactPage } from '@/pages/public/ContactPage';
import { HomePage } from '@/pages/public/HomePage';
import { LeaderboardPage } from '@/pages/public/LeaderboardPage';
import { LoginPage } from '@/pages/public/LoginPage';
import { MarketplacePage } from '@/pages/public/MarketplacePage';
import { MembershipPage } from '@/pages/public/MembershipPage';
import { MembershipStatusPage } from '@/pages/public/MembershipStatusPage';
import { NotFoundPage } from '@/pages/public/NotFoundPage';
import { RegisterPage } from '@/pages/public/RegisterPage';
import { UpdatePasswordPage } from '@/pages/public/UpdatePasswordPage';
import { ROUTES } from '@/routes/paths';
import type { NavItem } from '@/types/navigation';

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
  { label: 'Vendors', to: ROUTES.dashboardVendors },
  { label: 'My Orders', to: ROUTES.dashboardMarketplaceOrders },
  { label: 'Treasury', to: ROUTES.dashboardTreasury },
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
  {
    errorElement: <RouteErrorFallback />,
    children: [
      // Public website
      {
        element: <PublicLayout />,
        children: [
          { path: ROUTES.home, element: <HomePage /> },
          { path: ROUTES.about, element: <AboutPage /> },
          { path: ROUTES.membership, element: <MembershipPage /> },
          { path: ROUTES.competitions, element: <CompetitionsPage /> },
          { path: ROUTES.leaderboard, element: <LeaderboardPage /> },
          { path: ROUTES.marketplace, element: <MarketplacePage /> },
          { path: ROUTES.contact, element: <ContactPage /> },
        ],
      },

      // Authentication pages (redirect away if already signed in)
      {
        element: <RedirectIfAuthenticated />,
        children: [
          { path: ROUTES.login, element: <LoginPage /> },
          { path: ROUTES.register, element: <RegisterPage /> },
        ],
      },

      // Password recovery completion route
      {
        path: ROUTES.updatePassword,
        element: <UpdatePasswordPage />,
      },

      // Authenticated membership status page (accessible to pending/approved/rejected/suspended users)
      {
        element: <RequireAuth />,
        children: [
          {
            path: ROUTES.membershipStatus,
            element: <MembershipStatusPage />,
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
              { path: ROUTES.dashboard, element: <MemberOverviewPage /> },
              { path: ROUTES.dashboardProfile, element: <MemberProfilePage /> },
              { path: ROUTES.dashboardMembership, element: <MemberMembershipPage /> },
              { path: ROUTES.dashboardAnnouncements, element: <MemberAnnouncementsPage /> },
              { path: ROUTES.dashboardActivity, element: <MemberActivityPage /> },
              { path: ROUTES.dashboardCompetitions, element: <MemberCompetitionsPage /> },
              { path: ROUTES.dashboardCompetitionDetail, element: <MemberCompetitionDetailPage /> },
              { path: ROUTES.dashboardLeaderboard, element: <MemberLeaderboardPage /> },
              { path: ROUTES.dashboardAchievements, element: <MemberAchievementsPage /> },
              { path: ROUTES.dashboardMarketplace, element: <MemberMarketplacePage /> },
              { path: ROUTES.dashboardVendors, element: <MemberVendorsPage /> },
              { path: ROUTES.dashboardVendorStore, element: <MemberVendorsPage /> },
              { path: ROUTES.dashboardMarketplaceOrders, element: <MemberOrdersPage /> },
              { path: ROUTES.dashboardTreasury, element: <MemberTreasuryPage /> },
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
              { path: ROUTES.admin, element: <AdminOverviewPage /> },
              { path: ROUTES.adminMembers, element: <AdminMembersPage /> },
              { path: ROUTES.adminCompetitions, element: <AdminCompetitionsPage /> },
              { path: ROUTES.adminLeaderboard, element: <AdminLeaderboardPage /> },
              { path: ROUTES.adminMarketplace, element: <AdminMarketplacePage /> },
              { path: ROUTES.adminAnnouncements, element: <AdminAnnouncementsPage /> },
            ],
          },
        ],
      },

      {
        path: '*',
        element: <NotFoundPage />,
      },
    ],
  },
]);
