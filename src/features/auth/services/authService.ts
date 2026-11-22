import { supabase, supabaseConfig } from '@/lib/supabase/client';
import type { AppRole } from '@/lib/supabase/database.types';
import type {
  AccountDataError,
  AuthActionResult,
  LoginPayload,
  RegisterPayload,
  UserAccountData,
} from '@/features/auth/types/auth.types';

function unconfiguredError(): AuthActionResult {
  return {
    error:
      supabaseConfig.errorMessage ??
      'Authentication service is not configured yet.',
  };
}

export async function signUpMember(
  payload: RegisterPayload,
): Promise<AuthActionResult> {
  if (!supabase) return unconfiguredError();

  // Never send role or membership status from the frontend.
  // The database trigger enforces pending membership status and prevents role escalation.
  const { data, error } = await supabase.auth.signUp({
    email: payload.email.trim().toLowerCase(),
    password: payload.password,
    options: {
      data: {
        full_name: payload.fullName.trim(),
        username: payload.username.trim(),
        lagos_life_username: payload.lagosLifeUsername.trim(),
      },
    },
  });

  if (error) {
    return { error: error.message };
  }

  return {
    error: null,
    requiresEmailVerification: !data.session,
  };
}

export async function signInMember(
  payload: LoginPayload,
): Promise<AuthActionResult> {
  if (!supabase) return unconfiguredError();

  const { error } = await supabase.auth.signInWithPassword({
    email: payload.email.trim().toLowerCase(),
    password: payload.password,
  });

  if (error) {
    return { error: error.message };
  }

  return { error: null };
}

export async function signOutMember(): Promise<AuthActionResult> {
  if (!supabase) return unconfiguredError();

  const { error } = await supabase.auth.signOut();
  if (error) {
    return { error: error.message };
  }

  return { error: null };
}

export async function sendPasswordResetEmail(
  email: string,
): Promise<AuthActionResult> {
  if (!supabase) return unconfiguredError();

  const redirectTo =
    typeof window !== 'undefined'
      ? `${window.location.origin}/update-password`
      : undefined;

  const { error } = await supabase.auth.resetPasswordForEmail(
    email.trim().toLowerCase(),
    { redirectTo },
  );

  if (error) {
    return { error: error.message };
  }

  return { error: null };
}

export async function updateUserPassword(
  newPassword: string,
): Promise<AuthActionResult> {
  if (!supabase) return unconfiguredError();

  if (newPassword.length < 8) {
    return { error: 'New password must be at least 8 characters long.' };
  }

  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) {
    return { error: error.message };
  }

  return { error: null };
}

export async function fetchUserAccountData(
  userId: string,
): Promise<UserAccountData> {
  if (!supabase) {
    return {
      profile: null,
      membership: null,
      roles: [],
      error: {
        code: null,
        message:
          supabaseConfig.errorMessage ??
          'Supabase client is not configured.',
        sources: ['config'],
      },
    };
  }

  const [profileRes, membershipRes, rolesRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
    supabase.from('memberships').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('user_roles').select('role').eq('user_id', userId),
  ]);

  const sources: Array<'profiles' | 'memberships' | 'user_roles'> = [];
  const messages: string[] = [];
  let primaryCode: string | null = null;

  if (profileRes.error) {
    sources.push('profiles');
    primaryCode ??= profileRes.error.code ?? null;
    messages.push(`profiles: ${profileRes.error.message}`);
  }

  if (membershipRes.error) {
    sources.push('memberships');
    primaryCode ??= membershipRes.error.code ?? null;
    messages.push(`memberships: ${membershipRes.error.message}`);
  }

  if (rolesRes.error) {
    sources.push('user_roles');
    primaryCode ??= rolesRes.error.code ?? null;
    messages.push(`user_roles: ${rolesRes.error.message}`);
  }

  const error: AccountDataError | null =
    sources.length > 0
      ? {
          code: primaryCode,
          message: messages.join(' | '),
          sources,
        }
      : null;

  const roles: AppRole[] = rolesRes.error
    ? []
    : (rolesRes.data ?? []).map((entry) => entry.role);

  return {
    profile: profileRes.error ? null : (profileRes.data ?? null),
    membership: membershipRes.error ? null : (membershipRes.data ?? null),
    roles,
    error,
  };
}
