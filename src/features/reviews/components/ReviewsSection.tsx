import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { CheckCircle2, Crown, Loader2, MessageSquarePlus, Star } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/features/auth/hooks/useAuth';
import {
  fetchPublicReviews,
  submitSiteReview,
} from '@/features/reviews/services/reviewService';
import type { PublicReviewRow } from '@/lib/supabase/database.types';
import { ROUTES } from '@/routes/paths';

export function ReviewsSection() {
  const { user, isApprovedMember } = useAuth();

  const [reviews, setReviews] = useState<PublicReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const loadReviews = useCallback(async () => {
    const res = await fetchPublicReviews(24);
    if (!res.error) {
      setReviews(res.reviews);
      if (user) {
        const mine = res.reviews.find((r) => r.user_id === user.id);
        if (mine) {
          setRating(mine.rating);
          setComment(mine.comment);
        }
      }
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void loadReviews();
  }, [loadReviews]);

  const stats = useMemo(() => {
    if (reviews.length === 0) return { avg: 5.0, count: 0 };
    const total = reviews.reduce((sum, r) => sum + r.rating, 0);
    return { avg: total / reviews.length, count: reviews.length };
  }, [reviews]);

  const myExistingReview = useMemo(
    () => (user ? reviews.find((r) => r.user_id === user.id) ?? null : null),
    [reviews, user],
  );

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setFeedback(null);
    if (comment.trim().length < 5) {
      setError('Please write at least 5 characters for your review.');
      return;
    }

    setSubmitting(true);
    const res = await submitSiteReview(rating, comment);
    setSubmitting(false);

    if (res.error) {
      setError(res.error);
      return;
    }

    setFeedback(
      myExistingReview
        ? 'Your verified review has been updated!'
        : 'Thank you! Your verified review is now live.',
    );
    setShowForm(false);
    await loadReviews();
  };

  return (
    <section className="border hairline-border bg-brand-charcoal/55 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="heading-eyebrow flex items-center gap-1.5">
            <Star className="h-3.5 w-3.5 fill-brand-gold text-brand-gold" />
            Verified Member Reviews
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h2 className="heading-section text-2xl text-brand-white">
              {stats.count > 0 ? `${stats.avg.toFixed(1)} / 5.0` : 'Community Reviews'}
            </h2>
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  className={`h-4 w-4 ${
                    s <= Math.round(stats.avg)
                      ? 'fill-brand-gold text-brand-gold'
                      : 'text-brand-muted/40'
                  }`}
                />
              ))}
            </div>
            <span className="font-mono text-xs text-brand-muted">
              ({stats.count} {stats.count === 1 ? 'review' : 'reviews'})
            </span>
          </div>
        </div>

        {isApprovedMember ? (
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowForm((prev) => !prev)}
          >
            <MessageSquarePlus className="h-3.5 w-3.5" />
            {myExistingReview ? 'Edit My Review' : 'Write a Review'}
          </Button>
        ) : (
          <Button to={ROUTES.login} variant="secondary" size="sm">
            Sign In to Review
          </Button>
        )}
      </div>

      {feedback && (
        <div className="mt-4 flex items-center gap-2 border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-xs text-emerald-200">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
          {feedback}
        </div>
      )}

      {error && (
        <div className="mt-4 border border-rose-500/40 bg-rose-500/10 px-4 py-2.5 text-xs text-rose-200">
          {error}
        </div>
      )}

      {/* Review Submission Form */}
      {showForm && isApprovedMember && (
        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="mt-4 space-y-3 border border-brand-gold/40 bg-brand-black/80 p-4"
        >
          <div>
            <p className="font-heading text-[0.65rem] tracking-[0.18em] text-brand-cream uppercase">
              Your Rating
            </p>
            <div className="mt-2 flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((star) => {
                const active = star <= (hoverRating ?? rating);
                return (
                  <button
                    key={star}
                    type="button"
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(null)}
                    onClick={() => setRating(star)}
                    className="cursor-pointer p-0.5 transition-transform hover:scale-110"
                    aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
                  >
                    <Star
                      className={`h-6 w-6 ${
                        active
                          ? 'fill-brand-gold text-brand-gold'
                          : 'text-brand-muted/40'
                      }`}
                    />
                  </button>
                );
              })}
              <span className="ml-2 font-mono text-xs text-brand-gold">
                {rating} / 5
              </span>
            </div>
          </div>

          <div>
            <textarea
              rows={3}
              maxLength={400}
              required
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Share your real experience with VATAR LIFESTYLE BY SOFT..."
              className="w-full border hairline-border bg-brand-charcoal p-3 font-body text-sm text-brand-white placeholder:text-brand-muted/60 focus:border-brand-gold focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowForm(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Posting...
                </>
              ) : myExistingReview ? (
                'Update Review'
              ) : (
                'Post Verified Review'
              )}
            </Button>
          </div>
        </form>
      )}

      {/* Reviews Grid */}
      {loading ? (
        <div className="mt-4 text-xs text-brand-muted">Loading reviews...</div>
      ) : reviews.length === 0 ? (
        <p className="mt-4 font-body text-xs text-brand-muted">
          No reviews yet — be the first verified member to leave a 5-star rating!
        </p>
      ) : (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {reviews.slice(0, 9).map((rev) => (
            <article
              key={rev.id}
              className="flex flex-col justify-between border hairline-border bg-brand-black/70 p-4"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={`h-3.5 w-3.5 ${
                          s <= rev.rating
                            ? 'fill-brand-gold text-brand-gold'
                            : 'text-brand-muted/35'
                        }`}
                      />
                    ))}
                  </div>
                  {rev.vip_tier && (
                    <span className="inline-flex items-center gap-1 border border-brand-gold/40 bg-brand-gold/10 px-1.5 py-0.5 font-heading text-[9px] tracking-[0.14em] text-brand-gold uppercase">
                      <Crown className="h-2.5 w-2.5" />
                      {rev.vip_tier}
                    </span>
                  )}
                </div>
                <p className="mt-2.5 font-body text-xs leading-relaxed text-brand-cream/90">
                  &ldquo;{rev.comment}&rdquo;
                </p>
              </div>

              <div className="mt-3 flex items-center justify-between border-t hairline-border pt-2.5 text-[11px] text-brand-muted">
                <span className="font-medium text-brand-white">
                  {rev.full_name}{' '}
                  <span className="text-brand-gold">@{rev.username}</span>
                </span>
                <span>{new Date(rev.updated_at).toLocaleDateString()}</span>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
