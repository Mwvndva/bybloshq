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
        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
          <h2 className="text-xl font-black">Linked shops</h2>
          <div className="mt-4 grid gap-3">
            {shops.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm font-medium text-white/45">
                No linked shops yet.
              </div>
            ) : shops.map((shop) => {
              const link = getCreatorShopUrl(shop.shop_name, shop.code);
              const shopUsername = getShopUsername(shop.shop_name);
              return (
                <div key={shop.id} className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-black">{shop.shop_name}</p>
                      <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
                        {Number(shop.commission_rate || 0.01) * 100}% cut | {shop.sales_count || 0} sales | {shop.click_count || 0} clicks | {money(shop.earnings)}
                      </p>
                      {shopUsername && (
                        <a
                          href={link}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 block break-all text-xs font-bold text-yellow-100 underline decoration-yellow-400 underline-offset-2"
                          title={link}
                        >
                          {shopUsername}
                        </a>
                      )}
                    </div>
                    <Button variant="outline" onClick={() => onCopy(link, shopUsername)} className="border-white/10 bg-transparent text-white hover:bg-white/5">
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
