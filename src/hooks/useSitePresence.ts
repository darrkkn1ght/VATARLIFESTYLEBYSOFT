import { useEffect, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
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
  if (pathname.startsWith('/dashboard/vendors')) return 'Vendor Stores';
  if (pathname.startsWith('/dashboard/marketplace/orders')) return 'My Orders';
  if (pathname.startsWith('/dashboard/marketplace')) return 'Currency Store';
  if (pathname.startsWith('/dashboard/competitions')) return 'Competitions';
  if (pathname.startsWith('/dashboard/leaderboard')) return 'Leaderboard';
  if (pathname.startsWith('/dashboard/announcements')) return 'Announcements';
  if (pathname.startsWith('/dashboard/profile')) return 'My Profile';
  if (pathname.startsWith('/dashboard')) return 'Member Dashboard';
  return pathname.replace(/^\//, '') || 'Home';
}

// Shared singleton presence manager so PortalLayout and AdminLiveActivityPanel
// never collide or tear down each other's Supabase Realtime channel.
let sharedChannel: RealtimeChannel | null = null;
let sharedChannelUserId: string | null = null;
let sharedSubscribed = false;
let latestTrackPayload: OnlineUserPresence | null = null;
let currentSnapshot: OnlineUserPresence[] = [];
let activeRefCount = 0;
const listeners = new Set<(users: OnlineUserPresence[]) => void>();

function notifyListeners() {
  for (const listener of listeners) {
    listener(currentSnapshot);
  }
}

function syncPresenceFromChannel(channel: RealtimeChannel) {
  try {
    const state = channel.presenceState<OnlineUserPresence>();
    const deduped = new Map<string, OnlineUserPresence>();
    Object.values(state).forEach((entries) => {
      if (!Array.isArray(entries)) return;
      for (const item of entries) {
        if (item && item.userId) {
          deduped.set(item.userId, item);
        }
      }
    });
    currentSnapshot = Array.from(deduped.values());
    notifyListeners();
  } catch {
    // Ignore transient presence state read issues
  }
}

function acquirePresenceChannel(userId: string): RealtimeChannel | null {
  const client = supabase;
  if (!client) return null;

  if (sharedChannel && sharedChannelUserId !== userId) {
    void client.removeChannel(sharedChannel);
    sharedChannel = null;
    sharedChannelUserId = null;
    sharedSubscribed = false;
    currentSnapshot = [];
  }

  activeRefCount += 1;

  if (!sharedChannel) {
    sharedChannelUserId = userId;
    sharedSubscribed = false;
    const channel = client.channel(PRESENCE_CHANNEL, {
      config: { presence: { key: userId } },
    });

    channel
      .on('presence', { event: 'sync' }, () => syncPresenceFromChannel(channel))
      .on('presence', { event: 'join' }, () => syncPresenceFromChannel(channel))
      .on('presence', { event: 'leave' }, () => syncPresenceFromChannel(channel))
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          sharedSubscribed = true;
          syncPresenceFromChannel(channel);
          if (latestTrackPayload) {
            void channel.track(latestTrackPayload).catch(() => {});
          }
        }
      });

    sharedChannel = channel;
  }

  return sharedChannel;
}

function releasePresenceChannel() {
  activeRefCount = Math.max(0, activeRefCount - 1);
  if (activeRefCount === 0 && sharedChannel && supabase) {
    const chan = sharedChannel;
    sharedChannel = null;
    sharedChannelUserId = null;
    sharedSubscribed = false;
    latestTrackPayload = null;
    currentSnapshot = [];
    void supabase.removeChannel(chan);
  }
}

/**
 * Broadcasts the currently signed-in member's live presence and active page
 * over Supabase Realtime Presence (zero database writes).
 */
export function useBroadcastSitePresence() {
  const { user, profile } = useAuth();
  const location = useLocation();

  useEffect(() => {
    if (!user) return;
    acquirePresenceChannel(user.id);
    return () => {
      releasePresenceChannel();
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const payload: OnlineUserPresence = {
      userId: user.id,
      username: profile?.username || 'member',
      fullName: profile?.full_name || profile?.username || 'VATAR Member',
      path: location.pathname,
      pageLabel: formatPageLabel(location.pathname),
      onlineAt: new Date().toISOString(),
    };
    latestTrackPayload = payload;
    if (sharedChannel && sharedSubscribed) {
      void sharedChannel.track(payload).catch(() => {});
    }
  }, [user, profile?.username, profile?.full_name, location.pathname]);
}

/**
 * Subscribes to all currently online members across the site (for Admin Overview).
 */
export function useOnlineSiteUsers(): OnlineUserPresence[] {
  const { user } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState<OnlineUserPresence[]>(
    () => currentSnapshot,
  );

  useEffect(() => {
    if (!user) return;
    const handleUpdate = (users: OnlineUserPresence[]) => {
      setOnlineUsers(users);
    };
    listeners.add(handleUpdate);
    const channel = acquirePresenceChannel(user.id);
    if (channel && sharedSubscribed) {
      syncPresenceFromChannel(channel);
    } else {
      setOnlineUsers(currentSnapshot);
    }

    return () => {
      listeners.delete(handleUpdate);
      releasePresenceChannel();
    };
  }, [user]);

  return onlineUsers;
}
