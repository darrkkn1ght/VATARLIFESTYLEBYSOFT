import { useState, type FormEvent } from 'react';
import {
  CheckCircle2,
  ExternalLink,
  HelpCircle,
  MessageCircle,
  Send,
} from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { PublicPageHeader } from '@/components/shared/PublicPageHeader';
import { SectionHeading } from '@/components/shared/SectionHeading';
import { Button } from '@/components/ui/Button';
import { SOCIAL_CHANNELS, WHATSAPP_CHANNEL } from '@/config/socials';

const SUPPORT_AREAS = [
  {
    title: 'Membership & Onboarding',
    detail: 'Questions regarding joining VATAR LIFESTYLE BY SOFT and member profile access.',
  },
  {
    title: 'Competitions & Standings',
    detail: 'Clarifications on competition formats, rulesets, and official leaderboard verification.',
  },
  {
    title: 'Marketplace Moderation',
    detail: 'Listing submission inquiries, category eligibility, and community safety reports.',
  },
] as const;

export function ContactPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [topic, setTopic] = useState('General Enquiry');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
  };

  return (
    <>
      <PublicPageHeader
        eyebrow="Contact"
        title="Connect With VATAR"
        description="Reach the VATAR LIFESTYLE BY SOFT team for community support, marketplace inquiries, competition questions, or general correspondence."
        metaLabel="Channels"
        metaValue="Community & Support"
      />

      {/* WhatsApp Community + Social Media */}
      <section className="section-padding border-b hairline-border bg-brand-black">
        <PageContainer>
          <div className="grid gap-8 lg:grid-cols-12">
            {/* WhatsApp Community CTA */}
            <article className="flex flex-col justify-between border border-brand-gold/35 bg-brand-charcoal/80 p-8 sm:p-10 lg:col-span-6">
              <div>
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center border border-brand-gold/40 bg-brand-black text-brand-gold">
                    <MessageCircle className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <p className="heading-eyebrow">Community Hub</p>
                </div>

                <h2 className="heading-section mt-5 text-3xl text-brand-white">
                  WhatsApp Community
                </h2>
                <p className="mt-4 font-body text-sm leading-relaxed text-brand-muted">
                  Stay close to real-time updates, competition announcements, and fellow
                  members through the official VATAR LIFESTYLE BY SOFT WhatsApp community.
                </p>
              </div>

              <div className="mt-8 border-t hairline-border pt-6">
                <p className="font-body text-xs text-brand-muted">
                  Official channel: <span className="text-brand-cream">{WHATSAPP_CHANNEL.name}</span>
                </p>
                <div className="mt-4">
                  <a
                    href={WHATSAPP_CHANNEL.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 border border-brand-gold bg-brand-gold px-6 py-3 font-heading text-xs font-semibold tracking-[0.2em] text-brand-black uppercase transition-colors hover:border-brand-cream hover:bg-brand-cream"
                  >
                    Follow WhatsApp Channel
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  </a>
                </div>
              </div>
            </article>

            {/* Social Media Channels */}
            <article className="border hairline-border bg-brand-charcoal/55 p-8 sm:p-10 lg:col-span-6">
              <p className="heading-eyebrow">Social Channels</p>
              <h2 className="heading-section mt-3 text-3xl text-brand-white">
                Follow VATAR LIFESTYLE BY SOFT
              </h2>
              <p className="mt-3 font-body text-sm leading-relaxed text-brand-muted">
                Connect with VATAR LIFESTYLE BY SOFT across our official social channels
                for community highlights, announcements, and updates.
              </p>

              <ul className="mt-6 divide-y divide-brand-cream/10 border-t border-b hairline-border">
                {SOCIAL_CHANNELS.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-col justify-between gap-1 py-4 sm:flex-row sm:items-center"
                  >
                    <span className="font-heading text-sm tracking-[0.16em] text-brand-cream uppercase">
                      {item.platform}
                    </span>
                    {item.href && item.handle ? (
                      <a
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 font-body text-xs font-medium tracking-[0.06em] text-brand-gold transition-colors hover:text-brand-cream"
                      >
                        {item.handle}
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                      </a>
                    ) : (
                      <span className="font-body text-xs text-brand-muted">
                        {item.pendingStatus}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </article>
          </div>
        </PageContainer>
      </section>

      {/* Support Information + General Enquiry */}
      <section className="section-padding bg-brand-obsidian">
        <PageContainer>
          <div className="grid gap-12 lg:grid-cols-12">
            {/* Support Information */}
            <div className="lg:col-span-5">
              <SectionHeading
                index="01"
                eyebrow="Assistance"
                title="Support Information"
                description="Use the general enquiry form to route your request to the appropriate VATAR team."
              />

              <div className="mt-8 space-y-5">
                {SUPPORT_AREAS.map((area) => (
                  <article
                    key={area.title}
                    className="border hairline-border bg-brand-charcoal/60 p-6"
                  >
                    <div className="flex items-center gap-2.5">
                      <HelpCircle
                        className="h-4 w-4 text-brand-gold"
                        aria-hidden="true"
                      />
                      <h3 className="heading-section text-lg text-brand-white">
                        {area.title}
                      </h3>
                    </div>
                    <p className="mt-2 font-body text-sm leading-relaxed text-brand-muted">
                      {area.detail}
                    </p>
                  </article>
                ))}
              </div>
            </div>

            {/* General Enquiry Form */}
            <div className="lg:col-span-7">
              <div className="border hairline-border bg-brand-charcoal/70 p-8 sm:p-10">
                <p className="heading-eyebrow">02 — Direct Message</p>
                <h2 className="heading-section mt-3 text-3xl text-brand-white">
                  General Enquiry
                </h2>
                <p className="mt-3 font-body text-sm text-brand-muted">
                  Send us a message regarding membership, competitions, marketplace
                  listings, or partnerships.
                </p>

                {submitted ? (
                  <div className="mt-8 border border-brand-gold/40 bg-brand-black/80 p-6">
                    <div className="flex items-center gap-3 text-brand-gold">
                      <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                      <p className="font-heading text-sm tracking-[0.18em] uppercase">
                        Enquiry Captured (Preview Mode)
                      </p>
                    </div>
                    <p className="mt-3 font-body text-sm leading-relaxed text-brand-muted">
                      Thank you, {name || 'Guest'}. Live form delivery is not yet
                      connected to a backend service in this milestone. Official contact
                      routing will be enabled once backend services go live.
                    </p>
                    <div className="mt-5">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setSubmitted(false);
                          setName('');
                          setEmail('');
                          setMessage('');
                        }}
                      >
                        Send Another Message
                      </Button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                    <div className="grid gap-5 sm:grid-cols-2">
                      <div>
                        <label
                          htmlFor="contact-name"
                          className="block font-heading text-xs tracking-[0.18em] text-brand-cream uppercase"
                        >
                          Full Name
                        </label>
                        <input
                          id="contact-name"
                          type="text"
                          required
                          value={name}
                          onChange={(event) => setName(event.target.value)}
                          placeholder="Your name"
                          className="mt-2 w-full border hairline-border bg-brand-black px-4 py-3 font-body text-sm text-brand-white placeholder:text-brand-muted/60 focus:border-brand-gold focus:outline-none"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="contact-email"
                          className="block font-heading text-xs tracking-[0.18em] text-brand-cream uppercase"
                        >
                          Email Address
                        </label>
                        <input
                          id="contact-email"
                          type="email"
                          required
                          value={email}
                          onChange={(event) => setEmail(event.target.value)}
                          placeholder="you@example.com"
                          className="mt-2 w-full border hairline-border bg-brand-black px-4 py-3 font-body text-sm text-brand-white placeholder:text-brand-muted/60 focus:border-brand-gold focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="contact-topic"
                        className="block font-heading text-xs tracking-[0.18em] text-brand-cream uppercase"
                      >
                        Topic
                      </label>
                      <select
                        id="contact-topic"
                        value={topic}
                        onChange={(event) => setTopic(event.target.value)}
                        className="mt-2 w-full border hairline-border bg-brand-black px-4 py-3 font-body text-sm text-brand-white focus:border-brand-gold focus:outline-none"
                      >
                        <option value="General Enquiry">General Enquiry</option>
                        <option value="Membership">Membership</option>
                        <option value="Competitions">Competitions</option>
                        <option value="Marketplace Listing">Marketplace Listing</option>
                        <option value="Community Support">Community Support</option>
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="contact-message"
                        className="block font-heading text-xs tracking-[0.18em] text-brand-cream uppercase"
                      >
                        Message
                      </label>
                      <textarea
                        id="contact-message"
                        rows={5}
                        required
                        value={message}
                        onChange={(event) => setMessage(event.target.value)}
                        placeholder="How can we help?"
                        className="mt-2 w-full resize-y border hairline-border bg-brand-black px-4 py-3 font-body text-sm text-brand-white placeholder:text-brand-muted/60 focus:border-brand-gold focus:outline-none"
                      />
                    </div>

                    <div className="flex flex-col items-start justify-between gap-4 pt-2 sm:flex-row sm:items-center">
                      <p className="font-body text-xs text-brand-muted">
                        Do not include passwords, PINs, or sensitive financial details.
                      </p>
                      <Button type="submit" variant="primary" size="md">
                        Submit Enquiry
                        <Send className="h-3.5 w-3.5" aria-hidden="true" />
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        </PageContainer>
      </section>
    </>
  );
}
