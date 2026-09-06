import { Copy, LogOut, Loader2 } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { getCreatorShopUrl, getShopUsername } from '@/shared/utils/shopLinks';
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
          const sellerId = Number(shop.seller_id);
          const isLeaving = leavingSellerId === sellerId;
          return (
            <div key={shop.id} className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/30 p-4 text-slate-950 dark:text-white">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-black text-slate-950 dark:text-white">{shop.shop_name}</p>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-white/40">
                    {Number(shop.commission_rate || 0.01) * 100}% cut | {shop.sales_count || 0} sales | {shop.click_count || 0} clicks | {money(shop.earnings)}
                  </p>
                  {shopUsername && (
                    <a
                      href={link}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 block break-all text-xs font-bold text-yellow-600 dark:text-yellow-100 underline decoration-yellow-400 underline-offset-2"
                      title={link}
                    >
                      {shopUsername}
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-2">
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
