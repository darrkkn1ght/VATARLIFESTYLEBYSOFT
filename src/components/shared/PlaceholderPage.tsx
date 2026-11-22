import { useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { PageContainer } from '@/components/layout/PageContainer';
import { ROUTES } from '@/routes/paths';

interface PlaceholderPageProps {
  eyebrow: string;
  title: string;
  description: string;
}

export function PlaceholderPage({ eyebrow, title, description }: PlaceholderPageProps) {
  const { pathname } = useLocation();

  return (
    <section className="section-padding">
      <PageContainer>
        <div className="max-w-2xl border hairline-border bg-brand-charcoal/70 p-8 sm:p-12">
          <p className="heading-eyebrow">{eyebrow}</p>
          <h1 className="heading-display mt-4 text-3xl text-brand-white sm:text-5xl">
            {title}
          </h1>
          <p className="body-lead mt-5">{description}</p>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t hairline-border pt-6">
            <span className="font-mono text-xs tracking-wider text-brand-muted">
              Route: {pathname}
            </span>
            <Button to={ROUTES.home} variant="secondary" size="sm">
              Back to Home
            </Button>
          </div>
        </div>
      </PageContainer>
    </section>
  );
}
