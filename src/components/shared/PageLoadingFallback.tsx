export function PageLoadingFallback() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-[55vh] flex-col items-center justify-center bg-brand-black px-6 py-20 text-brand-white"
    >
      <span
        aria-hidden="true"
        className="flex h-11 w-11 items-center justify-center border border-brand-gold/60 bg-brand-charcoal font-heading text-base font-semibold text-brand-gold"
      >
        V
      </span>
      <p className="mt-5 font-heading text-xs tracking-[0.28em] text-brand-cream uppercase">
        Loading VATAR
      </p>
      <div className="mt-4 h-px w-32 overflow-hidden bg-brand-charcoal">
        <div className="h-full w-1/2 animate-pulse bg-brand-gold" />
      </div>
    </div>
  );
}
