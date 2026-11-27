import { ArrowRight, ClipboardList, MessageSquare, Send, Store } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageContainer } from '@/components/layout/PageContainer';
import { Button } from '@/components/ui/Button';
import { MemberMoneyPacksSection } from '@/features/marketplace/components/MemberMoneyPacksSection';
import { ROUTES } from '@/routes/paths';

export function MemberMarketplacePage() {
  return (
    <div className="bg-brand-black">
      {/* Compact Header */}
      <section className="border-b hairline-border bg-brand-obsidian">
        <PageContainer className="py-5 sm:py-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h1 className="heading-display text-2xl text-brand-white sm:text-3xl">
              Official Currency Store
            </h1>

            <div className="flex flex-wrap items-center gap-2">
              <Button to={ROUTES.dashboardVendors} variant="secondary" size="sm">
                <Store className="h-3.5 w-3.5 text-brand-gold" aria-hidden="true" />
                Vendor Pages
              </Button>
              <Button to={ROUTES.dashboardTreasury} variant="secondary" size="sm">
                <Send className="h-3.5 w-3.5 text-brand-gold" aria-hidden="true" />
                Money Sender
              </Button>
              <Button to={ROUTES.dashboardMarketplaceOrders} variant="secondary" size="sm">
                <ClipboardList className="h-3.5 w-3.5" aria-hidden="true" />
                Orders &amp; Chats
              </Button>
            </div>
          </div>
        </PageContainer>
      </section>

      <PageContainer className="space-y-6 py-6 sm:py-8">
        <MemberMoneyPacksSection />

        {/* Dedicated Community Vendor Pages Callout */}
        <Link
          to={ROUTES.dashboardVendors}
          className="group flex flex-wrap items-center justify-between gap-4 border border-brand-gold/40 bg-brand-charcoal/65 p-5 transition-colors hover:border-brand-gold"
        >
          <div className="flex items-center gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center border border-brand-gold/45 bg-brand-black text-brand-gold">
              <Store className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="font-heading text-xs font-semibold tracking-[0.18em] text-brand-gold uppercase">
                Dedicated Vendor Storefronts
              </p>
              <h2 className="mt-0.5 font-heading text-lg text-brand-white group-hover:text-brand-gold">
                Browse Community Vendor Pages or Launch Your Own Store
              </h2>
              <p className="mt-0.5 font-body text-xs text-brand-muted">
                Every vendor gets their own page inside VATAR + direct live chat when an order is placed.
              </p>
            </div>
          </div>

          <span className="inline-flex items-center gap-1.5 font-heading text-xs tracking-[0.16em] text-brand-gold uppercase">
            <MessageSquare className="h-3.5 w-3.5" />
            Open Vendors Hub
            <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </Link>
      </PageContainer>
    </div>
  );
}
