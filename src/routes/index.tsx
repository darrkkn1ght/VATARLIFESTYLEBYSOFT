import { createBrowserRouter } from 'react-router-dom';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { PlaceholderPage } from '@/components/shared/PlaceholderPage';
import { HomePage } from '@/pages/public/HomePage';
import { NotFoundPage } from '@/pages/public/NotFoundPage';
import { ROUTES } from '@/routes/paths';
import type { NavItem } from '@/types/navigation';

const MEMBER_NAV_ITEMS: readonly NavItem[] = [
  { label: 'Overview', to: ROUTES.dashboard },
  { label: 'Profile', to: ROUTES.dashboardProfile },
  { label: 'Competitions', to: ROUTES.dashboardCompetitions },
  { label: 'Achievements', to: ROUTES.dashboardAchievements },
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
    element: <PublicLayout />,
    children: [
      {
        path: ROUTES.home,
        element: <HomePage />,
      },
      {
        path: ROUTES.about,
        element: (
          <PlaceholderPage
            eyebrow="Public"
            title="About"
            description="The story, ethos, and vision behind VATAR LIFESTYLE BY SOFT will live here."
          />
        ),
      },
      {
        path: ROUTES.membership,
        element: (
          <PlaceholderPage
            eyebrow="Public"
            title="Membership"
            description="Membership tiers, benefits, and onboarding details will be introduced in an upcoming milestone."
          />
        ),
      },
      {
        path: ROUTES.competitions,
        element: (
          <PlaceholderPage
            eyebrow="Public"
            title="Competitions"
            description="Upcoming events, schedules, and competition formats will be published here."
          />
        ),
      },
      {
        path: ROUTES.leaderboard,
        element: (
          <PlaceholderPage
            eyebrow="Public"
            title="Leaderboard"
            description="Community rankings and seasonal standings will be presented here."
          />
        ),
      },
      {
        path: ROUTES.marketplace,
        element: (
          <PlaceholderPage
            eyebrow="Public"
            title="Marketplace"
            description="Curated pieces and official releases will be introduced in a future milestone."
          />
        ),
      },
      {
        path: ROUTES.contact,
        element: (
          <PlaceholderPage
            eyebrow="Public"
            title="Contact"
            description="Direct inquiries and community contact channels will be configured here."
          />
        ),
      },
    ],
  },
  {
    element: <PortalLayout sectionLabel="Authentication" />,
    children: [
      {
        path: ROUTES.login,
        element: (
          <PlaceholderPage
            eyebrow="Authentication"
            title="Sign In"
            description="Member authentication is scheduled for a dedicated upcoming milestone."
          />
        ),
      },
      {
        path: ROUTES.register,
        element: (
          <PlaceholderPage
            eyebrow="Authentication"
            title="Register"
            description="Member registration and onboarding will be implemented in a future milestone."
          />
        ),
      },
    ],
  },
  {
    element: <PortalLayout sectionLabel="Member Portal" navItems={MEMBER_NAV_ITEMS} />,
    children: [
      {
        path: ROUTES.dashboard,
        element: (
          <PlaceholderPage
            eyebrow="Member"
            title="Member Dashboard"
            description="Your personal member overview will appear here once authentication and data services are connected."
          />
        ),
      },
      {
        path: ROUTES.dashboardProfile,
        element: (
          <PlaceholderPage
            eyebrow="Member"
            title="Profile"
            description="Member profile details and account preferences will be managed here."
          />
        ),
      },
      {
        path: ROUTES.dashboardCompetitions,
        element: (
          <PlaceholderPage
            eyebrow="Member"
            title="My Competitions"
            description="Registered competitions and event participation will be tracked here."
          />
        ),
      },
      {
        path: ROUTES.dashboardAchievements,
        element: (
          <PlaceholderPage
            eyebrow="Member"
            title="Achievements"
            description="Verified milestones and member honors will be displayed here."
          />
        ),
      },
    ],
  },
  {
    element: <PortalLayout sectionLabel="Administration" navItems={ADMIN_NAV_ITEMS} />,
    children: [
      {
        path: ROUTES.admin,
        element: (
          <PlaceholderPage
            eyebrow="Administration"
            title="Admin Overview"
            description="Administrative controls and operational summaries will be built in a future milestone."
          />
        ),
      },
      {
        path: ROUTES.adminMembers,
        element: (
          <PlaceholderPage
            eyebrow="Administration"
            title="Manage Members"
            description="Member directory and membership management tools will live here."
          />
        ),
      },
      {
        path: ROUTES.adminCompetitions,
        element: (
          <PlaceholderPage
            eyebrow="Administration"
            title="Manage Competitions"
            description="Competition creation, scheduling, and oversight will live here."
          />
        ),
      },
      {
        path: ROUTES.adminLeaderboard,
        element: (
          <PlaceholderPage
            eyebrow="Administration"
            title="Manage Leaderboard"
            description="Standings administration and ranking updates will live here."
          />
        ),
      },
      {
        path: ROUTES.adminMarketplace,
        element: (
          <PlaceholderPage
            eyebrow="Administration"
            title="Manage Marketplace"
            description="Catalog and release administration will be introduced in a future milestone."
          />
        ),
      },
      {
        path: ROUTES.adminAnnouncements,
        element: (
          <PlaceholderPage
            eyebrow="Administration"
            title="Announcements"
            description="Community announcements and communications management will live here."
          />
        ),
      },
    ],
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
]);
