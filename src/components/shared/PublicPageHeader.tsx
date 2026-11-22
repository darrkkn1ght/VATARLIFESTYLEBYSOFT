import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { PageContainer } from '@/components/layout/PageContainer';

interface PublicPageHeaderProps {
  eyebrow: string;
  title: string;
  description: string;
  metaLabel?: string;
  metaValue?: string;
  action?: ReactNode;
}

export function PublicPageHeader({
  eyebrow,
  title,
  description,
  metaLabel,
  metaValue,
  action,
}: PublicPageHeaderProps) {
  return (
    <section className="relative overflow-hidden border-b hairline-border bg-brand-black">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 ambient-gold-glow"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-brand-gold/30 to-transparent"
      />

      <PageContainer className="relative pt-16 pb-14 sm:pt-24 sm:pb-20">
        <div className="grid items-end gap-10 lg:grid-cols-12">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
            className="lg:col-span-8"
          >
            <div className="flex items-center gap-3">
              <span aria-hidden="true" className="h-px w-8 bg-brand-gold" />
              <p className="heading-eyebrow">{eyebrow}</p>
            </div>
            <h1 className="heading-display mt-5 text-4xl text-brand-white sm:text-6xl lg:text-7xl">
              {title}
            </h1>
            <p className="body-lead mt-6 max-w-2xl text-base sm:text-lg">
              {description}
            </p>
          </motion.div>

          {(action || (metaLabel && metaValue)) && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.08, ease: 'easeOut' }}
              className="flex flex-col items-start gap-5 lg:col-span-4 lg:items-end"
            >
              {metaLabel && metaValue && (
                <div className="border-l border-brand-gold/40 pl-4 lg:border-r lg:border-l-0 lg:pr-4 lg:pl-0 lg:text-right">
                  <p className="font-body text-[0.68rem] tracking-[0.22em] text-brand-muted uppercase">
                    {metaLabel}
                  </p>
                  <p className="mt-1 font-heading text-base tracking-[0.12em] text-brand-cream uppercase">
                    {metaValue}
                  </p>
                </div>
              )}
              {action}
            </motion.div>
          )}
        </div>
      </PageContainer>
    </section>
  );
}
