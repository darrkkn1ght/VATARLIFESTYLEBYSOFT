import { cn } from '@/lib/utilities/cn';

interface SectionHeaderProps {
  eyebrow: string;
  title: string;
  description?: string;
  align?: 'left' | 'center';
  className?: string;
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  align = 'left',
  className,
}: SectionHeaderProps) {
  return (
    <div
      className={cn(
        'max-w-2xl',
        align === 'center' && 'mx-auto text-center',
        className,
      )}
    >
      <p className="heading-eyebrow">{eyebrow}</p>
      <h2 className="heading-section mt-3 text-3xl text-brand-white sm:text-4xl">
        {title}
      </h2>
      {description && <p className="body-lead mt-4">{description}</p>}
    </div>
  );
}
