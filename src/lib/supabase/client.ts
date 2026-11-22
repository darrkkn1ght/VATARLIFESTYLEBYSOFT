import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

export interface SupabaseConfigStatus {
  isConfigured: boolean;
  missingKeys: readonly string[];
  errorMessage: string | null;
}

function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function evaluateSupabaseConfig(): {
  status: SupabaseConfigStatus;
  url: string | null;
  anonKey: string | null;
} {
  const rawUrl = (import.meta.env.VITE_SUPABASE_URL ?? '').trim();
  const rawAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim();

  const missingKeys: string[] = [];
  if (!rawUrl) missingKeys.push('VITE_SUPABASE_URL');
  if (!rawAnonKey) missingKeys.push('VITE_SUPABASE_ANON_KEY');

  if (missingKeys.length > 0) {
    return {
      status: {
        isConfigured: false,
        missingKeys,
        errorMessage: `Supabase is not configured. Missing environment variable(s): ${missingKeys.join(', ')}.`,
      },
      url: null,
      anonKey: null,
    };
  }

  if (!isValidHttpUrl(rawUrl)) {
    return {
      status: {
        isConfigured: false,
        missingKeys: [],
        errorMessage:
          'VITE_SUPABASE_URL must be a valid http:// or https:// URL.',
      },
      url: null,
      anonKey: null,
    };
  }

  return {
    status: {
      isConfigured: true,
      missingKeys: [],
      errorMessage: null,
    },
    url: rawUrl,
    anonKey: rawAnonKey,
  };
}

const evaluated = evaluateSupabaseConfig();

export const supabaseConfig: SupabaseConfigStatus = evaluated.status;
export const isSupabaseConfigured: boolean = evaluated.status.isConfigured;

export const supabase: SupabaseClient<Database> | null =
  evaluated.url && evaluated.anonKey
    ? createClient<Database>(evaluated.url, evaluated.anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    : null;
