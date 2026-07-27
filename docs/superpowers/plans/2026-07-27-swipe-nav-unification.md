# Swipe Navigation Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the two divergent tab-swipe implementations (buyer hook + seller inline handlers) with one generic `useSwipeTabs` hook, fixing the seller's Rules-of-Hooks violation and its missing vertical-drift / multi-touch guards.

**Architecture:** A single ref-based React hook parametrized by the ordered tab list and the active tab. It returns `onTouchStart` / `onTouchEnd` / `onTouchCancel` handlers spread onto each dashboard's scroll container. Both dashboards adopt the buyer's stronger guards (single-touch, 64px min distance, 80px max vertical drift, edge clamping) as the shared defaults.

**Tech Stack:** React 18 + TypeScript, Vite, Vitest 3 (jsdom, `globals: false`), `@testing-library/react` 16 (`renderHook`).

## Global Constraints

- Default `minDistance` = 64 (px); default `maxVerticalDrift` = 80 (px). Copy verbatim.
- No wraparound: swiping past the first/last tab is a no-op.
- Handlers typed against `TouchEvent<HTMLElement>` (from `react`); they attach to the existing `<div>` containers.
- Vitest runs with `globals: false` — every test file must explicitly `import { describe, it, expect, vi } from 'vitest'`.
- Gates that must pass before each commit that changes code: `npx tsc --noEmit` (0 errors) and `npx eslint <changed files>` (0 errors). The final task also runs `npm run build` (Vite; ~5–8 min).
- Commit messages end with: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
- Note the `src/lib` `.gitignore` rule does NOT affect these files (`src/hooks`, `src/components`, `docs`); normal `git add` works here.

## File Structure

- `src/hooks/useSwipeTabs.ts` (new) — the generic hook. Single responsibility: translate touch start/end into a tab change.
- `src/hooks/useSwipeTabs.test.ts` (new) — unit tests for the hook.
- `src/components/buyer/dashboard/BuyerDashboard.tsx` (modify) — consume the hook.
- `src/components/seller/SellerDashboard.tsx` (modify) — consume the hook; delete inline handlers; hoist tab order.
- `src/components/buyer/dashboard/hooks/useBuyerSwipeNav.ts` (delete) — superseded.

---

### Task 1: Generic `useSwipeTabs` hook (TDD)

**Files:**
- Create: `src/hooks/useSwipeTabs.ts`
- Test: `src/hooks/useSwipeTabs.test.ts`

**Interfaces:**
- Consumes: nothing (leaf hook).
- Produces:
  ```ts
  export interface UseSwipeTabsOptions<T extends string> {
    tabs: readonly T[];
    activeTab: T;
    onChange: (tab: T) => void;
    disabled?: boolean;
    minDistance?: number;      // default 64
    maxVerticalDrift?: number; // default 80
  }
  export interface SwipeTabsHandlers {
    onTouchStart: (event: TouchEvent<HTMLElement>) => void;
    onTouchEnd: (event: TouchEvent<HTMLElement>) => void;
    onTouchCancel: () => void;
  }
  export function useSwipeTabs<T extends string>(
    options: UseSwipeTabsOptions<T>,
  ): SwipeTabsHandlers;
  ```

- [ ] **Step 1: Write the failing test**

Create `src/hooks/useSwipeTabs.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { TouchEvent } from 'react';
import { useSwipeTabs } from './useSwipeTabs';

const TABS = ['a', 'b', 'c'] as const;
type Tab = (typeof TABS)[number];

const startEvent = (x: number, y: number, count = 1) =>
  ({
    touches: Array.from({ length: count }, () => ({ clientX: x, clientY: y })),
  }) as unknown as TouchEvent<HTMLElement>;

const endEvent = (x: number, y: number, count = 1) =>
  ({
    changedTouches: Array.from({ length: count }, () => ({ clientX: x, clientY: y })),
  }) as unknown as TouchEvent<HTMLElement>;

function setup(activeTab: Tab, opts?: { disabled?: boolean }) {
  const onChange = vi.fn();
  const { result } = renderHook(() =>
    useSwipeTabs<Tab>({
      tabs: TABS,
      activeTab,
      onChange,
      disabled: opts?.disabled,
    }),
  );
  return { onChange, result };
}

describe('useSwipeTabs', () => {
  it('advances to the next tab on a leftward swipe', () => {
    const { onChange, result } = setup('a');
    result.current.onTouchStart(startEvent(200, 200));
    result.current.onTouchEnd(endEvent(100, 210)); // dx=-100, dy=10
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('returns to the previous tab on a rightward swipe', () => {
    const { onChange, result } = setup('b');
    result.current.onTouchStart(startEvent(100, 200));
    result.current.onTouchEnd(endEvent(200, 205)); // dx=+100
    expect(onChange).toHaveBeenCalledWith('a');
  });

  it('ignores a swipe shorter than the minimum distance', () => {
    const { onChange, result } = setup('a');
    result.current.onTouchStart(startEvent(200, 200));
    result.current.onTouchEnd(endEvent(160, 205)); // dx=-40
    expect(onChange).not.toHaveBeenCalled();
  });

  it('ignores a gesture with too much vertical drift', () => {
    const { onChange, result } = setup('a');
    result.current.onTouchStart(startEvent(200, 200));
    result.current.onTouchEnd(endEvent(120, 300)); // dx=-80, dy=100
    expect(onChange).not.toHaveBeenCalled();
  });

  it('ignores multi-touch gestures', () => {
    const { onChange, result } = setup('a');
    result.current.onTouchStart(startEvent(200, 200, 2));
    result.current.onTouchEnd(endEvent(100, 205));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('ignores gestures while disabled', () => {
    const { onChange, result } = setup('a', { disabled: true });
    result.current.onTouchStart(startEvent(200, 200));
    result.current.onTouchEnd(endEvent(100, 205));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('clamps at the first tab (no wraparound on rightward swipe)', () => {
    const { onChange, result } = setup('a');
    result.current.onTouchStart(startEvent(100, 200));
    result.current.onTouchEnd(endEvent(200, 205)); // previous of 'a' → none
    expect(onChange).not.toHaveBeenCalled();
  });

  it('clamps at the last tab (no wraparound on leftward swipe)', () => {
    const { onChange, result } = setup('c');
    result.current.onTouchStart(startEvent(200, 200));
    result.current.onTouchEnd(endEvent(100, 205)); // next of 'c' → none
    expect(onChange).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/hooks/useSwipeTabs.test.ts`
Expected: FAIL — cannot resolve `./useSwipeTabs` (module does not exist yet).

- [ ] **Step 3: Write minimal implementation**

Create `src/hooks/useSwipeTabs.ts`:

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
  /** Max vertical travel allowed; above this the gesture is treated as a
   *  scroll and ignored. Default 80. */
  maxVerticalDrift?: number;
}

export interface SwipeTabsHandlers {
  onTouchStart: (event: TouchEvent<HTMLElement>) => void;
  onTouchEnd: (event: TouchEvent<HTMLElement>) => void;
  onTouchCancel: () => void;
}

export function useSwipeTabs<T extends string>({
  tabs,
  activeTab,
  onChange,
  disabled = false,
  minDistance = 64,
  maxVerticalDrift = 80,
}: UseSwipeTabsOptions<T>): SwipeTabsHandlers {
  const startRef = useRef<{ x: number; y: number } | null>(null);

  const onTouchStart = (event: TouchEvent<HTMLElement>) => {
    if (disabled || event.touches.length !== 1) return;
    const touch = event.touches[0];
    startRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const onTouchEnd = (event: TouchEvent<HTMLElement>) => {
    const start = startRef.current;
    startRef.current = null;
    if (!start || disabled || event.changedTouches.length !== 1) return;
    const index = tabs.indexOf(activeTab);
    if (index === -1) return;
    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.abs(deltaX) < minDistance || Math.abs(deltaY) > maxVerticalDrift) return;
    const target = tabs[deltaX < 0 ? index + 1 : index - 1];
    if (target) onChange(target);
  };

  const onTouchCancel = () => {
    startRef.current = null;
  };

  return { onTouchStart, onTouchEnd, onTouchCancel };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/hooks/useSwipeTabs.test.ts`
Expected: PASS — 8 passed.

- [ ] **Step 5: Typecheck + lint**

Run: `npx tsc --noEmit`
Expected: exit 0.
Run: `npx eslint src/hooks/useSwipeTabs.ts src/hooks/useSwipeTabs.test.ts`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useSwipeTabs.ts src/hooks/useSwipeTabs.test.ts
git commit -m "feat(hooks): add generic useSwipeTabs tab-swipe hook

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Migrate buyer dashboard + delete old hook

**Files:**
- Modify: `src/components/buyer/dashboard/BuyerDashboard.tsx` (import line 22; hook call line 160; container `<div>` at lines 189–190)
- Delete: `src/components/buyer/dashboard/hooks/useBuyerSwipeNav.ts`

**Interfaces:**
- Consumes: `useSwipeTabs` from Task 1.
- Produces: nothing new (internal wiring only).

- [ ] **Step 1: Swap the import**

In `src/components/buyer/dashboard/BuyerDashboard.tsx`, replace line 22:

```ts
import { useBuyerSwipeNav } from './dashboard/hooks/useBuyerSwipeNav';
```

with:

```ts
import { useSwipeTabs } from '@/hooks/useSwipeTabs';
```

- [ ] **Step 2: Add the swipe-sections constant**

Immediately after the existing line `const PROFILE_CLOSE_NAV_DELAY_MS = 180;`, add:

```ts
const SWIPE_SECTIONS = ['shop', 'shops', 'wishlist', 'orders'] as const;
```

- [ ] **Step 3: Replace the hook call**

Replace the single line 160:

```ts
  const { onTouchStart: handleDashboardTouchStart, onTouchEnd: handleDashboardTouchEnd } = useBuyerSwipeNav(activeSection, isProfileSidebarOpen, setActiveTab);
```

with:

```ts
  const {
    onTouchStart: handleDashboardTouchStart,
    onTouchEnd: handleDashboardTouchEnd,
    onTouchCancel: handleDashboardTouchCancel,
  } = useSwipeTabs({
    tabs: SWIPE_SECTIONS,
    activeTab: activeSection,
    onChange: setActiveTab,
    disabled: isProfileSidebarOpen,
  });
```

- [ ] **Step 4: Wire onTouchCancel onto the scroll container**

In the main content `<div>` (currently carrying `onTouchStart={handleDashboardTouchStart}` and `onTouchEnd={handleDashboardTouchEnd}`), add a third handler line directly after `onTouchEnd`:

```tsx
        onTouchStart={handleDashboardTouchStart}
        onTouchEnd={handleDashboardTouchEnd}
        onTouchCancel={handleDashboardTouchCancel}
```

- [ ] **Step 5: Delete the superseded hook**

```bash
git rm src/components/buyer/dashboard/hooks/useBuyerSwipeNav.ts
```

- [ ] **Step 6: Confirm no other references remain**

Run: `git grep -n useBuyerSwipeNav -- src`
Expected: no output (zero matches).

- [ ] **Step 7: Typecheck, lint, and run tests**

Run: `npx tsc --noEmit`
Expected: exit 0.
Run: `npx eslint src/components/buyer/dashboard/BuyerDashboard.tsx`
Expected: exit 0.
Run: `npx vitest run`
Expected: all tests pass (including `useSwipeTabs`).

- [ ] **Step 8: Commit**

```bash
git add src/components/buyer/dashboard/BuyerDashboard.tsx
git commit -m "refactor(buyer): use shared useSwipeTabs, drop useBuyerSwipeNav

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Migrate seller dashboard (fixes hooks violation) + full verification

**Files:**
- Modify: `src/components/seller/SellerDashboard.tsx`
  - add import
  - hoist tab order to module scope
  - add hook call after `handleSelectTab` (line 122), above the early returns
  - delete inline handlers (lines ~188–213)
  - add `onTouchCancel` to the container `<div>` (lines ~219–221)

**Interfaces:**
- Consumes: `useSwipeTabs` from Task 1.
- Produces: nothing new (internal wiring only).

- [ ] **Step 1: Add the import**

In `src/components/seller/SellerDashboard.tsx`, add after the existing line `import { useToast } from '@/hooks/use-toast';`:

```ts
import { useSwipeTabs } from '@/hooks/useSwipeTabs';
```

- [ ] **Step 2: Hoist the tab order to module scope**

After the import block (immediately before the component definition that begins with `const [activeTab, setActiveTab] = useState<SellerTabId>('overview');`'s enclosing function), add a module-level constant:

```ts
const SELLER_TABS_ORDER: readonly SellerTabId[] = [
  'overview',
  'products',
  'orders',
  'withdrawals',
  'settings',
];
```

- [ ] **Step 3: Add the hook call beside the other hooks (above the early returns)**

Immediately after the `handleSelectTab` `useCallback` block (which ends at `}, []);` on line 122), insert:

```ts
  const {
    onTouchStart: handleTouchStart,
    onTouchEnd: handleTouchEnd,
    onTouchCancel: handleTouchCancel,
  } = useSwipeTabs({
    tabs: SELLER_TABS_ORDER,
    activeTab,
    onChange: handleSelectTab,
  });
```

This runs unconditionally with the other hooks, which removes the Rules-of-Hooks violation.

- [ ] **Step 4: Delete the inline swipe block**

Remove the entire inline block that currently sits between the last early return and the `return (` — i.e. delete these lines verbatim:

```ts
  // Touch swipe gesture handlers to swipe left / right through seller dashboard tabs
  const TABS_ORDER: SellerTabId[] = ['overview', 'products', 'orders', 'withdrawals', 'settings'];
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX - touchEndX;
    setTouchStartX(null);

    // Swipe threshold: 50px
    if (Math.abs(diff) > 50) {
      const currentIndex = TABS_ORDER.indexOf(activeTab);
      if (diff > 0 && currentIndex < TABS_ORDER.length - 1) {
        // Swiped left -> move to next tab
        handleSelectTab(TABS_ORDER[currentIndex + 1]);
      } else if (diff < 0 && currentIndex > 0) {
        // Swiped right -> move to previous tab
        handleSelectTab(TABS_ORDER[currentIndex - 1]);
      }
    }
  };
```

(The `handleTouchStart` / `handleTouchEnd` names now come from the Step 3 hook call, so the JSX below keeps working.)

- [ ] **Step 5: Wire onTouchCancel onto the container**

In the container `<div>` that has `onTouchStart={handleTouchStart}` and `onTouchEnd={handleTouchEnd}`, add directly after `onTouchEnd`:

```tsx
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
```

- [ ] **Step 6: Typecheck + lint**

Run: `npx tsc --noEmit`
Expected: exit 0. (If TS reports `React.TouchEvent` unused or `useState` unused, that means a stray reference was left — re-check Step 4. `useState` is still used elsewhere in the file, so its import stays.)
Run: `npx eslint src/components/seller/SellerDashboard.tsx`
Expected: exit 0 (no `react-hooks/rules-of-hooks` error — the previous conditional `useState` is gone).

- [ ] **Step 7: Run the test suite**

Run: `npx vitest run`
Expected: all tests pass.

- [ ] **Step 8: Full production build (final gate)**

Run: `npm run build`
Expected: exit 0, `dist/` regenerated. (Vite build takes ~5–8 minutes; run it in the background or allow a long timeout.)

- [ ] **Step 9: Commit**

```bash
git add src/components/seller/SellerDashboard.tsx
git commit -m "refactor(seller): use shared useSwipeTabs, fix hooks-order violation

Moves swipe handling above the early returns (fixing a Rules-of-Hooks
violation) and adds the vertical-drift + multi-touch guards it lacked.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- Generic `useSwipeTabs` hook with the exact option shape → Task 1. ✅
- Buyer migration + `SWIPE_SECTIONS` const + `onTouchCancel` wiring → Task 2. ✅
- Delete `useBuyerSwipeNav.ts` → Task 2 Step 5. ✅
- Seller migration, hoisted tab order, hook above early returns (fixes hooks violation), inline handlers removed, `onTouchCancel` wired → Task 3. ✅
- Deliberate seller behavior change (64px + drift + multi-touch guards) → inherent in adopting the hook defaults (Task 3). ✅
- Tests covering next/prev/threshold/drift/multi-touch/disabled/edge-clamp → Task 1 Step 1 (8 tests). ✅
- Verify `tsc`, `eslint`, `build` → Task 1 Step 5, Task 2 Step 7, Task 3 Steps 6–8. ✅

**Placeholder scan:** No TBD/TODO/"handle edge cases"/"similar to Task N"; all code shown in full.

**Type consistency:** `useSwipeTabs<T>` / `UseSwipeTabsOptions<T>` / `SwipeTabsHandlers` names match across Task 1 definition and Tasks 2–3 usage. Buyer passes `SWIPE_SECTIONS` (union `'shop'|'shops'|'wishlist'|'orders'`) with `onChange: setActiveTab` (accepts wider `BuyerSection`, assignable). Seller passes `SELLER_TABS_ORDER: readonly SellerTabId[]` with `onChange: handleSelectTab` (`(tab: SellerTabId) => void`). Handler names (`handleTouchStart` / `handleTouchEnd` / `handleTouchCancel`) match the seller JSX; buyer aliases (`handleDashboardTouch*`) match the buyer JSX. Consistent. ✅
