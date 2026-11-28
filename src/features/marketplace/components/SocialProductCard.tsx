import { useEffect, useState, type FormEvent } from 'react';
import {
  BadgeCheck,
  Bookmark,
  Check,
  Copy,
  Edit3,
  Heart,
  Loader2,
  MapPin,
  MessageCircle,
  MessageSquare,
  Send,
  Share2,
  ShoppingBag,
  ShoppingCart,
  Store,
  Trash2,
  X,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/features/auth/hooks/useAuth';
import {
  ListingAvailabilityBadge,
  ListingModerationBadge,
} from '@/features/marketplace/components/MarketplaceBadges';
import {
  addListingComment,
  deleteListingComment,
  fetchListingComments,
  formatGameFundsShort,
  toggleListingFavorite,
  toggleListingLike,
} from '@/features/marketplace/services/marketplaceService';
import { MARKETPLACE_CATEGORY_LABELS } from '@/features/marketplace/types/marketplace.types';
import type {
  MarketplaceListingCommentRow,
  MarketplaceListingWithSellerRow,
} from '@/lib/supabase/database.types';
import { cn } from '@/lib/utilities/cn';
import { ROUTES } from '@/routes/paths';

interface SocialProductCardProps {
  listing: MarketplaceListingWithSellerRow;
  inCart: boolean;
  onToggleCart: (listing: MarketplaceListingWithSellerRow) => void;
  onOrderClick?: (listing: MarketplaceListingWithSellerRow) => void;
  onEditClick?: (listing: MarketplaceListingWithSellerRow) => void;
  onFavoriteChanged?: (listingId: string, favorited: boolean) => void;
  autoOpenDetail?: boolean;
  onCloseAutoDetail?: () => void;
}

export function buildProductShareUrl(listingId: string): string {
  const origin =
    typeof window !== 'undefined'
      ? window.location.origin
      : 'https://vatar-lifestyle-by-soft.onrender.com';
  return `${origin}/marketplace?item=${listingId}`;
}

export function SocialProductCard({
  listing,
  inCart,
  onToggleCart,
  onOrderClick,
  onEditClick,
  onFavoriteChanged,
  autoOpenDetail = false,
  onCloseAutoDetail,
}: SocialProductCardProps) {
  const navigate = useNavigate();
  const { user, isAuthenticated, isApprovedMember, isAdmin } = useAuth();
  const isMine = Boolean(user && listing.seller_id === user.id);

  const [liked, setLiked] = useState(Boolean(listing.viewer_has_liked));
  const [likesCount, setLikesCount] = useState(Number(listing.likes_count ?? 0));
  const [favorited, setFavorited] = useState(Boolean(listing.viewer_has_favorited));
  const [commentsCount, setCommentsCount] = useState(Number(listing.comments_count ?? 0));

  const [shareOpen, setShareOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Detail + Public Comments Modal
  const [detailOpen, setDetailOpen] = useState(autoOpenDetail);
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);
  const [comments, setComments] = useState<MarketplaceListingCommentRow[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [postingComment, setPostingComment] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);

  useEffect(() => {
    setLiked(Boolean(listing.viewer_has_liked));
    setLikesCount(Number(listing.likes_count ?? 0));
    setFavorited(Boolean(listing.viewer_has_favorited));
    setCommentsCount(Number(listing.comments_count ?? 0));
  }, [
    listing.viewer_has_liked,
    listing.likes_count,
    listing.viewer_has_favorited,
    listing.comments_count,
  ]);

  useEffect(() => {
    if (autoOpenDetail) {
      setDetailOpen(true);
    }
  }, [autoOpenDetail]);

  useEffect(() => {
    if (!detailOpen) return;
    let active = true;
    setLoadingComments(true);
    void fetchListingComments(listing.id).then((res) => {
      if (!active) return;
      if (!res.error) {
        setComments(res.comments);
        setCommentsCount(res.comments.length);
      }
      setLoadingComments(false);
    });
    return () => {
      active = false;
    };
  }, [detailOpen, listing.id]);

  const images = Array.isArray(listing.image_urls) ? listing.image_urls.filter(Boolean) : [];
  const primaryImage = images[0] || null;
  const currencySymbol = listing.price_currency === 'USD' ? '$' : '₦';
  const formattedPrice = `${currencySymbol}${Number(listing.price_amount).toLocaleString()}`;
  const shareUrl = buildProductShareUrl(listing.id);
  const shareText = `${listing.title} (${formattedPrice})${
    listing.location ? ` • 📍 ${listing.location}` : ''
  } on VATAR Marketplace`;

  const handleLike = async () => {
    if (!isAuthenticated) {
      navigate(ROUTES.login);
      return;
    }
    const prevLiked = liked;
    const prevCount = likesCount;
    setLiked(!prevLiked);
    setLikesCount(Math.max(0, prevCount + (prevLiked ? -1 : 1)));

    const res = await toggleListingLike(listing.id);
    if (res.error) {
      setLiked(prevLiked);
      setLikesCount(prevCount);
    } else {
      setLiked(res.liked);
      setLikesCount(res.likesCount);
    }
  };

  const handleFavorite = async () => {
    if (!isAuthenticated) {
      navigate(ROUTES.login);
      return;
    }
    const prev = favorited;
    setFavorited(!prev);
    onFavoriteChanged?.(listing.id, !prev);

    const res = await toggleListingFavorite(listing.id);
    if (res.error) {
      setFavorited(prev);
      onFavoriteChanged?.(listing.id, prev);
    } else {
      setFavorited(res.favorited);
      onFavoriteChanged?.(listing.id, res.favorited);
    }
  };

  const handleShareAction = async () => {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: listing.title,
          text: shareText,
          url: shareUrl,
        });
        return;
      } catch {
        // User dismissed native share or unsupported — open social menu
      }
    }
    setShareOpen((prev) => !prev);
  };

  const handleCopyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      window.setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // ignore
    }
  };

  const handlePostComment = async (e: FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    setPostingComment(true);
    setCommentError(null);
    const res = await addListingComment(listing.id, commentText);
    setPostingComment(false);
    if (res.error) {
      setCommentError(res.error);
      return;
    }
    setCommentText('');
    const refreshed = await fetchListingComments(listing.id);
    if (!refreshed.error) {
      setComments(refreshed.comments);
      setCommentsCount(refreshed.comments.length);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    const res = await deleteListingComment(commentId);
    if (res.ok) {
      setComments((prev) => {
        const next = prev.filter((c) => c.id !== commentId);
        setCommentsCount(next.length);
        return next;
      });
    }
  };

  const closeDetail = () => {
    setDetailOpen(false);
    onCloseAutoDetail?.();
  };

  const vendorHref = listing.vendor_store_slug
    ? isAuthenticated
      ? `/dashboard/vendors/${listing.vendor_store_slug}`
      : `${ROUTES.marketplace}?vendor=${listing.vendor_store_slug}`
    : null;

  return (
    <>
      <article className="group flex flex-col justify-between border hairline-border bg-brand-charcoal/70 transition-colors hover:border-brand-gold/60">
        <div>
          {/* Product Image / Visual Cover */}
          <div
            onClick={() => setDetailOpen(true)}
            className="relative aspect-[16/10] w-full cursor-pointer overflow-hidden border-b hairline-border bg-brand-obsidian"
          >
            {primaryImage ? (
              <img
                src={primaryImage}
                alt={listing.title}
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-brand-obsidian via-brand-charcoal to-brand-black p-4 text-center">
                <Store className="h-7 w-7 text-brand-gold/65" />
                <span className="mt-2 font-heading text-[10px] tracking-[0.2em] text-brand-gold/85 uppercase">
                  {MARKETPLACE_CATEGORY_LABELS[listing.category]}
                </span>
              </div>
            )}

            <div className="absolute top-2.5 left-2.5 flex flex-wrap items-center gap-1.5">
              <span className="border border-brand-gold/50 bg-brand-black/85 px-2 py-0.5 font-heading text-[9px] tracking-[0.15em] text-brand-gold uppercase backdrop-blur-xs">
                {MARKETPLACE_CATEGORY_LABELS[listing.category]}
              </span>
              {images.length > 1 && (
                <span className="bg-brand-black/85 px-1.5 py-0.5 font-mono text-[10px] text-brand-cream">
                  1/{images.length} Photos
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                void handleFavorite();
              }}
              aria-label={favorited ? 'Remove from favorites' : 'Save to favorites'}
              className={cn(
                'absolute top-2.5 right-2.5 cursor-pointer border p-1.5 transition-colors',
                favorited
                  ? 'border-brand-gold bg-brand-gold text-brand-black'
                  : 'hairline-border bg-brand-black/80 text-brand-cream hover:border-brand-gold hover:text-brand-gold',
              )}
            >
              <Bookmark className={cn('h-3.5 w-3.5', favorited && 'fill-current')} />
            </button>
          </div>

          {/* Card Content */}
          <div className="p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2 text-xs">
              <div className="flex min-w-0 items-center gap-1.5">
                {vendorHref ? (
                  <Link
                    to={vendorHref}
                    className="truncate font-heading text-[11px] tracking-[0.1em] text-brand-gold hover:underline"
                  >
                    {listing.vendor_store_name || `@${listing.seller_username}`}
                  </Link>
                ) : (
                  <span className="truncate font-mono text-xs text-brand-gold">
                    @{listing.seller_username}
                  </span>
                )}
                {listing.vendor_is_verified && (
                  <BadgeCheck
                    className="h-3.5 w-3.5 shrink-0 text-emerald-400"
                    aria-label="Verified Vendor"
                  />
                )}
              </div>

              {isMine ? (
                <ListingModerationBadge status={listing.moderation_status} />
              ) : (
                <ListingAvailabilityBadge status={listing.status} />
              )}
            </div>

            <button
              type="button"
              onClick={() => setDetailOpen(true)}
              className="mt-2 block cursor-pointer text-left"
            >
              <h3 className="heading-section line-clamp-1 text-lg text-brand-white group-hover:text-brand-gold">
                {listing.title}
              </h3>
            </button>

            <div className="mt-1 flex flex-wrap items-baseline gap-2">
              <span className="font-heading text-xl font-semibold text-brand-gold">
                {formattedPrice}
              </span>
              {listing.game_currency_amount ? (
                <span className="font-mono text-xs text-brand-cream">
                  • ₦{formatGameFundsShort(listing.game_currency_amount)} Funds
                </span>
              ) : null}
            </div>

            {listing.location && (
              <p className="mt-1.5 flex items-center gap-1 font-body text-xs text-brand-cream/85">
                <MapPin className="h-3 w-3 shrink-0 text-brand-gold" />
                <span className="truncate">{listing.location}</span>
              </p>
            )}

            <p className="mt-2 line-clamp-2 font-body text-xs leading-relaxed text-brand-muted">
              {listing.description}
            </p>
          </div>
        </div>

        {/* Social Bar (Like, Comment, Cart, Share) + Buy/Chat CTA */}
        <div className="space-y-3 border-t hairline-border px-4 pt-3 pb-4 sm:px-5">
          <div className="flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => void handleLike()}
                className={cn(
                  'inline-flex cursor-pointer items-center gap-1 transition-colors',
                  liked ? 'text-rose-400' : 'text-brand-muted hover:text-brand-white',
                )}
              >
                <Heart className={cn('h-4 w-4', liked && 'fill-current')} />
                <span className="font-mono">{likesCount}</span>
              </button>

              <button
                type="button"
                onClick={() => setDetailOpen(true)}
                className="inline-flex cursor-pointer items-center gap-1 text-brand-muted transition-colors hover:text-brand-white"
              >
                <MessageCircle className="h-4 w-4" />
                <span className="font-mono">{commentsCount}</span>
              </button>

              {!isMine && (
                <button
                  type="button"
                  onClick={() => onToggleCart(listing)}
                  className={cn(
                    'inline-flex cursor-pointer items-center gap-1 transition-colors',
                    inCart
                      ? 'font-medium text-brand-gold'
                      : 'text-brand-muted hover:text-brand-gold',
                  )}
                >
                  <ShoppingCart className="h-4 w-4" />
                  <span>{inCart ? 'In Cart' : 'Cart'}</span>
                </button>
              )}
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => void handleShareAction()}
                className="inline-flex cursor-pointer items-center gap-1 text-brand-muted transition-colors hover:text-brand-gold"
              >
                <Share2 className="h-3.5 w-3.5" />
                <span>Share</span>
              </button>

              {shareOpen && (
                <div className="absolute right-0 bottom-7 z-30 w-48 space-y-1 border border-brand-gold/50 bg-brand-black p-2 shadow-xl">
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(`${shareText}\n${shareUrl}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block px-2.5 py-1.5 text-xs text-brand-cream hover:bg-brand-charcoal hover:text-brand-gold"
                  >
                    Share on WhatsApp
                  </a>
                  <a
                    href={`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block px-2.5 py-1.5 text-xs text-brand-cream hover:bg-brand-charcoal hover:text-brand-gold"
                  >
                    Share on Telegram
                  </a>
                  <a
                    href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block px-2.5 py-1.5 text-xs text-brand-cream hover:bg-brand-charcoal hover:text-brand-gold"
                  >
                    Share on X (Twitter)
                  </a>
                  <a
                    href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block px-2.5 py-1.5 text-xs text-brand-cream hover:bg-brand-charcoal hover:text-brand-gold"
                  >
                    Share on Facebook
                  </a>
                  <button
                    type="button"
                    onClick={() => void handleCopyShareLink()}
                    className="flex w-full cursor-pointer items-center gap-1.5 px-2.5 py-1.5 text-left text-xs text-brand-gold hover:bg-brand-charcoal"
                  >
                    {copiedLink ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    {copiedLink ? 'Link Copied!' : 'Copy Direct Link'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {isMine && onEditClick ? (
            <Button
              variant="secondary"
              size="sm"
              className="w-full"
              onClick={() => onEditClick(listing)}
            >
              <Edit3 className="h-3.5 w-3.5" />
              Edit Listing
            </Button>
          ) : isApprovedMember || isAdmin ? (
            <Button
              variant="primary"
              size="sm"
              className="w-full"
              onClick={() =>
                onOrderClick
                  ? onOrderClick(listing)
                  : navigate(`/dashboard/vendors?buy=${listing.id}`)
              }
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Order &amp; Chat Vendor
            </Button>
          ) : (
            <Button to={ROUTES.login} variant="primary" size="sm" className="w-full">
              <ShoppingBag className="h-3.5 w-3.5" />
              Sign In to Buy / Chat Vendor
            </Button>
          )}
        </div>
      </article>

      {/* Product Full View + Photo Gallery + Public Comments Modal */}
      {detailOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-xs"
        >
          <div className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto border border-brand-gold/50 bg-brand-charcoal p-5 sm:p-7">
            <button
              type="button"
              onClick={closeDetail}
              className="absolute top-4 right-4 cursor-pointer p-1 text-brand-muted hover:text-brand-white"
            >
              <X className="h-5 w-5" />
            </button>

            <span className="font-heading text-[10px] tracking-[0.18em] text-brand-gold uppercase">
              {MARKETPLACE_CATEGORY_LABELS[listing.category]}
            </span>
            <h2 className="heading-section mt-1 pr-8 text-2xl text-brand-white">
              {listing.title}
            </h2>

            <div className="mt-2 flex flex-wrap items-center gap-3">
              <span className="font-heading text-2xl font-semibold text-brand-gold">
                {formattedPrice}
              </span>
              {listing.location && (
                <span className="inline-flex items-center gap-1 border hairline-border bg-brand-black px-2.5 py-1 text-xs text-brand-cream">
                  <MapPin className="h-3.5 w-3.5 text-brand-gold" />
                  {listing.location}
                </span>
              )}
              <span className="font-mono text-xs text-brand-muted">
                Seller: @{listing.seller_username}
              </span>
            </div>

            {images.length > 0 && (
              <div className="mt-4 space-y-2">
                <div className="aspect-[16/10] w-full overflow-hidden border hairline-border bg-brand-black">
                  <img
                    src={images[activePhotoIdx] || images[0]}
                    alt={listing.title}
                    className="h-full w-full object-contain"
                  />
                </div>
                {images.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto">
                    {images.map((img, i) => (
                      <button
                        key={img}
                        type="button"
                        onClick={() => setActivePhotoIdx(i)}
                        className={cn(
                          'h-14 w-14 shrink-0 cursor-pointer overflow-hidden border',
                          activePhotoIdx === i ? 'border-brand-gold' : 'hairline-border opacity-65',
                        )}
                      >
                        <img src={img} alt="" className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <p className="mt-4 whitespace-pre-line font-body text-sm leading-relaxed text-brand-cream/90">
              {listing.description}
            </p>

            {listing.seller_contact_note && (
              <p className="mt-3 border-l-2 border-brand-gold pl-3 font-body text-xs text-brand-muted">
                Store Note: {listing.seller_contact_note}
              </p>
            )}

            {/* Action Buttons inside Detail Modal */}
            <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-b hairline-border py-3.5">
              {!isMine && (
                <>
                  {isApprovedMember || isAdmin ? (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        closeDetail();
                        if (onOrderClick) onOrderClick(listing);
                        else navigate(`/dashboard/vendors?buy=${listing.id}`);
                      }}
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      Order &amp; Chat Vendor
                    </Button>
                  ) : (
                    <Button to={ROUTES.login} variant="primary" size="sm">
                      Sign In to Order
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => onToggleCart(listing)}
                  >
                    <ShoppingCart className="h-3.5 w-3.5 text-brand-gold" />
                    {inCart ? 'Remove from Cart' : 'Add to Cart'}
                  </Button>
                </>
              )}
              <Button variant="ghost" size="sm" onClick={() => void handleCopyShareLink()}>
                {copiedLink ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedLink ? 'Product Link Copied!' : 'Copy Share Link'}
              </Button>
            </div>

            {/* Public Product Comments Section */}
            <div className="mt-5">
              <h3 className="font-heading text-xs font-semibold tracking-[0.18em] text-brand-white uppercase">
                Public Comments &amp; Questions ({comments.length})
              </h3>

              {commentError && (
                <p className="mt-2 text-xs text-rose-300">{commentError}</p>
              )}

              <div className="mt-3 max-h-56 space-y-2.5 overflow-y-auto pr-1">
                {loadingComments ? (
                  <p className="text-xs text-brand-muted">Loading comments...</p>
                ) : comments.length === 0 ? (
                  <p className="text-xs text-brand-muted">
                    No comments yet — ask the seller a question or leave feedback below!
                  </p>
                ) : (
                  comments.map((c) => {
                    const canDelete =
                      Boolean(user && (c.user_id === user.id || isMine)) || isAdmin;
                    return (
                      <div
                        key={c.id}
                        className="flex items-start justify-between gap-2 border hairline-border bg-brand-black/75 px-3.5 py-2.5 text-xs"
                      >
                        <div>
                          <span className="font-medium text-brand-gold">@{c.username}</span>
                          <span className="ml-2 font-mono text-[10px] text-brand-muted">
                            {new Date(c.created_at).toLocaleDateString()}
                          </span>
                          <p className="mt-1 text-brand-cream">{c.body}</p>
                        </div>
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => void handleDeleteComment(c.id)}
                            className="cursor-pointer text-brand-muted hover:text-rose-400"
                            aria-label="Delete comment"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {isApprovedMember || isAdmin ? (
                <form onSubmit={(e) => void handlePostComment(e)} className="mt-3 flex gap-2">
                  <input
                    type="text"
                    maxLength={600}
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Write a public comment or question..."
                    className="flex-1 border hairline-border bg-brand-black px-3 py-2 text-xs text-brand-white focus:border-brand-gold focus:outline-none"
                  />
                  <Button type="submit" variant="primary" size="sm" disabled={postingComment}>
                    {postingComment ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Send className="h-3.5 w-3.5" />
                    )}
                    Post
                  </Button>
                </form>
              ) : (
                <p className="mt-3 text-xs text-brand-muted">
                  <Link to={ROUTES.login} className="text-brand-gold underline">
                    Sign in
                  </Link>{' '}
                  to post a comment or chat directly with this vendor.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
