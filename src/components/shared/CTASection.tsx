import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { PageContainer } from '@/components/layout/PageContainer';
import { ROUTES } from '@/routes/paths';

interface CTASectionProps {
  eyebrow?: string;
  title: string;
  description: string;
  primaryLabel?: string;
  primaryTo?: string;
  secondaryLabel?: string;
  secondaryTo?: string;
}

export function CTASection({
  eyebrow = 'Join The House',
  title,
  description,
  primaryLabel = 'Register Now',
  primaryTo = ROUTES.register,
  secondaryLabel,
  secondaryTo,
}: CTASectionProps) {
  return (
    <section className="relative overflow-hidden border-t hairline-border bg-brand-obsidian">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_70%_at_50%_100%,rgba(198,161,91,0.16),transparent_68%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-gold/40 to-transparent"
      />

      <PageContainer className="relative py-20 sm:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <p className="heading-eyebrow">{eyebrow}</p>
          <h2 className="heading-display mt-4 text-4xl text-brand-white sm:text-5xl lg:text-6xl">
            {title}
          </h2>
          <p className="body-lead mx-auto mt-6 max-w-xl">{description}</p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button to={primaryTo} variant="primary" size="lg" className="w-full sm:w-auto">
              {primaryLabel}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Button>
            {secondaryLabel && secondaryTo && (
              <Button
                to={secondaryTo}
                variant="secondary"
                size="lg"
                className="w-full sm:w-auto"
              >
                {secondaryLabel}
              </Button>
            )}
          </div>
        </div>
      </PageContainer>
    </section>
  );
}
