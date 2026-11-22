import type { Session, User } from '@supabase/supabase-js';
import type {
  AppRole,
  MembershipRecord,
  MembershipStatus,
  ProfileRecord,
} from '@/lib/supabase/database.types';

export interface RegisterPayload {
  fullName: string;
  email: string;
  username: string;
  lagosLifeUsername: string;
  password: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface AccountDataError {
  code: string | null;
  message: string;
  sources: readonly ('profiles' | 'memberships' | 'user_roles' | 'config')[];
}

export interface UserAccountData {
  profile: ProfileRecord | null;
  membership: MembershipRecord | null;
  roles: readonly AppRole[];
  error: AccountDataError | null;
}

export interface AuthActionResult {
  error: string | null;
  requiresEmailVerification?: boolean;
}

export interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: ProfileRecord | null;
  membership: MembershipRecord | null;
  membershipStatus: MembershipStatus | null;
  roles: readonly AppRole[];
  accountError: AccountDataError | null;
  isConfigured: boolean;
  configError: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isApprovedMember: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isPasswordRecovery: boolean;
  hasRole: (role: AppRole) => boolean;
  signIn: (payload: LoginPayload) => Promise<AuthActionResult>;
  signUp: (payload: RegisterPayload) => Promise<AuthActionResult>;
  signOut: () => Promise<AuthActionResult>;
  requestPasswordReset: (email: string) => Promise<AuthActionResult>;
  updatePassword: (newPassword: string) => Promise<AuthActionResult>;
  refreshAccountData: () => Promise<void>;
}
