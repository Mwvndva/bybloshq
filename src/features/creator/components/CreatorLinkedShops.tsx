import { Copy, LogOut, Loader2, Store, ExternalLink } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { getCreatorShopUrl, getShopUsername, resolveShareOrigin } from '@/shared/utils/shopLinks';
import { getImageUrl } from '@/shared/utils/formatting';
import { money, type LinkedShop } from '@/features/creator/utils/creatorDashboardUtils';

interface CreatorLinkedShopsProps {
  shops: LinkedShop[];
  onCopy: (link: string, label?: string) => void;
  onLeave: (sellerId: number) => void;
  leavingSellerId: number | null;
  maxPromotions: number;
}

export function CreatorLinkedShops({ shops, onCopy, onLeave, leavingSellerId, maxPromotions }: CreatorLinkedShopsProps) {
  return (
    <section className="rounded-3xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0a0a0a] p-4 text-slate-950 dark:text-white shadow-sm transition-colors duration-200">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black text-slate-950 dark:text-white">Your links</h2>
        <span className="rounded-full border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/[0.04] px-2.5 py-1 text-xs font-bold text-slate-600 dark:text-white/60">
          {shops.length}/{maxPromotions} promoting
        </span>
      </div>
      <div className="mt-4 grid gap-3">
        {shops.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/30 p-4 text-sm font-medium text-slate-500 dark:text-white/45">
            Accept a shop request to get your first shareable link.
          </div>
        ) : shops.map((shop) => {
          const link = getCreatorShopUrl(shop.slug || shop.shop_name, shop.code);
          const shopUsername = getShopUsername(shop.shop_name);
          // Read-only preview: the shop opens in creator-preview mode, which
          // hides add-to-bag and wishlist so the creator can't act on their own
          // shop. The shareable tracking link (for shoppers) stays on Copy link.
          const previewLink = `${resolveShareOrigin()}/${shop.slug || shop.shop_name}?view=creator-preview&rate=${Number(shop.commission_rate || 0.01)}`;
          const sellerId = Number(shop.seller_id);
          const isLeaving = leavingSellerId === sellerId;
          return (
            <div key={shop.id} className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/30 p-4 text-slate-950 dark:text-white">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/[0.04]">
                    {shop.avatar_url ? (
                      <img src={getImageUrl(shop.avatar_url)} alt={shop.shop_name || 'Shop'} className="h-full w-full object-cover" />
                    ) : (
                      <Store className="h-5 w-5 text-slate-400 dark:text-white/40" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-black text-slate-950 dark:text-white truncate">{shop.shop_name}</p>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-white/40">
                      {Number(shop.commission_rate || 0.01) * 100}% cut | {shop.sales_count || 0} sales | {shop.click_count || 0} clicks | {money(shop.earnings)}
                    </p>
                    <a
                      href={previewLink}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-yellow-600 dark:text-yellow-100 underline decoration-yellow-400 underline-offset-2"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Preview shop (read-only)
                    </a>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="outline" onClick={() => onCopy(link, shopUsername)} className="border-slate-300 dark:border-white/10 bg-white dark:bg-transparent text-slate-800 dark:text-white hover:bg-slate-100 dark:hover:bg-white/5">
                    <Copy className="mr-2 h-4 w-4" />
                    Copy link
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => onLeave(sellerId)}
                    disabled={isLeaving || !Number.isFinite(sellerId)}
                    className="border-red-300 dark:border-red-500/30 bg-white dark:bg-transparent text-red-600 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-500/10"
                  >
                    {isLeaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><LogOut className="mr-2 h-4 w-4" />Leave</>}
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
