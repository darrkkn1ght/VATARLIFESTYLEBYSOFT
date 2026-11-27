import { supabase } from '@/lib/supabase/client';
import type { PublicReviewRow, SiteReviewRecord } from '@/lib/supabase/database.types';

export async function fetchPublicReviews(limit = 24): Promise<{
  reviews: PublicReviewRow[];
  error: string | null;
}> {
  if (!supabase) return { reviews: [], error: null };
  const { data, error } = await supabase.rpc('get_public_reviews', { p_limit: limit });
  if (error) return { reviews: [], error: error.message };
  return { reviews: Array.isArray(data) ? data : [], error: null };
}

export async function submitSiteReview(
  rating: number,
  comment: string,
): Promise<{ review: SiteReviewRecord | null; error: string | null }> {
  if (!supabase) return { review: null, error: 'Supabase is not configured.' };
  const { data, error } = await supabase.rpc('submit_site_review', {
    p_rating: rating,
    p_comment: comment.trim(),
  });
  if (error) return { review: null, error: error.message };
  return { review: data, error: null };
}
