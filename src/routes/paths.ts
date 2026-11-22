export const ROUTES = {
  // Public
  home: '/',
  about: '/about',
  membership: '/membership',
  competitions: '/competitions',
  leaderboard: '/leaderboard',
  marketplace: '/marketplace',
  contact: '/contact',

  // Authentication
  login: '/login',
  register: '/register',

  // Member
  dashboard: '/dashboard',
  dashboardProfile: '/dashboard/profile',
  dashboardCompetitions: '/dashboard/competitions',
  dashboardAchievements: '/dashboard/achievements',

  // Administration
  admin: '/admin',
  adminMembers: '/admin/members',
  adminCompetitions: '/admin/competitions',
  adminLeaderboard: '/admin/leaderboard',
  adminMarketplace: '/admin/marketplace',
  adminAnnouncements: '/admin/announcements',
} as const;
