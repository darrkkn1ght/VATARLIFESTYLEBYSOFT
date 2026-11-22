import { AlertTriangle, ShieldCheck } from 'lucide-react';

interface MarketplaceSafetyBannerProps {
  compact?: boolean;
}

export function MarketplaceSafetyBanner({
  compact = false,
}: MarketplaceSafetyBannerProps) {
  return (
    <div
      role="note"
      aria-label="Marketplace safety rules"
      className="border border-brand-gold/35 bg-brand-charcoal/80 p-5 sm:p-6"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <AlertTriangle
            className="mt-0.5 h-5 w-5 shrink-0 text-brand-gold"
            aria-hidden="true"
          />
          <div>
            <p className="font-heading text-xs tracking-[0.22em] text-brand-gold uppercase">
              Manual Seller Fulfilment &amp; Safety Rules
            </p>
            <p className="mt-1.5 font-body text-xs leading-relaxed text-brand-cream/90">
              VATAR does <strong>not</strong> process payments, hold escrow, guarantee
              transactions, or perform automated game-currency transfers. Never share
              Lagos Life passwords, OTPs, banking PINs, or session cookies with anyone.
            </p>
          </div>
        </div>

        {!compact && (
          <ul className="grid shrink-0 gap-1.5 border-t hairline-border pt-3 font-body text-[0.72rem] text-brand-muted lg:border-t-0 lg:border-l lg:pt-0 lg:pl-5">
            <li className="flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-brand-gold" aria-hidden="true" />
              Buyers: independently verify recipient username before confirming receipt.
            </li>
            <li className="flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-brand-gold" aria-hidden="true" />
              Sellers: independently verify payment before fulfilling any order.
            </li>
            <li className="flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-brand-gold" aria-hidden="true" />
              “Seller Marked Sent” is not proof of receipt — report issues via Disputes.
            </li>
          </ul>
        )}
      </div>
    </div>
  );
}
