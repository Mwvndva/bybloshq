import { useMemo, useState } from 'react';
import { Check, ChevronDown, Loader2, Megaphone, ShoppingBag, Store, type LucideIcon } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useMyAccounts } from '../hooks/useMyAccounts';
import { useGlobalAuth } from '../hooks/useGlobalAuth';
import type { SwitchableRole } from '@/api/account';

interface RoleMeta {
  label: string;
  icon: LucideIcon;
}

const isSwitchableRole = (role: unknown): role is SwitchableRole =>
  role === 'buyer' || role === 'seller' || role === 'creator';

// Fixed switch (not a keyed object) so there is no dynamic object indexing —
// avoids the object-injection lint sink and keeps the mapping exhaustive.
const metaForRole = (role: SwitchableRole): RoleMeta => {
  switch (role) {
    case 'seller':
      return { label: 'Seller', icon: Store };
    case 'creator':
      return { label: 'Ambassador', icon: Megaphone };
    case 'buyer':
    default:
      return { label: 'Buyer', icon: ShoppingBag };
  }
};

/**
 * Dropdown that lets a user who owns more than one account type (buyer /
 * seller / ambassador) switch between them. Renders nothing when the user owns
 * a single account, so there is only ever a control when there is somewhere to
 * switch to.
 */
export function AccountSwitcher() {
  const { data } = useMyAccounts();
  const { switchAccount, role: currentRole } = useGlobalAuth();
  const [switching, setSwitching] = useState<SwitchableRole | null>(null);

  // Build the owned list by explicit field access (no dynamic indexing).
  const owned = useMemo<SwitchableRole[]>(() => {
    if (!data) return [];
    const list: SwitchableRole[] = [];
    if (data.accounts.buyer) list.push('buyer');
    if (data.accounts.seller) list.push('seller');
    if (data.accounts.creator) list.push('creator');
    return list;
  }, [data]);

  if (owned.length < 2) return null;

  const active: SwitchableRole = isSwitchableRole(currentRole)
    ? currentRole
    : isSwitchableRole(data?.current)
      ? data.current
      : owned[0];
  const activeMeta = metaForRole(active);
  const ActiveIcon = activeMeta.icon;

  const handleSwitch = async (role: SwitchableRole) => {
    if (role === active || switching) return;
    setSwitching(role);
    try {
      await switchAccount(role);
    } catch {
      /* error toast is surfaced by the auth action */
    } finally {
      setSwitching(null);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/12 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-accent,#f5c518)]"
          aria-label="Switch account"
        >
          <ActiveIcon className="h-4 w-4 text-[var(--theme-accent,#f5c518)]" />
          <span className="hidden sm:inline">{activeMeta.label}</span>
          <ChevronDown className="h-3.5 w-3.5 opacity-70" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-52 border-white/10 bg-[#0a0a0a] text-white"
      >
        <div className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white/40">
          Switch account
        </div>
        {owned.map((role) => {
          const meta = metaForRole(role);
          const Icon = meta.icon;
          const isActive = role === active;
          const isSwitching = switching === role;
          return (
            <DropdownMenuItem
              key={role}
              onSelect={(e) => {
                e.preventDefault();
                void handleSwitch(role);
              }}
              disabled={isActive || !!switching}
              className="flex cursor-pointer items-center gap-2 px-2 py-2 text-sm text-white focus:bg-white/10 focus:text-white data-[disabled]:opacity-100"
            >
              <Icon className="h-4 w-4 text-[var(--theme-accent,#f5c518)]" />
              <span className="flex-1">{meta.label}</span>
              {isActive ? (
                <Check className="h-4 w-4 text-[var(--theme-accent,#f5c518)]" />
              ) : isSwitching ? (
                <Loader2 className="h-4 w-4 animate-spin text-white/60" />
              ) : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default AccountSwitcher;
