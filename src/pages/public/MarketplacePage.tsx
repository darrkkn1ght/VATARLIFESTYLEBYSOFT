import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Handshake,
  PlusCircle,
  ShieldCheck,
  Store,
} from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { CategoryFilter } from '@/components/shared/CategoryFilter';
import { CTASection } from '@/components/shared/CTASection';
import { EmptyState } from '@/components/shared/EmptyState';
import { MarketplaceListingCard } from '@/components/shared/MarketplaceListingCard';
import { PublicPageHeader } from '@/components/shared/PublicPageHeader';
import { SearchInput } from '@/components/shared/SearchInput';
import { SectionHeading } from '@/components/shared/SectionHeading';
import { Button } from '@/components/ui/Button';
import { ROUTES } from '@/routes/paths';
import type { MarketplaceCategory, MarketplaceListing } from '@/types/content';

const MARKETPLACE_CATEGORIES: readonly MarketplaceCategory[] = [
  'All',
  'Lagos Life Game Funds',
  'Digital Goods',
  'Digital Services',
  'Community Products & Services',
];

const CATEGORY_GUIDE = [
  {
    name: 'Lagos Life Game Funds',
    detail: 'Community listings for legitimate in-game currency and funds arranged directly with sellers.',
  },
  {
    name: 'Digital Goods',
    detail: 'Approved digital items, assets, and gaming-related goods shared by community members.',
  },
  {
    name: 'Digital Services',
    detail: 'Legitimate creative, technical, and gaming-adjacent services offered within the community.',
  },
  {
    name: 'Community Products & Services',
    detail: 'Other moderator-approved products and services aligned with VATAR community standards.',
  },
] as const;

const MARKETPLACE_LISTINGS: readonly MarketplaceListing[] = [];

export function MarketplacePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<MarketplaceCategory>('All');

  const filteredListings = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    return MARKETPLACE_LISTINGS.filter((item) => {
      const matchesCategory =
        selectedCategory === 'All' || item.category === selectedCategory;
      const matchesQuery =
        normalizedQuery.length === 0 ||
        item.title.toLowerCase().includes(normalizedQuery) ||
        item.description.toLowerCase().includes(normalizedQuery) ||
        item.sellerName.toLowerCase().includes(normalizedQuery);
      return matchesCategory && matchesQuery;
    });
  }, [searchQuery, selectedCategory]);

  return (
    <>
      <PublicPageHeader
        eyebrow="Community Exchange"
        title="VATAR Marketplace"
        description="A moderated discovery hub for legitimate community buying and selling across Lagos Life game funds, digital goods, digital services, and approved community offerings."
        metaLabel="Model"
        metaValue="Discovery & Moderation"
        action={
          <Button to={ROUTES.contact} variant="primary" size="md">
            <PlusCircle className="h-4 w-4" aria-hidden="true" />
            Submit A Listing
          </Button>
        }
      />

      {/* Safety Notice */}
      <section
        aria-label="Marketplace safety notice"
        className="border-b hairline-border bg-brand-charcoal"
      >
        <PageContainer className="py-5">
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <span className="inline-flex items-center gap-2 border border-brand-gold/50 bg-brand-black px-3 py-1 font-heading text-xs tracking-[0.2em] text-brand-gold uppercase">
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
              Safety Notice
            </span>
            <p className="font-body text-xs leading-relaxed text-brand-cream/90 sm:text-sm">
              Never share your account passwords, banking PINs, or one-time passcodes
              (OTPs) with any buyer, seller, or third party. Always verify details before
              completing any direct arrangement.
            </p>
          </div>
        </PageContainer>
      </section>

      {/* Search, Filter & Listing Layout */}
      <section className="section-padding border-b hairline-border bg-brand-black">
        <PageContainer>
          <div className="flex flex-col gap-5 border-b hairline-border pb-8">
            <div className="grid gap-4 lg:grid-cols-12 lg:items-center">
              <div className="lg:col-span-5">
                <SearchInput
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder="Search listings, categories, or sellers..."
                  ariaLabel="Search marketplace listings"
                />
              </div>

              <div className="lg:col-span-7 lg:flex lg:justify-end">
                <CategoryFilter
                  categories={MARKETPLACE_CATEGORIES}
                  selected={selectedCategory}
                  onSelect={setSelectedCategory}
                  ariaLabel="Filter marketplace by category"
                />
              </div>
            </div>
          </div>

          <div className="mt-10">
            {filteredListings.length > 0 ? (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {filteredListings.map((listing) => (
                  <MarketplaceListingCard key={listing.id} listing={listing} />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<Store className="h-4 w-4" aria-hidden="true" />}
                eyebrow={
                  selectedCategory === 'All'
                    ? 'Marketplace Opening Soon'
                    : selectedCategory
                }
                title={
                  searchQuery.trim().length > 0
                    ? `No Listings Match "${searchQuery.trim()}"`
                    : `No Approved Listings In ${selectedCategory === 'All' ? 'Marketplace' : selectedCategory} Yet`
                }
                description="Real seller profiles and approved community listings will appear here once marketplace submissions are connected. VATAR does not display fabricated listings or sellers."
                action={
                  <div className="flex flex-wrap gap-3">
                    {(searchQuery.length > 0 || selectedCategory !== 'All') && (
                      <Button
                        variant="subtle"
                        size="sm"
                        onClick={() => {
                          setSearchQuery('');
                          setSelectedCategory('All');
                        }}
                      >
                        Reset Filters
                      </Button>
                    )}
                    <Button to={ROUTES.contact} variant="primary" size="sm">
                      Submit A Listing
                    </Button>
                  </div>
                }
              />
            )}
          </div>
        </PageContainer>
      </section>

      {/* Supported Categories */}
      <section className="section-padding border-b hairline-border bg-brand-obsidian">
        <PageContainer>
          <SectionHeading
            index="01"
            eyebrow="Scope"
            title="Approved Marketplace Categories"
            description="All listings submitted to VATAR Marketplace are reviewed against our community guidelines."
          />

          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {CATEGORY_GUIDE.map((item, idx) => (
              <article
                key={item.name}
                className="border hairline-border bg-brand-charcoal/60 p-6"
              >
                <span className="font-heading text-xs tracking-[0.22em] text-brand-gold">
                  0{idx + 1}
                </span>
                <h3 className="heading-section mt-3 text-xl text-brand-white">
                  {item.name}
                </h3>
                <p className="mt-2.5 font-body text-sm leading-relaxed text-brand-muted">
                  {item.detail}
                </p>
              </article>
            ))}
          </div>
        </PageContainer>
      </section>

      {/* How It Works & Governance */}
      <section className="section-padding bg-brand-black">
        <PageContainer>
          <div className="grid gap-8 lg:grid-cols-2">
            <article className="border hairline-border bg-brand-charcoal/65 p-8">
              <div className="flex items-center gap-3">
                <Handshake className="h-5 w-5 text-brand-gold" aria-hidden="true" />
                <p className="heading-eyebrow">Direct Arrangement</p>
              </div>
              <h2 className="heading-section mt-4 text-2xl text-brand-white">
                How Transactions Work
              </h2>
              <p className="mt-4 font-body text-sm leading-relaxed text-brand-muted">
                All transactions are arranged directly between buyers and sellers. VATAR
                LIFESTYLE BY SOFT provides marketplace discovery and listing moderation —
                we do not process payments, hold escrow funds, perform automated
                transfers, or guarantee individual transactions.
              </p>
            </article>

            <article className="border border-brand-gold/30 bg-brand-charcoal/65 p-8">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-brand-gold" aria-hidden="true" />
                <p className="heading-eyebrow">Moderation &amp; Trust</p>
              </div>
              <h2 className="heading-section mt-4 text-2xl text-brand-white">
                Responsible Trading Standards
              </h2>
              <p className="mt-4 font-body text-sm leading-relaxed text-brand-muted">
                Sellers must provide accurate pricing, honest availability status, and
                clear contact channels. Suspicious listings or policy violations may be
                removed by moderators to protect the integrity of the community.
              </p>
            </article>
          </div>
        </PageContainer>
      </section>

      <CTASection
        eyebrow="Sell With VATAR"
        title="Have An Approved Product Or Service To List?"
        description="Reach out through our contact channel to inquire about listing eligibility and upcoming seller onboarding."
        primaryLabel="Submit Listing Inquiry"
        primaryTo={ROUTES.contact}
        secondaryLabel="Join The Community"
        secondaryTo={ROUTES.register}
      />
    </>
  );
}
