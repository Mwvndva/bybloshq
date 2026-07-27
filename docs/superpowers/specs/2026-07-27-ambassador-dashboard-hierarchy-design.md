# Ambassador (Creator) Dashboard — Hierarchy Rework Design

Date: 2026-07-27
Status: Approved (pending spec review)

## Problem

The ambassador dashboard (`src/pages/creator/CreatorDashboard.tsx`) is already
theme-aware and renders dark by default (it uses proper `dark:` pairs and the app
toggles a real `.dark` class, defaulting to dark) — so, unlike the seller
dashboard, it has **no coherence problem**. Its weakness is **information
hierarchy**:

- It opens with a generic 4-tile KPI grid (Balance, Completed sales, Ambassador
  earnings, Link clicks) — the templated "big number + label" answer, not a
  thesis. Two of those tiles are competing money numbers (Balance vs Ambassador
  earnings) with no single "what's mine now."
- Every section is a near-identical `rounded-3xl` bordered card, so the page
  reads as an undifferentiated list: nothing signals what matters.
- The ambassador's core job is **earning by sharing**, yet the shareable seller-
  referral link is buried second-to-last and the leaderboard (motivating social
  proof) sits low too.
- Copy is system-voiced ("Track clicks, sales, earnings, referrals, and
  withdrawals.").

## Goal

Re-rank and re-weight the **existing** content so the page leads with the
ambassador's goal — **share & grow** — and reads by hierarchy instead of listing.
No new data, endpoints, or features. Keep the existing dark theme-aware palette
(`dark:` pairs, gold `#f5c518`/yellow accent, Nunito Sans) and mobile-first
responsive layout. Hierarchy comes from size, accent presence, and spacing — not
a new color system.

## Approach (selected: A — hero + re-rank + weight, reusing content)

Build one bold hero, reorder the sections by the ambassador's goals, vary card
weight, and rewrite copy — reusing the existing content and data. Rejected:
B (full visual redesign — larger/riskier than a hierarchy rework) and C (re-order
only — leaves the flat/templated feel unfixed).

## Design

### Data (all already available — no new hooks/endpoints)

From the existing `useCreatorDashboardQuery` + `useCreatorReferralDashboardQuery`:
- `creator.totalEarnings` — total ambassador earnings (the hero's authoritative money figure).
- `creator.balance` — withdrawable balance (moves to "Get paid").
- `creator.totalSales`, `dashboard.linkClicks` — supporting stats.
- `chartData` (derived from `dashboard.analysis`/`monthly`) — this-period momentum: the latest row's `earnings`/`sales`/`clicks`.
- `referral.referralCode` — builds the evergreen seller-referral link `${origin}/seller/register?ref=CODE`.

### New section order (top → bottom)

1. **Header** (unchanged): notification bell, `AppThemeDropdown`, `AccountSwitcher`.
2. **Earnings hero** (heaviest, gold-accented) — new component.
3. **Shop requests** — conditional; only rendered when `dashboard.shopRequests.length > 0`. A prominent action callout ("accept to start earning").
4. **Your links** (`CreatorLinkedShops`, retitled) — the per-shop shareable links. Medium weight.
5. **How you're doing** (`CreatorAnalysisCharts`, retitled) — clicks→sales→earnings chart with the period toggle. Medium weight.
6. **Get paid** (withdraw panel, retitled) — balance + amount input + Withdraw + recent withdrawals. Utility weight (quieter than today, where it sits top-right beside the charts).
7. **How you rank** (leaderboard, retitled) — top ambassadors. Light/motivational.
8. **Account** (logout) — footer, lightest.

The current 4-tile KPI `<section>` is **removed**; its numbers are absorbed into
the hero (earnings) and Get-paid (balance).

### The hero — `src/pages/creator/CreatorEarningsHero.tsx` (new)

Props (plain values passed from `CreatorDashboard`, no data fetching inside):
```ts
interface CreatorEarningsHeroProps {
  firstName?: string;
  totalEarnings: number;      // creator.totalEarnings
  balance: number;            // creator.balance
  monthEarnings: number;      // latest chartData row earnings (0 if none)
  monthSales: number;         // latest chartData row sales
  monthClicks: number;        // latest chartData row clicks
  referralLink: string;       // `${origin}/seller/register?ref=CODE`
  onCopyLink: () => void;     // reuse existing copy(referralLink)
  onGoToWithdraw: () => void; // scrolls/focuses the Get-paid section
}
```

Content & weight:
- Eyebrow: `AMBASSADOR · {firstName}` (gold, uppercase, tracked).
- Headline — the proof:
  - If `totalEarnings > 0`: `You've earned {money(totalEarnings)} so far` (large, `text-white`), with a momentum chip beside/under it when `monthEarnings > 0`: `↗ +{money(monthEarnings)} this month`.
  - Zero-state (`totalEarnings === 0`): `{firstName}, your links are ready to earn` + subline `Share your link to make your first KSh 3.`
- Supporting stats (small, muted — not tiles): `{monthClicks} clicks · {monthSales} sales this month`.
- The link artifact: the `referralLink` in a bordered field with a **Share/Copy** action (`onCopyLink`). This is the signature element — the link next to what it has earned.
- Subline (the offer, user voice): `Earn KSh 3 on every product your sellers sell — no time limit.`
- Balance pointer: `Balance {money(balance)} ready ›` acting as a button that calls `onGoToWithdraw` (one tap to cash out without making withdraw the hero focus).
- Visual: the one bold element — full-bleed gold gradient accent (e.g. `bg-yellow-400/10` field + gold border, larger radius/padding than other cards), dark surface underneath, theme-aware. One restrained load animation: a count-up (or fade) on the earnings figure, guarded by `prefers-reduced-motion`.

### Weight variation (the core hierarchy fix)

- **Hero**: full-bleed, gold gradient, largest type, most padding. The single bold thing.
- **Primary** (Your links, How you're doing): normal dark cards, section header in `text-white` with a small gold icon.
- **Utility** (Get paid, How you rank): quieter — smaller/muted section headers (`text-white/60`), same dark card but visually recessive.
- **Footer** (Account): lightest, minimal.

No new palette; weight is expressed through size, spacing, accent presence, and header treatment only.

### Copy rewrite (user voice)

| Element | Before | After |
| --- | --- | --- |
| Hero intro | `Welcome, {name}` / `Track clicks, sales, earnings, referrals, and withdrawals.` | `You've earned {money} so far` / `Earn KSh 3 on every product your sellers sell — no time limit.` |
| Linked shops | `Linked shops` | `Your links` |
| Charts | (analysis section) | `How you're doing` |
| Withdraw | `Withdraw` | `Get paid` |
| Leaderboard | `Top ambassadors` | `How you rank` |
| Buttons | `Copy seller link` / `Withdraw to M-Pesa` | `Share link` / `Withdraw to M-Pesa` (kept) |

Empty/zero states are invitations, not blanks (hero zero-state above; if no linked
shops yet, "Your links" shows "Accept a shop request to get your first
shareable link.").

### Files touched

- Add: `src/pages/creator/CreatorEarningsHero.tsx` (the hero).
- Modify: `src/pages/creator/CreatorDashboard.tsx` (remove 4-tile grid; reorder sections; render the hero; add a ref/handler for `onGoToWithdraw`; retitle sections; weight classes).
- Modify (light): `src/pages/creator/CreatorLinkedShops.tsx` (section title → "Your links"; zero-state copy), `src/pages/creator/CreatorAnalysisCharts.tsx` (section title → "How you're doing").
- `src/pages/creator/CreatorMetric.tsx`: repurposed for the hero's small supporting stats, or left unused if the hero inlines them. If it becomes unused after removing the 4-tile grid, delete it and drop its import.

## Testing / Verification

- `npx tsc --noEmit` → 0; `npx eslint <changed files>` → 0; `npm run build` → exit 0.
- Visual pass (run/verify skill on the running app):
  - Hero renders with earnings + momentum + link + Share; balance pointer scrolls to Get-paid.
  - Zero-earnings state shows the invitation copy, not a blank/`KSh 0` hero.
  - Section order and weight match this spec; the 4-tile grid is gone.
  - Keyboard focus visible on Share/Copy/Withdraw/balance-pointer; `prefers-reduced-motion` disables the count-up.
  - Renders correctly in dark (default) and, since it stays theme-aware, in light.

## Out of scope

- Any new metric, endpoint, or ambassador feature.
- The buyer dashboard (separate, already lean).
- Changing the withdrawal logic, referral economics, or chart data.
- A new color system / full visual redesign (Approach B).
