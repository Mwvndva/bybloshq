# Swipe Navigation Unification — Design

Date: 2026-07-27
Status: Approved (pending spec review)

## Problem

Tab swipe navigation is implemented twice, independently, and the two versions
have diverged in quality and feel:

- **Buyer** — `src/components/buyer/dashboard/hooks/useBuyerSwipeNav.ts`. A clean,
  extracted hook. Start point stored in a `useRef` (x + y, no re-render). Guards:
  single-touch only, disabled while the profile sheet is open, minimum horizontal
  distance of 64px, and rejects the gesture when vertical drift exceeds 80px.
  Sections `['shop','shops','wishlist','orders']`. Edges clamp (no wraparound).

- **Seller** — inlined in `src/components/seller/SellerDashboard.tsx` (lines
  ~188–213). Start point stored in `useState` (x only). Threshold 50px, and that
  is the only guard. Tabs `['overview','products','orders','withdrawals','settings']`.

### Defects in the seller implementation

1. **Rules-of-Hooks violation (critical).** `useState(touchStartX)` is declared
   *after* three conditional early returns (`if (children)…`,
   `if (isAuthLoading || isLoading)…`, `if (!analytics || error)…`). Hook order
   changes between renders, risking React's "rendered fewer hooks than expected"
   error and state corruption.
2. **No vertical-drift guard.** A mostly-vertical scroll with >50px of incidental
   horizontal motion flips tabs accidentally.
3. **No multi-touch guard.** A pinch / two-finger gesture can register as a swipe.

Overarching: duplicated touch-wiring with different thresholds means the two
dashboards feel different and every fix must be made twice.

## Goal

Unify both dashboards onto a single, generic swipe hook, and fix the seller
defects by construction in the process.

## Approach (selected: A — generic `useSwipeTabs`)

A single hook, parametrized by the tab list, used by both dashboards. The old
buyer hook is deleted and the seller's inline handlers removed. The shared
defaults adopt the buyer's stronger guards, so the seller's three defects are
resolved simply by switching to the hook (and by the hook being called above the
early returns alongside the other hooks).

Alternatives considered and rejected:
- **B — shared pure helper, two hooks.** Less disruptive but keeps the touch
  wiring duplicated; the two can drift again.
- **C — generic hook + derive order from the visible nav bar.** Stronger
  invariant, but buyer/seller nav structures differ; over-scoped for now.

## Design

### The hook — `src/hooks/useSwipeTabs.ts`

```ts
import { useRef, type TouchEvent } from 'react';

export interface UseSwipeTabsOptions<T extends string> {
  /** Ordered tab ids, left-to-right, matching the visible tab bar. */
  tabs: readonly T[];
  /** Currently active tab id. */
  activeTab: T;
  /** Called with the target tab id when a valid horizontal swipe completes. */
  onChange: (tab: T) => void;
  /** When true, all gestures are ignored (e.g. an overlay/sheet is open). */
  disabled?: boolean;
  /** Minimum horizontal travel to count as a swipe. Default 64. */
  minDistance?: number;
  /** Maximum vertical travel allowed; above this the gesture is treated as a
   *  scroll and ignored. Default 80. */
  maxVerticalDrift?: number;
}

export function useSwipeTabs<T extends string>({
  tabs,
  activeTab,
  onChange,
  disabled = false,
  minDistance = 64,
  maxVerticalDrift = 80,
}: UseSwipeTabsOptions<T>): {
  onTouchStart: (e: TouchEvent<HTMLElement>) => void;
  onTouchEnd: (e: TouchEvent<HTMLElement>) => void;
  onTouchCancel: () => void;
};
```

Behavior:
- `onTouchStart`: ignore if `disabled` or `touches.length !== 1`; otherwise store
  `{ x, y }` of the single touch in a `useRef`.
- `onTouchEnd`: read + clear the stored start. Bail if no start, `disabled`, or
  `changedTouches.length !== 1`. Bail if `activeTab` is not in `tabs`. Compute
  `dx`, `dy`; bail if `|dx| < minDistance` or `|dy| > maxVerticalDrift`. Target is
  `tabs[dx < 0 ? idx + 1 : idx - 1]`; if it exists (edge clamp — no wraparound),
  call `onChange(target)`.
- `onTouchCancel`: reset the start ref.

Element typing uses `HTMLElement`; the handlers remain assignable to a `<div>`'s
`onTouch*` props (the current containers are divs).

### Call-site changes

**Buyer — `src/components/buyer/dashboard/BuyerDashboard.tsx`**
- Remove the `useBuyerSwipeNav` import; add `import { useSwipeTabs } from '@/hooks/useSwipeTabs'`.
- Add a module constant: `const SWIPE_SECTIONS = ['shop','shops','wishlist','orders'] as const;`
- Replace the hook call with:
  ```ts
  const { onTouchStart, onTouchEnd, onTouchCancel } = useSwipeTabs({
    tabs: SWIPE_SECTIONS,
    activeTab: activeSection,
    onChange: setActiveTab,
    disabled: isProfileSidebarOpen,
  });
  ```
  (`setActiveTab` accepts the wider `BuyerSection`, which is assignable to the
  hook's narrower `onChange` parameter.)
- Add `onTouchCancel={onTouchCancel}` to the existing scroll container that
  already carries `onTouchStart` / `onTouchEnd`.

**Seller — `src/components/seller/SellerDashboard.tsx`**
- Hoist `TABS_ORDER` to module scope (typed `readonly SellerTabId[]`).
- Call the hook beside the other hooks, right after `handleSelectTab` (~line 114),
  **above** the early returns:
  ```ts
  const { onTouchStart, onTouchEnd, onTouchCancel } = useSwipeTabs({
    tabs: TABS_ORDER,
    activeTab,
    onChange: handleSelectTab,
  });
  ```
- Delete the inline `useState(touchStartX)`, `handleTouchStart`, `handleTouchEnd`
  (current lines ~188–213).
- Update the container `<div>` to use `onTouchStart` / `onTouchEnd` /
  `onTouchCancel` from the hook.

**Deletion**
- Remove `src/components/buyer/dashboard/hooks/useBuyerSwipeNav.ts`.

### Deliberate behavior change (seller)

Seller adopts the shared 64px threshold (was 50px) and gains the vertical-drift
and multi-touch guards it previously lacked. Net effect: fewer accidental tab
flips during vertical scrolling. Buyer behavior is unchanged. This is an intended
improvement, not a silent regression.

## Testing

Add `src/hooks/useSwipeTabs.test.ts` (vitest + `@testing-library/react`
`renderHook`), invoking the returned handlers with synthetic touch objects:

- Swipe left → advances to next tab.
- Swipe right → returns to previous tab.
- Horizontal travel below `minDistance` → no `onChange`.
- Vertical drift above `maxVerticalDrift` → no `onChange`.
- `touches.length !== 1` (multi-touch) → no `onChange`.
- `disabled: true` → no `onChange`.
- Edge clamp: first tab + swipe right → no `onChange`; last tab + swipe left → no
  `onChange`.

Then verify the whole suite: `tsc --noEmit`, `eslint` on changed files, and
`npm run build`.

## Files touched

- Add: `src/hooks/useSwipeTabs.ts`
- Add: `src/hooks/useSwipeTabs.test.ts`
- Edit: `src/components/buyer/dashboard/BuyerDashboard.tsx`
- Edit: `src/components/seller/SellerDashboard.tsx`
- Delete: `src/components/buyer/dashboard/hooks/useBuyerSwipeNav.ts`

## Out of scope

- No wraparound between first/last tabs.
- No animated/drag-follow swipe transitions (this stays a discrete
  start/end gesture).
- No change to which tabs exist or their order.
- Deriving swipe order from the nav bar (Approach C).
