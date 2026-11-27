import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Coins,
  Crown,
  Radio,
  RefreshCw,
  Store,
  Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
  fetchAdminMoneyPackOrders,
  fetchAdminVipRequests,
  MONEY_PACK_STATUS_LABELS,
} from '@/features/marketplace/services/moneyPackService';
import { fetchAdminMarketplaceOversight } from '@/features/marketplace/services/marketplaceService';
import { useOnlineSiteUsers } from '@/hooks/useSitePresence';
import { supabase } from '@/lib/supabase/client';
import { cn } from '@/lib/utilities/cn';

type TxKind = 'currency' | 'vip' | 'vendor' | 'treasury';

interface UnifiedTxItem {
  id: string;
  kind: TxKind;
  title: string;
  subtitle: string;
  status: string;
  timestamp: string;
}

function kindBadge(kind: TxKind) {
  switch (kind) {
    case 'currency':
      return {
        label: 'Currency',
        icon: Coins,
        cls: 'border-brand-gold/50 bg-brand-gold/15 text-brand-gold',
      };
    case 'vip':
      return {
        label: 'VIP Tier',
        icon: Crown,
        cls: 'border-amber-400/50 bg-amber-500/15 text-amber-300',
      };
    case 'vendor':
      return {
        label: 'Vendor Order',
        icon: Store,
        cls: 'border-sky-400/45 bg-sky-500/15 text-sky-300',
      };
    case 'treasury':
      return {
        label: 'Treasury',
        icon: Wallet,
        cls: 'border-emerald-400/45 bg-emerald-500/15 text-emerald-300',
      };
  }
}

export function AdminLiveActivityPanel() {
  const onlineUsers = useOnlineSiteUsers();
  const [txItems, setTxItems] = useState<UnifiedTxItem[]>([]);
  const [filterKind, setFilterKind] = useState<'all' | TxKind>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadTransactions = useCallback(async (initial: boolean) => {
    if (initial) setLoading(true);
    else setRefreshing(true);

    const [currencyRes, vipRes, vendorRes, treasuryRes] = await Promise.all([
      fetchAdminMoneyPackOrders(),
      fetchAdminVipRequests(),
      fetchAdminMarketplaceOversight(),
      supabase
        ? supabase
            .from('audit_logs')
            .select('id, actor_id, action, metadata, created_at')
            .eq('entity_type', 'treasury_transfer')
            .order('created_at', { ascending: false })
            .limit(30)
        : Promise.resolve({ data: [], error: null }),
    ]);

    const profileMap = new Map<string, string>();
    if (supabase) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, username');
      for (const p of profs ?? []) {
        profileMap.set(p.id, p.username);
      }
    }

    const combined: UnifiedTxItem[] = [];

    for (const o of currencyRes.orders ?? []) {
      combined.push({
        id: `cur:${o.id}`,
        kind: 'currency',
        title: `${o.order_code} • ${o.pack_label} (₦${Number(o.total_price_ngn ?? 0).toLocaleString()})`,
        subtitle: `@${o.buyer_username} → @${o.lagos_life_username}${
          o.vip_tier ? ` • ${o.vip_tier.toUpperCase()} VIP` : ''
        }`,
        status: MONEY_PACK_STATUS_LABELS[o.status] ?? String(o.status ?? '').toUpperCase(),
        timestamp: o.updated_at || o.created_at,
      });
    }

    for (const v of vipRes.requests ?? []) {
      combined.push({
        id: `vip:${v.id}`,
        kind: 'vip',
        title: `${v.request_code} • ${String(v.tier ?? '').toUpperCase()} VIP (₦${Number(v.price_ngn ?? 0).toLocaleString()}/mo)`,
        subtitle: `@${v.member_username} (${v.discount_percent ?? 0}% off)`,
        status: String(v.status ?? '').replace(/_/g, ' ').toUpperCase(),
        timestamp: v.updated_at || v.created_at,
      });
    }

    for (const m of vendorRes.orders ?? []) {
      combined.push({
        id: `ven:${m.order.id}`,
        kind: 'vendor',
        title: `${m.listingTitle} • ${m.order.agreed_price_currency} ${Number(m.order.agreed_price_amount ?? 0).toLocaleString()}`,
        subtitle: `Buyer @${m.buyerUsername} ↔ Seller @${m.sellerUsername}`,
        status: String(m.order.status ?? '').replace(/_/g, ' ').toUpperCase(),
        timestamp: m.order.updated_at || m.order.created_at,
      });
    }

    for (const t of treasuryRes.data ?? []) {
      const meta = (t.metadata ?? {}) as Record<string, unknown>;
      const actor = (t.actor_id && profileMap.get(t.actor_id)) || 'member';
      const mode = String(meta.mode || 'single').toUpperCase();
      const target = String(meta.target || '');
      const amt = String(meta.amount_label || '');
      const detail = String(meta.detail || '');
      combined.push({
        id: `trs:${t.id}`,
        kind: 'treasury',
        title: `@${actor} ran ${mode} (${amt})`,
        subtitle: `Target: ${target}${detail ? ` • ${detail}` : ''}`,
        status: 'EXECUTED',
        timestamp: t.created_at,
      });
    }

    combined.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );

    setTxItems(combined);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    void loadTransactions(true);
  }, [loadTransactions]);

  const visibleTx = useMemo(
    () =>
      filterKind === 'all'
        ? txItems
        : txItems.filter((item) => item.kind === filterKind),
    [txItems, filterKind],
  );

  return (
    <section className="grid gap-6 lg:grid-cols-12">
      {/* Online Right Now (Live Presence) */}
      <div className="border border-brand-gold/40 bg-brand-charcoal/70 p-5 lg:col-span-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Radio className="h-4 w-4 animate-pulse text-emerald-400" />
            <h2 className="font-heading text-xs font-semibold tracking-[0.18em] text-brand-white uppercase">
              Online Now ({onlineUsers.length})
            </h2>
          </div>
          <span className="border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 font-mono text-[10px] text-emerald-300 uppercase">
            Live
          </span>
        </div>

        <p className="mt-1 font-body text-xs text-brand-muted">
          Signed-in members actively browsing the site right now.
        </p>

        <div className="mt-4 max-h-72 space-y-2 overflow-y-auto pr-1">
          {onlineUsers.length === 0 ? (
            <p className="font-body text-xs text-brand-muted">
              Only you are online right now.
            </p>
          ) : (
            onlineUsers.map((u) => (
              <div
                key={u.userId}
                className="flex items-center justify-between gap-2 border hairline-border bg-brand-black/75 px-3 py-2 text-xs"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
                    <span className="truncate font-heading tracking-[0.08em] text-brand-white">
                      @{u.username}
                    </span>
                  </div>
                  <p className="truncate font-body text-[11px] text-brand-muted">
                    {u.fullName}
                  </p>
                </div>
                <span className="shrink-0 border border-brand-gold/35 bg-brand-charcoal px-2 py-0.5 font-mono text-[10px] text-brand-gold">
                  {u.pageLabel}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Unified Live Transaction Monitor */}
      <div className="border hairline-border bg-brand-charcoal/70 p-5 lg:col-span-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-brand-gold" />
              <h2 className="font-heading text-xs font-semibold tracking-[0.18em] text-brand-white uppercase">
                Live Transactions Monitor ({visibleTx.length})
              </h2>
            </div>
            <p className="mt-1 font-body text-xs text-brand-muted">
              Currency orders, VIP upgrades, vendor trades, and Treasury activity in one feed.
            </p>
          </div>

          <Button
            variant="secondary"
            size="sm"
            disabled={refreshing}
            onClick={() => void loadTransactions(false)}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
            Refresh
          </Button>
        </div>

        {/* Filter Chips */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {(
            [
              ['all', 'All'],
              ['currency', 'Currency'],
              ['vip', 'VIP'],
              ['vendor', 'Vendors'],
              ['treasury', 'Treasury'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilterKind(key)}
              className={cn(
                'cursor-pointer border px-2.5 py-1 font-heading text-[0.62rem] tracking-[0.14em] uppercase',
                filterKind === key
                  ? 'border-brand-gold bg-brand-gold text-brand-black font-semibold'
                  : 'hairline-border bg-brand-black text-brand-muted hover:text-brand-white',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-4 max-h-72 space-y-2 overflow-y-auto pr-1">
          {loading ? (
            <p className="text-xs text-brand-muted">Loading live transactions...</p>
          ) : visibleTx.length === 0 ? (
            <p className="text-xs text-brand-muted">No transactions in this category yet.</p>
          ) : (
            visibleTx.slice(0, 40).map((tx) => {
              const badge = kindBadge(tx.kind);
              const Icon = badge.icon;
              return (
                <div
                  key={tx.id}
                  className="flex flex-wrap items-center justify-between gap-2 border hairline-border bg-brand-black/75 px-3.5 py-2.5 text-xs"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 border px-1.5 py-0.5 font-heading text-[9px] tracking-[0.14em] uppercase',
                          badge.cls,
                        )}
                      >
                        <Icon className="h-2.5 w-2.5" />
                        {badge.label}
                      </span>
                      <span className="font-medium text-brand-white">{tx.title}</span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-brand-muted">{tx.subtitle}</p>
                  </div>

                  <div className="text-right">
                    <span className="block font-heading text-[10px] tracking-[0.14em] text-brand-gold uppercase">
                      {tx.status}
                    </span>
                    <span className="font-mono text-[10px] text-brand-muted">
                      {new Date(tx.timestamp).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}
