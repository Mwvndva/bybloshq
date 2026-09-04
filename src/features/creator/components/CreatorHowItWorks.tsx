import React, { useState } from 'react';
import { Sparkles, Store, Send, Link as LinkIcon, DollarSign, Wallet, ChevronDown, ChevronUp, HelpCircle } from 'lucide-react';

export function CreatorHowItWorks() {
  const [isExpanded, setIsExpanded] = useState(true);

  const steps = [
    {
      step: '1',
      icon: Store,
      title: 'Explore Shops',
      desc: 'Discover registered seller shops offering commission. Tap to preview their storefront in read-only mode to see what you will promote.'
    },
    {
      step: '2',
      icon: Send,
      title: 'Request Collaboration',
      desc: 'Send a collaboration request with one tap. Sellers review your creator profile and accept.'
    },
    {
      step: '3',
      icon: LinkIcon,
      title: 'Get Custom Links',
      desc: 'Once approved, your unique tracking link is generated in "Your links". Copy and share with your audience.'
    },
    {
      step: '4',
      icon: DollarSign,
      title: 'Earn Sales Commission',
      desc: 'Earn the seller’s commission percentage on every delivered order made through your link.'
    },
    {
      step: '5',
      icon: Wallet,
      title: 'M-Pesa Withdrawals',
      desc: 'Funds clear in 2 business days (T+2). Withdraw directly to your M-Pesa with transparent tracking.'
    }
  ];

  return (
    <section className="rounded-3xl border border-yellow-400/30 bg-slate-50 dark:bg-[#0a0a0a] p-4 sm:p-6 shadow-sm transition-colors duration-200">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-yellow-400/15 border border-yellow-400/30 text-yellow-600 dark:text-yellow-400">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black tracking-tight text-slate-950 dark:text-white">
              How Byblos Creators Works
            </h2>
            <p className="text-xs text-slate-500 dark:text-white/50">
              Promote verified shops, earn passive income, and withdraw safely.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-900 dark:text-white/50 dark:hover:text-white px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.03] transition-colors"
          aria-label={isExpanded ? 'Collapse guide' : 'Expand guide'}
        >
          <span>{isExpanded ? 'Hide' : 'Show Guide'}</span>
          {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </div>

      {isExpanded && (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5 animate-in fade-in duration-300">
          {steps.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.step}
                className="relative flex flex-col justify-between rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.02] p-4 shadow-sm"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-yellow-400 font-black text-[11px] text-black">
                      {item.step}
                    </span>
                    <Icon className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                  </div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">
                    {item.title}
                  </h3>
                  <p className="mt-1.5 text-xs text-slate-600 dark:text-white/60 leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
