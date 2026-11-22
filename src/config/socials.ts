export interface SocialChannel {
  id: 'x' | 'instagram' | 'tiktok' | 'youtube';
  platform: string;
  handle: string | null;
  href: string | null;
  pendingStatus: string;
}

export const WHATSAPP_CHANNEL = {
  platform: 'WhatsApp',
  name: 'LAGOS LIFEstyle by SOFT',
  href: 'https://whatsapp.com/channel/0029Vb9hC8u23n3ep6cTWv2B',
} as const;

export const SOCIAL_CHANNELS: readonly SocialChannel[] = [
  {
    id: 'x',
    platform: 'X (Twitter)',
    handle: '@softcollins5',
    href: 'https://x.com/softcollins5',
    pendingStatus: 'Official handle pending publication',
  },
  {
    id: 'instagram',
    platform: 'Instagram',
    handle: null,
    href: null,
    pendingStatus: 'Official handle pending publication',
  },
  {
    id: 'tiktok',
    platform: 'TikTok',
    handle: null,
    href: null,
    pendingStatus: 'Official handle pending publication',
  },
  {
    id: 'youtube',
    platform: 'YouTube',
    handle: '@soft_lagos_lifestyle',
    href: 'https://youtube.com/@soft_lagos_lifestyle',
    pendingStatus: 'Official channel pending publication',
  },
] as const;

export const ACTIVE_SOCIAL_CHANNELS = SOCIAL_CHANNELS.filter(
  (channel): channel is SocialChannel & { href: string; handle: string } =>
    Boolean(channel.href && channel.handle),
);
