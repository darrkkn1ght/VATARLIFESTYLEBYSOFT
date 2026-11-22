import type { ReactNode } from 'react';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import heroEditorialImg from '@/assets/hero-editorial.webp';
import { ROUTES } from '@/routes/paths';

interface AuthShellProps {
  eyebrow: string;
  title: string;
  subtitle: string;
  asideHeading: string;
  asideDescription: string;
  children: ReactNode;
}

export function AuthShell({
  eyebrow,
  title,
  subtitle,
  asideHeading,
  asideDescription,
  children,
}: AuthShellProps) {
  return (
    <div className="grid min-h-screen bg-brand-black text-brand-white lg:grid-cols-12">
      {/* Left editorial brand panel */}
      <aside className="relative hidden overflow-hidden border-r hairline-border bg-brand-obsidian lg:col-span-5 lg:flex lg:flex-col lg:justify-between">
        <img
          src={heroEditorialImg}
          alt="VATAR LIFESTYLE BY SOFT obsidian and gold architectural backdrop"
          width={1376}
          height={768}
          loading="eager"
          fetchPriority="high"
          decoding="async"
          className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-55"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-brand-black via-brand-black/75 to-brand-black/50"
        />

        <div className="relative z-10 p-10 xl:p-12">
          <Link to={ROUTES.home} className="inline-flex items-center gap-3">
            <span
              aria-hidden="true"
              className="flex h-9 w-9 items-center justify-center border border-brand-gold/60 bg-brand-charcoal font-heading text-sm font-semibold text-brand-gold"
            >
              V
            </span>
            <span className="flex flex-col leading-none">
              <span className="font-heading text-lg font-semibold tracking-[0.16em] text-brand-white uppercase">
                VATAR LIFESTYLE
              </span>
              <span className="mt-1 font-body text-[0.58rem] font-medium tracking-[0.36em] text-brand-gold uppercase">
                BY SOFT
              </span>
            </span>
          </Link>
        </div>

        <div className="relative z-10 p-10 xl:p-12">
          <div className="h-px w-12 bg-brand-gold" aria-hidden="true" />
          <p className="heading-eyebrow mt-6">More Than A Game</p>
          <h2 className="heading-display mt-3 text-4xl text-brand-white xl:text-5xl">
            {asideHeading}
          </h2>
          <p className="mt-4 max-w-md font-body text-sm leading-relaxed text-brand-cream/80">
            {asideDescription}
          </p>

          <div className="mt-8 flex items-start gap-3 border-t hairline-border pt-6">
            <ShieldCheck
              className="mt-0.5 h-4 w-4 shrink-0 text-brand-gold"
              aria-hidden="true"
            />
            <p className="font-body text-xs leading-relaxed text-brand-muted">
              VATAR LIFESTYLE BY SOFT will never request your Lagos Life password,
              banking PIN, or OTP.
            </p>
          </div>
        </div>
      </aside>

      {/* Right form column */}
      <div className="flex flex-col justify-between px-6 py-8 sm:px-10 lg:col-span-7 lg:px-14 lg:py-12">
        <div className="flex items-center justify-between gap-4">
          <Link
            to={ROUTES.home}
            className="inline-flex items-center gap-2 font-body text-xs tracking-[0.18em] text-brand-muted uppercase transition-colors hover:text-brand-gold"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Return Home
          </Link>

          <Link
            to={ROUTES.home}
            className="font-heading text-sm tracking-[0.18em] text-brand-gold uppercase lg:hidden"
          >
            VATAR LIFESTYLE
          </Link>
        </div>

        <main className="mx-auto my-10 w-full max-w-lg">
          <div className="flex items-center gap-3">
            <span aria-hidden="true" className="h-px w-8 bg-brand-gold" />
            <p className="heading-eyebrow">{eyebrow}</p>
          </div>
          <h1 className="heading-display mt-4 text-3xl text-brand-white sm:text-5xl">
            {title}
          </h1>
          <p className="mt-3 font-body text-sm leading-relaxed text-brand-muted">
            {subtitle}
          </p>

          <div className="mt-8 border hairline-border bg-brand-charcoal/70 p-6 sm:p-8">
            {children}
          </div>
        </main>

        <p className="text-center font-body text-xs tracking-[0.08em] text-brand-muted/80 lg:text-left">
          VATAR LIFESTYLE BY SOFT &bull; Protected Member Access
        </p>
      </div>
    </div>
  );
}
