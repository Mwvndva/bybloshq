import { Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getCreatorShopUrl, getShopUsername } from '@/lib/shopLinks';
import { money, type LinkedShop } from './creatorDashboardUtils';

interface CreatorLinkedShopsProps {
  shops: LinkedShop[];
  onCopy: (link: string, label?: string) => void;
}

export function CreatorLinkedShops({ shops, onCopy }: CreatorLinkedShopsProps) {
  return (
    <section className="rounded-3xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0a0a0a] p-4 text-slate-950 dark:text-white shadow-sm transition-colors duration-200">
      <h2 className="text-xl font-black text-slate-950 dark:text-white">Linked shops</h2>
      <div className="mt-4 grid gap-3">
        {shops.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/30 p-4 text-sm font-medium text-slate-500 dark:text-white/45">
            No linked shops yet.
          </div>
        ) : shops.map((shop) => {
          const link = getCreatorShopUrl(shop.shop_name, shop.code);
          const shopUsername = getShopUsername(shop.shop_name);
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
                <Button variant="outline" onClick={() => onCopy(link, shopUsername)} className="border-slate-300 dark:border-white/10 bg-white dark:bg-transparent text-slate-800 dark:text-white hover:bg-slate-100 dark:hover:bg-white/5">
                  <Copy className="mr-2 h-4 w-4" />
                  Copy link
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
