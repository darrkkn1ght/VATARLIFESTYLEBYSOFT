import { supabase, supabaseConfig } from '@/lib/supabase/client';
import type { ProfileRecord } from '@/lib/supabase/database.types';

export interface UpdateMemberProfilePayload {
  fullName: string;
  username: string;
  lagosLifeUsername: string;
  bio: string;
}

export interface UpdateMemberProfileResult {
  profile: ProfileRecord | null;
  error: string | null;
}

export async function updateMemberProfile(
  userId: string,
  payload: UpdateMemberProfilePayload,
): Promise<UpdateMemberProfileResult> {
  if (!supabase) {
    return {
      profile: null,
      error: supabaseConfig.errorMessage ?? 'Supabase client is not configured.',
    };
  }

  const trimmedBio = payload.bio.trim();

  // Only update columns permitted by public.profiles RLS (profiles_update_own).
  // Never attempt to modify id, created_at, roles, or membership status.
  const { data, error } = await supabase
    .from('profiles')
    .update({
      full_name: payload.fullName.trim(),
      username: payload.username.trim(),
      lagos_life_username: payload.lagosLifeUsername.trim(),
      bio: trimmedBio.length > 0 ? trimmedBio : null,
    })
    .eq('id', userId)
    .select('*')
    .single();

  if (error) {
    if (error.code === '23505') {
      return {
        profile: null,
        error: 'That VATAR username is already taken. Choose another handle.',
      };
    }

    return {
      profile: null,
      error: error.message,
    };
  }

  return {
    profile: data ?? null,
    error: null,
  };
}
