import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import {
  isSupabaseConfigured,
  supabase,
  supabaseConfig,
} from '@/lib/supabase/client';
import type {
  AppRole,
  MembershipRecord,
  ProfileRecord,
} from '@/lib/supabase/database.types';
import {
  fetchUserAccountData,
  sendPasswordResetEmail,
  signInMember,
  signOutMember,
  signUpMember,
  updateUserPassword,
} from '@/features/auth/services/authService';
import type {
  AccountDataError,
  AuthContextValue,
  LoginPayload,
  RegisterPayload,
} from '@/features/auth/types/auth.types';

export const AuthContext = createContext<AuthContextValue | null>(null);

const FOCUS_REVALIDATION_MIN_INTERVAL_MS = 15_000;

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [membership, setMembership] = useState<MembershipRecord | null>(null);
  const [roles, setRoles] = useState<readonly AppRole[]>([]);
  const [accountError, setAccountError] = useState<AccountDataError | null>(null);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [isLoading, setIsLoading] = useState<boolean>(isSupabaseConfigured);

  const requestSeqRef = useRef(0);
  const isMountedRef = useRef(true);
  const lastFetchedAtRef = useRef(0);
  const loadedUserIdRef = useRef<string | null>(null);

  const clearAccountState = useCallback(() => {
    loadedUserIdRef.current = null;
    setProfile(null);
    setMembership(null);
    setRoles([]);
    setAccountError(null);
  }, []);

  const loadAccountData = useCallback(async (userId: string) => {
    const requestId = ++requestSeqRef.current;

    const account = await fetchUserAccountData(userId);

    if (!isMountedRef.current || requestId !== requestSeqRef.current) {
      return;
    }

    loadedUserIdRef.current = userId;
    lastFetchedAtRef.current = Date.now();
    setProfile(account.profile);
    setMembership(account.membership);
    setRoles(account.roles);
    setAccountError(account.error);
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    const client = supabase;

    if (!client) {
      setIsLoading(false);
      return;
    }

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event, nextSession) => {
      if (!isMountedRef.current) return;

      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true);
      } else if (event === 'SIGNED_OUT') {
        setIsPasswordRecovery(false);
      }

      const nextUser = nextSession?.user ?? null;
      setSession(nextSession);
      setUser(nextUser);

      if (!nextUser) {
        requestSeqRef.current += 1;
        clearAccountState();
        setIsLoading(false);
        return;
      }

      const alreadyLoadedSameUser = loadedUserIdRef.current === nextUser.id;

      // Never flip isLoading=true when the same user is already loaded (e.g. Safari
      // tab switch / TOKEN_REFRESHED / duplicate SIGNED_IN), otherwise RouteGuards
      // unmount the active page and wipe open forms & 2FA modals!
      if (alreadyLoadedSameUser) {
        if (Date.now() - lastFetchedAtRef.current < FOCUS_REVALIDATION_MIN_INTERVAL_MS) {
          return;
        }
        queueMicrotask(() => {
          if (!isMountedRef.current) return;
          void loadAccountData(nextUser.id);
        });
        return;
      }

      const fetchToken = requestSeqRef.current + 1;
      setIsLoading(true);

      queueMicrotask(() => {
        if (!isMountedRef.current) return;
        void loadAccountData(nextUser.id).finally(() => {
          if (isMountedRef.current && requestSeqRef.current === fetchToken) {
            setIsLoading(false);
          }
        });
      });
    });

    return () => {
      isMountedRef.current = false;
      requestSeqRef.current += 1;
      subscription.unsubscribe();
    };
  }, [loadAccountData, clearAccountState]);

  // Re-evaluate membership & role authorization when the tab regains focus
  // so suspended/rejected users or revoked admins lose access promptly.
  useEffect(() => {
    if (!user) return;

    const revalidateIfStale = () => {
      if (document.visibilityState === 'hidden') return;
      if (Date.now() - lastFetchedAtRef.current < FOCUS_REVALIDATION_MIN_INTERVAL_MS) {
        return;
      }
      void loadAccountData(user.id);
    };

    window.addEventListener('focus', revalidateIfStale);
    document.addEventListener('visibilitychange', revalidateIfStale);
    return () => {
      window.removeEventListener('focus', revalidateIfStale);
      document.removeEventListener('visibilitychange', revalidateIfStale);
    };
  }, [user, loadAccountData]);

  const refreshAccountData = useCallback(async () => {
    if (!user) return;
    await loadAccountData(user.id);
  }, [user, loadAccountData]);

  const signIn = useCallback(async (payload: LoginPayload) => {
    return signInMember(payload);
  }, []);

  const signUp = useCallback(async (payload: RegisterPayload) => {
    return signUpMember(payload);
  }, []);

  const signOut = useCallback(async () => {
    const result = await signOutMember();
    if (!result.error) {
      requestSeqRef.current += 1;
      setSession(null);
      setUser(null);
      setIsPasswordRecovery(false);
      clearAccountState();
    }
    return result;
  }, [clearAccountState]);

  const requestPasswordReset = useCallback(async (email: string) => {
    return sendPasswordResetEmail(email);
  }, []);

  const updatePassword = useCallback(async (newPassword: string) => {
    const result = await updateUserPassword(newPassword);
    if (!result.error) {
      setIsPasswordRecovery(false);
    }
    return result;
  }, []);

  const hasRole = useCallback(
    (role: AppRole) => {
      const status = membership?.status ?? null;
      if (status === 'suspended' || status === 'rejected') return false;
      return roles.includes(role);
    },
    [roles, membership?.status],
  );

  const value = useMemo<AuthContextValue>(() => {
    const membershipStatus = membership?.status ?? null;
    const isBlocked =
      membershipStatus === 'suspended' || membershipStatus === 'rejected';
    const isSuperAdmin = !isBlocked && roles.includes('super_admin');
    const isAdmin = !isBlocked && (isSuperAdmin || roles.includes('admin'));

    return {
      session,
      user,
      profile,
      membership,
      membershipStatus,
      roles,
      accountError,
      isConfigured: isSupabaseConfigured,
      configError: supabaseConfig.errorMessage,
      isLoading,
      isAuthenticated: Boolean(session && user),
      isApprovedMember: Boolean(session && user && membershipStatus === 'approved'),
      isAdmin,
      isSuperAdmin,
      isPasswordRecovery,
      hasRole,
      signIn,
      signUp,
      signOut,
      requestPasswordReset,
      updatePassword,
      refreshAccountData,
    };
  }, [
    session,
    user,
    profile,
    membership,
    roles,
    accountError,
    isLoading,
    isPasswordRecovery,
    hasRole,
    signIn,
    signUp,
    signOut,
    requestPasswordReset,
    updatePassword,
    refreshAccountData,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
