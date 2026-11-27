import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { supabase } from '@/lib/supabase/client';

const PRESENCE_CHANNEL = 'vatar:online-presence';

export interface OnlineUserPresence {
  userId: string;
  username: string;
  fullName: string;
  path: string;
  pageLabel: string;
  onlineAt: string;
}

function formatPageLabel(pathname: string): string {
  if (pathname === '/') return 'Home';
  if (pathname.startsWith('/admin/marketplace')) return 'Admin Marketplace';
  if (pathname.startsWith('/admin/members')) return 'Admin Members';
  if (pathname.startsWith('/admin')) return 'Admin Control Center';
  if (pathname.startsWith('/dashboard/treasury')) return 'VATAR Treasury';
  if (pathname.startsWith('/dashboard/marketplace/orders')) return 'My Orders';
  if (pathname.startsWith('/dashboard/marketplace')) return 'Marketplace & Currency';
  if (pathname.startsWith('/dashboard/competitions')) return 'Competitions';
  if (pathname.startsWith('/dashboard/leaderboard')) return 'Leaderboard';
  if (pathname.startsWith('/dashboard/announcements')) return 'Announcements';
  if (pathname.startsWith('/dashboard/profile')) return 'My Profile';
  if (pathname.startsWith('/dashboard')) return 'Member Dashboard';
  return pathname.replace(/^\//, '') || 'Home';
}

/**
 * Broadcasts the currently signed-in member's live presence and active page
 * over Supabase Realtime Presence (zero database writes).
 */
export function useBroadcastSitePresence() {
  const { user, profile } = useAuth();
  const location = useLocation();

  useEffect(() => {
    const client = supabase;
    if (!client || !user) return;

    const channel = client.channel(PRESENCE_CHANNEL, {
      config: { presence: { key: user.id } },
    });

    const payload: OnlineUserPresence = {
      userId: user.id,
      username: profile?.username || 'member',
      fullName: profile?.full_name || profile?.username || 'VATAR Member',
      path: location.pathname,
      pageLabel: formatPageLabel(location.pathname),
      onlineAt: new Date().toISOString(),
    };

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        void channel.track(payload);
      }
    });

    return () => {
      void client.removeChannel(channel);
    };
  }, [user, profile?.username, profile?.full_name, location.pathname]);
}

/**
 * Subscribes to all currently online members across the site (for Admin Overview).
 */
export function useOnlineSiteUsers(): OnlineUserPresence[] {
  const { user } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState<OnlineUserPresence[]>([]);

  useEffect(() => {
    const client = supabase;
    if (!client || !user) return;

    const channel = client.channel(PRESENCE_CHANNEL, {
      config: { presence: { key: user.id } },
    });

    const syncUsers = () => {
      const state = channel.presenceState<OnlineUserPresence>();
      const deduped = new Map<string, OnlineUserPresence>();
      Object.values(state).forEach((entries) => {
        for (const item of entries) {
          if (item && item.userId) {
            deduped.set(item.userId, item);
          }
        }
      });
      setOnlineUsers(Array.from(deduped.values()));
    };

    channel
      .on('presence', { event: 'sync' }, syncUsers)
      .on('presence', { event: 'join' }, syncUsers)
      .on('presence', { event: 'leave' }, syncUsers)
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [user]);

  return onlineUsers;
}
