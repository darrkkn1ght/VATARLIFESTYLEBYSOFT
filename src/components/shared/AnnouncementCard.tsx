import type { AnnouncementItem } from '@/types/content';

interface AnnouncementCardProps {
  announcement: AnnouncementItem;
}

export function AnnouncementCard({ announcement }: AnnouncementCardProps) {
  return (
    <article className="border-b hairline-border py-6 first:pt-0 last:border-b-0 last:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-heading text-[0.7rem] tracking-[0.22em] text-brand-gold uppercase">
          {announcement.tag}
        </span>
        <span className="font-body text-xs text-brand-muted">
          {announcement.publishedLabel}
        </span>
      </div>
      <h3 className="heading-section mt-2.5 text-xl text-brand-white">
        {announcement.title}
      </h3>
      <p className="mt-2 font-body text-sm leading-relaxed text-brand-muted">
        {announcement.excerpt}
      </p>
    </article>
  );
}
