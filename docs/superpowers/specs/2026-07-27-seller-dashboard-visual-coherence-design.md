# Seller Dashboard Visual Coherence — Design

Date: 2026-07-27
Status: Approved (pending spec review)

## Problem

The seller dashboard is visually incoherent: some surfaces are hardcoded to a
dark black/gold Byblos brand, others are hardcoded light (slate/white), and one
tab bar is light while its native counterpart is dark. Moving between tabs feels
like moving between two different apps, which reads as unfinished and forces the
seller to re-learn the UI per tab.

The split is baked in, not theme-driven:

- The `--byblos-*` tokens in `src/app.css` are **dark-only** (`--byblos-bg:#000`,
  `--byblos-surface:#0a0a0a`, `--byblos-text:#f5f5f5`, `--byblos-border:#262626`).
- "Light mode" is a patchwork of page-scoped override classes
  (`.byblos-light-page`, `.admin-light-dashboard`, `.marketing-light-dashboard`,
  …) that brute-force-repaint dark Tailwind utilities with `!important`. Fragile.
- Individual seller surfaces ignore both systems and hardcode their own light or
  dark values.

Measured signal sweep across `src/components/seller` (light signals =
`bg-white|text-slate-*|border-slate-*|#f8f7f2|bg-yellow-50|text-yellow-[67]00|bg-slate-50`;
dark = `text-white|#0a0a0a|bg-white/[0|border-white/10|bg-black`):

- **Already dark (reference / keep):** `OverviewTab` (L11/D51), `WithdrawalsTab`
  (D40), `WithdrawalRequestForm` (D15), `SellerAmbassadorInvites` (D23),
  `SellerReminders` (D8), `SellerProfileHero` (D12), `SellerDashboardHeader` (D3).
- **Light (convert):** `SettingsTab` (L25), `SettingsBusinessProfileSection`
  (L24/D0), `SettingsLocationSection` (L23/D0), `AppThemeToggle` (L12/D0),
  `ThemeSelector` (L9/D0), `settingsTab.parts` (L10/D0), `SellerProductCards`
  (L19/D0), `SellerProductsTable` (L21/D0), `ProductsTab` (L7),
  `WithdrawalHistoryCard` (L29/D0 — a light card inside the otherwise-dark
  Withdrawals tab), web tab bar in `SellerDashboardTabs` (L6/D2),
  `UnifiedAnalyticsHub` (L3/D0), and the product dialogs `ProductEditDialog`
  (L55/D20), `ProductInventoryDialog` (L25/D14), `ProductEditPhysicalOptions`
  (L32/D13), `ProductDeleteDialog` (L9/D3).
- **Stray light inside dark tabs (clean up):** `OverviewTab` (11),
  `WithdrawalsTab` (6), `SellerAmbassadorInvites` (6).

## Goal

Unify the entire seller dashboard onto **one dark Byblos-brand surface system**
(black + gold), matching the founder card and buyer app. Presentation only — no
data, logic, or layout changes, and no capability is removed. The App-Theme
light toggle and the `.*-light-*` patchwork are a separate pre-existing concern
and are explicitly out of scope.

## Approach (selected: A — shared surface class layer)

Rather than hand-swap hex across ~18 files (which is how the drift started),
define a small dark surface vocabulary **once** and convert every light surface
to it. The existing `.seller-*` CSS convention (`.seller-surface`,
`.seller-balance-hero`, `.seller-tab-selected`, in `src/app.css`) is extended in
place — not replaced with a competing file — so the change follows the codebase's
own pattern. The dark values are taken verbatim from what the hero/Overview
already use, so those surfaces become the reference and need no change beyond
stray-utility cleanup.

Alternatives rejected:
- **B — direct inline restyle:** fastest to start but 18 files of ad-hoc edits,
  easy to miss strays, and re-diverges over time.
- **C — full `--byblos-*` token migration:** most "correct" and would enable a
  real light mode, but the tokens are dark-only today and shadcn `Input`/`Button`
  carry their own theming — the largest blast radius, against the lowest-risk goal.

## Design

### 1. Surface vocabulary

Add to the existing `.seller-*` block in `src/app.css`, inside
`@layer components`, using `@apply` so the classes stay Tailwind-consistent:

```css
@layer components {
  /* Standard opaque section card on the near-black page. */
  .seller-card       { @apply rounded-2xl border border-white/10 bg-[#0a0a0a] shadow-sm; }
  /* Inset tile / soft panel nested inside a .seller-card. */
  .seller-card-soft  { @apply rounded-2xl border border-white/10 bg-white/[0.03]; }
  /* Dark filled form field (replaces white shadcn inputs). */
  .seller-field      { @apply h-10 rounded-xl border border-white/10 bg-white/[0.04]
                               text-white placeholder:text-white/40
                               focus:border-[var(--theme-accent,#f5c518)]
                               focus:ring-[var(--theme-accent,#f5c518)]; }
  /* Gold uppercase section eyebrow. */
  .seller-eyebrow    { @apply text-[10px] font-black uppercase tracking-[0.28em]
                               text-[var(--theme-accent,#f5c518)]; }
  .seller-heading    { @apply text-2xl font-black tracking-tight text-white; }
  .seller-subtext    { @apply text-xs font-medium text-white/60 sm:text-sm; }
  .seller-label      { @apply text-xs font-medium text-white/50; }
  .seller-value      { @apply text-sm font-semibold text-white; }
}
```

These derive from values already in use: card `#0a0a0a`, inset
`rgba(255,255,255,0.03)`, hairline border `rgba(255,255,255,0.10)`, text
`#fff` / `white/60` / `white/50`, accent `var(--theme-accent,#f5c518)`.

### 2. Conversion rules

A fixed light→dark mapping, applied everywhere a light surface appears, so the
work is mechanical rather than per-line judgment:

| Current (light) | Becomes (dark) |
| --- | --- |
| white `<section>` / `bg-white` card | `.seller-card` |
| `bg-slate-50` inset panel | `.seller-card-soft` |
| `text-slate-950` / `text-slate-900` | `text-white` |
| `text-slate-700/600/500` | `text-white/60` (body) or `.seller-label` |
| `text-yellow-600/700` eyebrow | `.seller-eyebrow` |
| `border-slate-200` | `border-white/10` |
| shadcn `Input` / `Textarea` (white) | add `.seller-field` to `className` |
| primary `bg-yellow-400 text-black` button | `bg-[var(--theme-button-bg,#f5c518)] text-[var(--theme-button-text,#000000)]` |
| `bg-yellow-50` / `ring-yellow-300` selected chips | `bg-[var(--theme-accent,#f5c518)]/15` + gold text/border |

Web tab bar (`SellerDashboardTabs` non-native branch): mirror the **native**
branch's palette — container `bg-[var(--byblos-surface,#0a0a0a)]/95 backdrop-blur`
with `border-white/10`, inactive `text-white/60`, active
`bg-[var(--theme-button-bg,#f5c518)] text-[var(--theme-button-text,#000000)]`.
The native branch is already correct and is the reference.

### 3. Hierarchy & signature

- **Depth from elevation, not hue:** page `#000` → `.seller-card` `#0a0a0a` →
  `.seller-card-soft` `white/[0.03]`, separated by hairline `white/10`. No slate,
  no white cards.
- **Gold accent is the single point of boldness:** reserved for the one primary
  action, the active tab, and the key number per surface. Everything else stays
  white / muted-white. No second accent.
- This is the same restraint the founder card and buyer app already use, so the
  seller side finally reads as one product.

### 4. Scope (this pass — all seller surfaces incl. modals)

Convert every file flagged light in the sweep:

- Settings: `SettingsTab`, `SettingsBusinessProfileSection`,
  `SettingsLocationSection`, `AppThemeToggle`, `ThemeSelector`,
  `settingsTab.parts`
- Products: `ProductsTab`, `SellerProductCards`, `SellerProductsTable`
- Product dialogs/modals: `ProductEditDialog`, `ProductInventoryDialog`,
  `ProductEditPhysicalOptions`, `ProductDeleteDialog`
- `WithdrawalHistoryCard`, `UnifiedAnalyticsHub`
- Web tab bar branch of `SellerDashboardTabs`
- Stray-light cleanup inside `OverviewTab`, `WithdrawalsTab`,
  `SellerAmbassadorInvites`

Out of scope: `--byblos-*` token changes, the `.*-light-*` patchwork, the App
Theme light mode, and any layout/data/logic change.

### 5. Files touched

- Modify: `src/app.css` (add the `.seller-*` vocabulary classes)
- Modify: the ~18 seller component files listed in §4 (class swaps only)

## Testing / Verification

- **Automated grep gate:** after conversion, the light-signal sweep across
  `src/components/seller`
  (`bg-white|text-slate-[0-9]|border-slate-[0-9]|#f8f7f2|bg-yellow-50|text-yellow-[67]00|bg-slate-50`)
  should return ~0 matches (any remaining match is either intentional and
  documented, or a miss to fix).
- `npx tsc --noEmit` → 0 errors; `npx eslint <changed files>` → 0 errors;
  `npm run build` → exit 0.
- **Visual pass:** drive the running app (run/verify skill) and confirm each of
  the 5 tabs, the Settings sub-sections, and each product modal render on the
  dark surface with legible text and a single gold accent — no white cards, no
  slate text, no light flashes on tab switch.

## Out of scope

- Reducing metric density on Overview (the competing money numbers / dual order
  lists) — a separate simplification track.
- Restructuring tabs or the Settings section stack.
- Building a real light-mode token set / fixing the `.*-light-*` patchwork.
- Any change to layout, spacing structure, data, or behavior.
