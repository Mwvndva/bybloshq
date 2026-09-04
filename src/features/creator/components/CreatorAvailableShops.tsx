import React, { useState } from 'react';
import { Store, ExternalLink, Send, Check, Clock, Loader2, Sparkles, MapPin, Package } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/shared/ui/button';
import { getImageUrl } from '@/shared/utils/formatting';
import { useAvailableShopsQuery } from '../hooks/queries/useAvailableShopsQuery';
import { useRequestCollaborationMutation } from '../hooks/mutations/useRequestCollaborationMutation';
import type { AvailableShop } from '../api/marketplace';

export function CreatorAvailableShops() {
  const { data: shops = [], isLoading, refetch } = useAvailableShopsQuery();
  const requestMutation = useRequestCollaborationMutation();
  const [requestingShopId, setRequestingShopId] = useState<number | null>(null);

  const handleSendRequest = async (shop: AvailableShop) => {
    setRequestingShopId(shop.id);
    try {
      await requestMutation.mutateAsync({ sellerId: shop.id });
      toast.success(`Collaboration request sent to ${shop.shopName}!`);
      refetch();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } }; message?: string };
      toast.error(error.response?.data?.message || error.message || 'Could not send request.');
    } finally {
      setRequestingShopId(null);
    }
  };

  return (
    <section className="rounded-3xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0a0a0a] p-5 sm:p-6 shadow-sm transition-colors duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black tracking-tight text-slate-950 dark:text-white">
              Explore Available Shops
            </h2>
            <span className="rounded-full bg-yellow-400/20 border border-yellow-400/30 text-yellow-600 dark:text-yellow-400 text-xs font-black px-2.5 py-0.5">
              Marketplace
            </span>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-white/50">
            Shops currently seeking creators. Preview their products and request to promote them.
          </p>
        </div>

        {shops.length > 0 && (
          <span className="text-xs font-bold text-slate-500 dark:text-white/40">
            {shops.length} {shops.length === 1 ? 'shop' : 'shops'} available
          </span>
        )}
      </div>

      <div className="mt-5">
        {isLoading ? (
          <div className="flex min-h-[160px] items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-yellow-500" />
          </div>
        ) : shops.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.02] p-8 text-center">
            <Store className="h-10 w-10 mx-auto text-slate-400 dark:text-white/20 mb-2" />
            <p className="text-sm font-black text-slate-900 dark:text-white">No shops currently listed</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-white/50 max-w-sm mx-auto">
              Check back soon! When sellers list their stores in the Creator Marketplace, they will appear here.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shops.map((shop) => {
              const commissionPercent = (shop.creatorCommissionRate * 100).toFixed(1).replace(/\.0$/, '');
              const previewUrl = `/${shop.slug || shop.shopName}?view=creator-preview`;
              const isRequesting = requestingShopId === shop.id;

              return (
                <div
                  key={shop.id}
                  className="flex flex-col justify-between rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.02] p-4 sm:p-5 shadow-sm hover:border-yellow-400/40 transition-colors"
                >
                  <div>
                    {/* Top Row: Shop Avatar / Icon & Commission Badge */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {shop.logoUrl ? (
                          <img
                            src={getImageUrl(shop.logoUrl)}
                            alt={shop.shopName}
                            className="h-11 w-11 rounded-xl object-cover border border-black/10 dark:border-white/10"
                          />
                        ) : (
                          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-yellow-400/20 text-yellow-600 dark:text-yellow-400 border border-yellow-400/30">
                            <Store className="h-6 w-6" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <h3 className="font-black text-slate-900 dark:text-white truncate text-base">
                            {shop.shopName}
                          </h3>
                          {shop.location && (
                            <p className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-white/50 truncate">
                              <MapPin className="h-3 w-3 shrink-0" />
                              {shop.location}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="rounded-xl bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 text-center shrink-0">
                        <span className="block text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-tight">
                          Commission
                        </span>
                        <span className="block text-sm font-black text-emerald-600 dark:text-emerald-300">
                          {commissionPercent}%
                        </span>
                      </div>
                    </div>

                    {/* Middle Info */}
                    <div className="mt-4 flex items-center gap-3 text-xs text-slate-600 dark:text-white/60">
                      <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-white/[0.04] px-2.5 py-1">
                        <Package className="h-3.5 w-3.5" />
                        <strong>{shop.productCount}</strong> products
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-5 pt-3 border-t border-slate-100 dark:border-white/5 flex items-center gap-2">
                    {/* Preview button */}
                    <Button
                      asChild
                      variant="outline"
                      className="h-9 flex-1 border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.03] text-slate-800 dark:text-white hover:bg-slate-100 dark:hover:bg-white/10 text-xs font-bold"
                    >
                      <Link to={previewUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                        Preview Shop
                      </Link>
                    </Button>

                    {/* Request / status button */}
                    {shop.collaborationStatus === 'active' ? (
                      <span className="inline-flex h-9 items-center justify-center gap-1 px-3 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-xs font-bold border border-emerald-500/30">
                        <Check className="h-3.5 w-3.5" />
                        Promoting
                      </span>
                    ) : shop.collaborationStatus === 'pending' ? (
                      <span className="inline-flex h-9 items-center justify-center gap-1 px-3 rounded-xl bg-yellow-400/20 text-yellow-700 dark:text-yellow-300 text-xs font-bold border border-yellow-400/30">
                        <Clock className="h-3.5 w-3.5" />
                        Pending
                      </span>
                    ) : (
                      <Button
                        type="button"
                        onClick={() => handleSendRequest(shop)}
                        disabled={isRequesting}
                        className="h-9 px-3.5 bg-yellow-400 font-black text-black hover:bg-yellow-300 text-xs"
                      >
                        {isRequesting ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <>
                            <Send className="mr-1.5 h-3.5 w-3.5" />
                            Request
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
