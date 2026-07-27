# Theme System Consolidation — Design

Date: 2026-07-27
Status: Approved (implementing stage by stage)

## Problem

The app has one theme engine (`useAppTheme`, single global key `byblos-app-theme`,
applies `.dark`/`.light` + `[data-theme]` to `<html>`, default dark) but **three
inconsistent selector UIs** all writing that one global pref:
`AppThemeToggle` (grid, seller Settings), `AppThemeDropdown` (dropdown, ambassador
header), and an inline button row in `BuyerProfileSheet`. Only buyer and
ambassador actually honor the theme; the seller dashboard is hardcoded dark (and
breaks in light mode); the shop page has no light/dark control. Modals are
inconsistent (base `ui/dialog.tsx` is light-only; seller modals fixed dark).

## Decisions (from the human)

- **Per-surface theming.** Each dashboard owns its own light/dark/system
  preference: **buyer**, **seller**, and **ambassador** are independent scopes.
- **Shop page** light/dark/system is the **visitor's own** toggle, stored
  per-device, independent of any dashboard.
- **Accent color** (the shop "theme" chosen in seller Settings) drives **only**
  accents — buttons, icons, highlights (`--theme-accent`) — on both the seller
  dashboard and the shop page. It is not light/dark.
- **One consistent selector UI:** a **segmented "long pill"** with three inner
  segments. Delete the three existing selectors.
- Pill segment order is **System, Light, Dark**, and **System is the default**
  preference for every scope.
- Seller dashboard becomes **fully theme-aware** ("fuller"), not a catch-all
  band-aid.

## Architecture

### Scopes

`type ThemeScope = 'buyer' | 'seller' | 'ambassador' | 'shop' | 'default'`

- localStorage key per scope: `byblos-theme-<scope>`.
- Each scope's pref is `'system' | 'light' | 'dark'`, **defaulting to `'system'`**.
- Migration: on first read of a scope key, if it is unset but the legacy
  `byblos-app-theme` exists, seed from it; otherwise `'system'`.
- `default` scope covers routes with no dedicated surface (auth, landing, etc.).

### Engine — `src/hooks/useAppTheme.ts` (generalized)

Keep the existing resolve/apply helpers; generalize the hook:

```ts
export type AppTheme = 'system' | 'light' | 'dark';
export type ThemeScope = 'buyer' | 'seller' | 'ambassador' | 'shop' | 'default';

// resolveTheme(pref) -> 'light' | 'dark'   (system reads prefers-color-scheme)
// applyResolvedTheme(resolved): sets .dark/.light + data-theme on <html>  (existing applyTheme)
export function readScopePref(scope: ThemeScope): AppTheme;   // localStorage or 'system'
export function writeScopePref(scope: ThemeScope, pref: AppTheme): void;

// Hook used by a surface's selector: reads/writes this scope's pref and, because
// the selector only renders on its own surface (the active scope), applies to
// <html> immediately on change.
export function useThemeScope(scope: ThemeScope): { theme: AppTheme; setTheme: (t: AppTheme) => void };
```

A back-compat `useAppTheme()` remains as `useThemeScope('default')` so existing
imports keep working during the migration.

### Route-aware applier — `src/app/ThemeManager.tsx` (new)

A single component mounted once at the app root (inside the router). It owns
`<html>`'s theme so there is no fighting between surfaces:

```
scopeForPath(pathname):
  startsWith('/seller')  -> 'seller'
  startsWith('/creator') -> 'ambassador'
  startsWith('/buyer')   -> 'buyer'      // covers /buyer/shop/*
  isPublicShop(pathname) -> 'shop'       // /shop/:shopName (public storefront)
  else                   -> 'default'
```

On pathname change (and on mount, and on `storage` events), it resolves that
scope's pref and applies it to `<html>`. When the scope's pref is `system` it
subscribes to `prefers-color-scheme`.

**Staged readiness.** A scope is only actively managed once its surface renders
correctly in both light and dark:

```ts
const SCOPE_READY: Record<ThemeScope, boolean> = {
  default: true, buyer: true, ambassador: true,
  seller: false,   // -> true in Stage B
  shop: false,     // -> true in Stage C
};
```

For a not-ready scope, `ThemeManager` applies a fixed fallback that preserves the
surface's current look: `seller -> 'dark'` (its current hardcoded state); `shop`
-> left untouched (the shop page keeps its current accent-driven rendering). This
guarantees no regression between stages.

### The selector — `src/components/common/ThemeSegmentedPill.tsx` (new)

Presentational segmented control (a "long pill" holding three segment pills).

```ts
interface ThemeSegmentedPillProps {
  value: AppTheme;
  onChange: (t: AppTheme) => void;
  showLabels?: boolean;   // default true; false = icon-only compact variant
  className?: string;
}
```

- Segments in order: **System (Monitor), Light (Sun), Dark (Moon)**.
- Container: `inline-flex items-center gap-0.5 rounded-full border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/[0.04] p-0.5`.
- Segment button: `inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-colors`.
  - Active: `bg-white text-slate-950 shadow-sm dark:bg-white/15 dark:text-white`.
  - Inactive: `text-slate-500 hover:text-slate-900 dark:text-white/55 dark:hover:text-white`.
- The accent gold is **not** used for the active segment (this is a control, not a
  CTA) — restraint keeps it reading as a segmented toggle.
- Compact (`showLabels={false}`): icon-only, `px-2.5`, each segment keeps an
  `aria-label`.
- Accessibility: `role="radiogroup" aria-label="Theme"`; each segment
  `role="radio"` with `aria-checked`; left/right arrow keys move selection;
  visible focus ring; the pill is itself theme-aware so it looks right on every
  surface.

### Toasts & modals

- The single global Toaster stays; it follows `<html>` (already uses `dark:`
  classNames + reads theme). No per-scope Toaster needed.
- **`src/components/ui/dialog.tsx`** `DialogContent` default becomes theme-aware:
  `border-slate-200 bg-white text-slate-950 dark:border-white/10 dark:bg-[#0d0d0d] dark:text-white`, so every un-overridden modal follows the active scope.

### Accent (unchanged mechanism)

The shop color continues to drive `--theme-accent` / `--theme-button-bg` on both
the seller dashboard and shop page. The accent picker stays in seller Settings
(`ThemeSelector`) and the shop's accent applies on the storefront. Accent is
orthogonal to light/dark and is not touched by this work beyond confirming the
separation.

## Staged rollout

### Stage A — shared infra + buyer & ambassador
- Generalize `useAppTheme.ts` (scopes, `useThemeScope`, default `'system'`, migration).
- Add `ThemeManager` (buyer/ambassador/default ready; seller fallback dark; shop untouched) and mount it at the router root.
- Add `ThemeSegmentedPill`.
- Make base `ui/dialog.tsx` theme-aware.
- Replace the ambassador `AppThemeDropdown` and the buyer inline selector with the pill, each wired to its scope (`useThemeScope('ambassador')` / `useThemeScope('buyer')`).
- **Delete** `src/components/common/AppThemeDropdown.tsx` and the buyer inline selector block. Leave `AppThemeToggle` (seller) untouched until Stage B.
- Verify: `tsc`, `eslint`, `build`; buyer & ambassador pill switches all three modes correctly (light/dark/system), including toasts and modals.

### Stage B — seller dashboard "fuller"
- Make the `.seller-*` vocabulary in `app.css` theme-aware: e.g.
  `.seller-card { @apply rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#0a0a0a]; }` and the same light-base + `dark:` pattern for `.seller-card-soft`, `.seller-field`, `.seller-eyebrow`, `.seller-heading`, `.seller-subtext`, `.seller-label`, `.seller-value`.
- Add `dark:` pairs to the seller surfaces' literal-dark spots (shadcn `Card`/`DialogContent` given `bg-[#0a0a0a]`, literal `text-white`/`bg-white/[0.0x]` used directly) so light mode is legible. The intentional light chip (service-charge notice) stays.
- Replace `AppThemeToggle` with `ThemeSegmentedPill` wired to `useThemeScope('seller')`; **delete** `AppThemeToggle.tsx`.
- Flip `SCOPE_READY.seller = true`.
- Verify: seller dashboard + its modals render correctly in light, dark, and system; the pill in Settings switches them; no dark-on-dark.

### Stage C — shop page
- Add `ThemeSegmentedPill` to the shop page wired to `useThemeScope('shop')` (visitor-local).
- Convert shop-page surfaces + the hardcoded-light loading/error states to `dark:` pairs so the storefront renders in both modes; keep the accent-driven colors.
- Flip `SCOPE_READY.shop = true`.
- Verify: a visitor toggling the shop pill flips the storefront + its modals + toasts; accent color unchanged by it.

## Files

- Modify: `src/hooks/useAppTheme.ts` (generalize).
- Add: `src/app/ThemeManager.tsx`, `src/components/common/ThemeSegmentedPill.tsx`.
- Modify: `src/components/ui/dialog.tsx` (theme-aware default).
- Stage A: `src/pages/creator/CreatorDashboard.tsx` (pill), `src/components/buyer/dashboard/BuyerProfileSheet.tsx` (pill). Delete `src/components/common/AppThemeDropdown.tsx`.
- Stage B: `src/app.css` (`.seller-*` theme-aware), the seller dashboard files with literal-dark spots, `src/components/seller/dashboard/tabs/SettingsTab.tsx` (pill). Delete `src/components/seller/dashboard/tabs/AppThemeToggle.tsx`.
- Stage C: `src/features/shop/pages/ShopPage.tsx` + shop subcomponents, plus wherever the shop pill mounts.

## Testing / Verification

- Per stage: `npx tsc --noEmit` (0), `npx eslint <changed>` (0), `npm run build` (0).
- Manual pass per stage on the running app: the pill switches System/Light/Dark;
  System follows the OS and reacts to OS changes live; the surface, its modals,
  and toasts all match; scopes are independent (changing seller theme does not
  change buyer/ambassador/shop); the shop pill is per-visitor; accent color is
  unaffected by light/dark.

## Out of scope

- The accent theme mechanism itself (only confirm separation).
- Non-dashboard routes beyond giving them the `default` scope.
- Redesigning any surface beyond what theme-awareness requires.
