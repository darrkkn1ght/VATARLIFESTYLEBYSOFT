import { useCallback, useEffect, useState } from 'react';
import { BadgeCheck, Ban, CheckCircle2, Loader2, RefreshCw, Store } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
  adminModerateVendorStore,
  fetchVendorStores,
} from '@/features/vendors/services/vendorService';
import type { VendorStoreDirectoryRow, VendorStoreStatus } from '@/lib/supabase/database.types';

export function AdminVendorsPanel() {
  const [stores, setStores] = useState<VendorStoreDirectoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadStores = useCallback(async () => {
    const res = await fetchVendorStores();
    if (!res.error) setStores(res.stores);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadStores();
  }, [loadStores]);

  const handleModerate = async (
    store: VendorStoreDirectoryRow,
    status: VendorStoreStatus,
    isVerified?: boolean,
  ) => {
    setBusyId(store.id);
    const res = await adminModerateVendorStore({
      storeId: store.id,
      status,
      isVerified,
    });
    setBusyId(null);
    if (res.store) {
      setMessage(`Updated "${store.store_name}" (${status}).`);
      await loadStores();
    }
  };

  if (loading) {
    return (
      <div className="border hairline-border bg-brand-charcoal/50 p-6 text-xs text-brand-muted">
        <Loader2 className="mr-2 inline h-4 w-4 animate-spin text-brand-gold" />
        Loading Vendor Storefronts...
      </div>
    );
  }

  return (
    <section className="border hairline-border bg-brand-charcoal/55 p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="heading-eyebrow flex items-center gap-1.5">
            <Store className="h-3.5 w-3.5 text-brand-gold" />
            Vendor Storefronts ({stores.length})
          </p>
          <p className="mt-0.5 font-body text-xs text-brand-muted">
            Verify trusted community vendors or suspend any store breaking rules.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => void loadStores()}>
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>

      {message && (
        <div className="border border-brand-gold/40 bg-brand-black/80 px-4 py-2 text-xs text-brand-gold">
          {message}
        </div>
      )}

      {stores.length === 0 ? (
        <p className="text-xs text-brand-muted">No vendor storefronts created yet.</p>
      ) : (
        <div className="space-y-2.5">
          {stores.map((s) => (
            <div
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-3 border hairline-border bg-brand-black/75 p-4 text-xs"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-heading text-sm font-semibold text-brand-white">
                    {s.store_name}
                  </span>
                  <span className="font-mono text-brand-gold">@{s.owner_username}</span>
                  {s.is_verified && (
                    <span className="inline-flex items-center gap-1 border border-emerald-500/45 bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-300 uppercase">
                      <BadgeCheck className="h-3 w-3" />
                      Verified
                    </span>
                  )}
                  <span className="border hairline-border px-2 py-0.5 text-[10px] text-brand-muted uppercase">
                    {s.status}
                  </span>
                </div>
                <p className="mt-1 text-brand-muted">
                  /dashboard/vendors/{s.slug} &bull; {s.active_listings_count} listings &bull;{' '}
                  {s.completed_sales_count} completed sales
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={busyId === s.id}
                  onClick={() => void handleModerate(s, 'approved', !s.is_verified)}
                >
                  <BadgeCheck className="h-3.5 w-3.5 text-brand-gold" />
                  {s.is_verified ? 'Remove Badge' : 'Verify Vendor'}
                </Button>
                {s.status !== 'suspended' ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busyId === s.id}
                    onClick={() => void handleModerate(s, 'suspended')}
                  >
                    <Ban className="h-3.5 w-3.5" />
                    Suspend
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={busyId === s.id}
                    onClick={() => void handleModerate(s, 'approved')}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Reinstate
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
