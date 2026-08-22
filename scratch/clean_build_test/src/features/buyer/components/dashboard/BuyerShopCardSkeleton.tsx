export function BuyerShopCardSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0a0a0a] p-3 overflow-hidden shadow-sm dark:shadow-[0_10px_30px_rgba(0,0,0,0.45)] transition-colors duration-200">
      <div className="flex gap-3">
        <div className="w-14 h-14 rounded-2xl bg-slate-200 dark:bg-[#232323] animate-pulse shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="h-3 w-[62%] rounded-full bg-slate-200 dark:bg-[#232323] animate-pulse mb-2" />
          <div className="h-2.5 w-[86%] rounded-full bg-slate-200 dark:bg-[#232323] animate-pulse mb-1.5" />
          <div className="h-2.5 w-[54%] rounded-full bg-slate-200 dark:bg-[#232323] animate-pulse" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-1.5 mt-3">
        {[0, 1, 2].map(item => (
          <div key={item} className="h-11 rounded-xl bg-slate-200 dark:bg-[#232323] animate-pulse" />
        ))}
      </div>
      <div className="grid grid-cols-[1fr_auto] gap-2 mt-3">
        <div className="h-10 rounded-xl bg-slate-200 dark:bg-[#232323] animate-pulse" />
        <div className="w-[94px] h-10 rounded-xl bg-yellow-400/20 dark:bg-[#F5C518]/22 animate-pulse" />
      </div>
    </div>
  );
}
