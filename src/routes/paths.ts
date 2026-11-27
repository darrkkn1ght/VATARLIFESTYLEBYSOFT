export const ROUTES = {
  // Public
  home: '/',
  about: '/about',
  membership: '/membership',
  competitions: '/competitions',
  leaderboard: '/leaderboard',
  marketplace: '/marketplace',
  contact: '/contact',

  // Authentication & Approval Status
  login: '/login',
  register: '/register',
  updatePassword: '/update-password',
  membershipStatus: '/membership-status',

  // Member
  dashboard: '/dashboard',
  dashboardProfile: '/dashboard/profile',
  dashboardMembership: '/dashboard/membership',
  dashboardAnnouncements: '/dashboard/announcements',
  dashboardActivity: '/dashboard/activity',
  dashboardCompetitions: '/dashboard/competitions',
  dashboardCompetitionDetail: '/dashboard/competitions/:id',
  dashboardLeaderboard: '/dashboard/leaderboard',
  dashboardAchievements: '/dashboard/achievements',
  dashboardMarketplace: '/dashboard/marketplace',
  dashboardMarketplaceOrders: '/dashboard/marketplace/orders',
  dashboardDataHub: '/dashboard/data-hub',
  dashboardTreasury: '/dashboard/treasury',

  // Administration
  admin: '/admin',
  adminMembers: '/admin/members',
  adminCompetitions: '/admin/competitions',
  adminLeaderboard: '/admin/leaderboard',
  adminMarketplace: '/admin/marketplace',
  adminAnnouncements: '/admin/announcements',
} as const;
