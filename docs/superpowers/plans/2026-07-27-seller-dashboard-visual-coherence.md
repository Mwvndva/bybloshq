# Seller Dashboard Visual Coherence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify every seller-dashboard surface onto one dark Byblos-brand surface (black + gold) via a shared `.seller-*` class vocabulary, converting all light surfaces and cleaning stray-light in the already-dark tabs.

**Architecture:** Add a small dark surface vocabulary once (extend the existing `.seller-*` block in `src/app.css`), then convert each light surface to those classes using a fixed light→dark mapping. Presentation-only: no data, logic, layout, or behavior changes. The hero/Overview dark surfaces are the reference and are only touched to remove stray light utilities.

**Tech Stack:** React + TypeScript, Tailwind CSS (`@layer components` + `@apply`), Vite, shadcn/ui (`Input`, `Textarea`, `Button`, `Card`, `Dialog`).

## Global Constraints

- New vocabulary classes (add verbatim to the `.seller-*` area of `src/app.css`, inside `@layer components`):
  - `.seller-card` → `@apply rounded-2xl border border-white/10 bg-[#0a0a0a] shadow-sm;`
  - `.seller-card-soft` → `@apply rounded-2xl border border-white/10 bg-white/[0.03];`
  - `.seller-field` → `@apply h-10 rounded-xl border border-white/10 bg-white/[0.04] text-white placeholder:text-white/40 focus:border-[var(--theme-accent,#f5c518)] focus:ring-[var(--theme-accent,#f5c518)];`
  - `.seller-eyebrow` → `@apply text-[10px] font-black uppercase tracking-[0.28em] text-[var(--theme-accent,#f5c518)];`
  - `.seller-heading` → `@apply text-2xl font-black tracking-tight text-white;`
  - `.seller-subtext` → `@apply text-xs font-medium text-white/60 sm:text-sm;`
  - `.seller-label` → `@apply text-xs font-medium text-white/50;`
  - `.seller-value` → `@apply text-sm font-semibold text-white;`
- Light→dark conversion mapping (apply everywhere a light surface appears):
  | Current (light) | Becomes (dark) |
  | --- | --- |
  | white `<section>` / `bg-white` card | `.seller-card` |
  | `bg-slate-50` inset panel | `.seller-card-soft` |
  | `text-slate-950` / `text-slate-900` | `text-white` |
  | `text-slate-700/600/500` | `text-white/60` (body) or `.seller-label` |
  | `text-yellow-600/700` eyebrow | `.seller-eyebrow` |
  | `border-slate-200` | `border-white/10` |
  | shadcn `Input`/`Textarea` (white) | add `seller-field` to `className` (drop `bg-white border-slate-200 text-slate-950 placeholder:text-slate-400 focus:border-yellow-400 focus:ring-yellow-400`) |
  | primary `bg-yellow-400 text-black` button | `bg-[var(--theme-button-bg,#f5c518)] text-[var(--theme-button-text,#000000)]` |
  | `bg-yellow-50` / `ring-yellow-300` selected chip | `bg-[var(--theme-accent,#f5c518)]/15` + `text-white` + `border-[var(--theme-accent,#f5c518)]/40` |
  | link `text-blue-700` | `text-[var(--theme-accent,#f5c518)]` |
  | status badge light (`bg-yellow-50 text-yellow-900 border-yellow-200`, green/red/blue variants) | translucent dark: `bg-{hue}-500/15 text-{hue}-300 border-{hue}-500/30` |
- Preserve every semantic status color's HUE (processing=yellow, completed=green, failed=red, default=blue); only shift them to the translucent dark form above. Status color ≠ the gold accent.
- No change to layout structure, spacing scale, component props, data, or behavior. Class swaps only.
- Intended dark patterns that are NOT light and must NOT be "fixed": translucent white (`bg-white/[0.03]`, `bg-white/[0.04]`, `border-white/10`, `text-white/60`) and translucent accents (`bg-yellow-500/15`).
- Gates before each commit: `npx tsc --noEmit` (0 errors) and `npx eslint <changed files>` (0 errors). Final task also runs `npm run build` (exit 0; Vite build ~5–8 min).
- Commit messages end with: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
- The `src/app.css` and `src/components/**` paths are not affected by the `src/lib` gitignore rule; normal `git add` works.

## File Structure

- `src/app.css` — add the `.seller-*` vocabulary (Task 1). Single source of truth.
- Settings cluster (Task 2): `SettingsTab.tsx`, `SettingsBusinessProfileSection.tsx`, `SettingsLocationSection.tsx`, `AppThemeToggle.tsx`, `ThemeSelector.tsx`, `settingsTab.parts.tsx`.
- Products list (Task 3): `ProductsTab.tsx`, `products-list/SellerProductCards.tsx`, `products-list/SellerProductsTable.tsx`.
- Product modals (Task 4): `products-list/ProductEditDialog.tsx`, `products-list/ProductInventoryDialog.tsx`, `products-list/ProductEditPhysicalOptions.tsx`, `products-list/ProductDeleteDialog.tsx`.
- Remainder + final gate (Task 5): `dashboard/tabs/WithdrawalHistoryCard.tsx`, `dashboard/widgets/SellerDashboardTabs.tsx` (web branch), `UnifiedAnalyticsHub.tsx`, plus stray-light cleanup in `dashboard/tabs/OverviewTab.tsx`, `dashboard/tabs/WithdrawalsTab.tsx`, `dashboard/tabs/SellerAmbassadorInvites.tsx`.

All component paths are under `src/components/seller/`.

## Verification method (all conversion tasks)

Each conversion task uses a **light-signal grep gate** as its pass/fail test. Run this against the task's files (ripgrep):

```bash
rg -n "bg-white[^/]|text-slate-|border-slate-|bg-slate-|#f8f7f2|text-yellow-[67]00|bg-yellow-50[^0]|bg-(green|red|blue)-50[^0]|ring-yellow-300|text-blue-700" <task files>
```

- BEFORE conversion: it prints the light utilities (the "failing" state).
- AFTER conversion: it prints nothing (0 matches = pass). Any residual match must be either fixed or, if it is a deliberate translucent dark pattern the regex caught, confirmed by eye and noted.

---

### Task 1: Add the `.seller-*` surface vocabulary

**Files:**
- Modify: `src/app.css` (extend the existing `.seller-*` rules)

**Interfaces:**
- Consumes: nothing.
- Produces: the CSS classes `.seller-card`, `.seller-card-soft`, `.seller-field`, `.seller-eyebrow`, `.seller-heading`, `.seller-subtext`, `.seller-label`, `.seller-value` (consumed by Tasks 2–5).

- [ ] **Step 1: Locate the existing seller CSS block**

Run: `rg -n "\.seller-surface|\.seller-balance-hero|\.seller-tab-selected|@layer components" src/app.css`
Expected: prints the line numbers of the existing `.seller-*` rules (and any `@layer components` block). Add the new classes adjacent to them. If the existing `.seller-*` rules are NOT already inside an `@layer components` block, wrap the new classes in their own `@layer components { … }` block.

- [ ] **Step 2: Add the vocabulary classes**

Insert (next to the existing `.seller-*` rules):

```css
@layer components {
  /* Seller dashboard dark surface vocabulary — one source of truth so surfaces
     cannot re-diverge into ad-hoc light/dark hex. Values mirror the hero/Overview. */
  .seller-card       { @apply rounded-2xl border border-white/10 bg-[#0a0a0a] shadow-sm; }
  .seller-card-soft  { @apply rounded-2xl border border-white/10 bg-white/[0.03]; }
  .seller-field      { @apply h-10 rounded-xl border border-white/10 bg-white/[0.04]
                               text-white placeholder:text-white/40
                               focus:border-[var(--theme-accent,#f5c518)]
                               focus:ring-[var(--theme-accent,#f5c518)]; }
  .seller-eyebrow    { @apply text-[10px] font-black uppercase tracking-[0.28em]
                               text-[var(--theme-accent,#f5c518)]; }
  .seller-heading    { @apply text-2xl font-black tracking-tight text-white; }
  .seller-subtext    { @apply text-xs font-medium text-white/60 sm:text-sm; }
  .seller-label      { @apply text-xs font-medium text-white/50; }
  .seller-value      { @apply text-sm font-semibold text-white; }
}
```

- [ ] **Step 3: Verify the CSS compiles**

Run: `npx vite build --mode development 2>&1 | tail -5` (or `npm run build 2>&1 | tail -5`)
Expected: build completes with no CSS/`@apply` errors. (An unknown utility in `@apply` fails the build, so a clean build proves every class in Step 2 resolves.)

- [ ] **Step 4: Commit**

```bash
git add src/app.css
git commit -m "feat(seller-ui): add shared .seller-* dark surface vocabulary

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Convert the Settings cluster

**Files:**
- Modify: `src/components/seller/dashboard/tabs/SettingsTab.tsx`
- Modify: `src/components/seller/dashboard/tabs/SettingsBusinessProfileSection.tsx`
- Modify: `src/components/seller/dashboard/tabs/SettingsLocationSection.tsx`
- Modify: `src/components/seller/dashboard/tabs/AppThemeToggle.tsx`
- Modify: `src/components/seller/ThemeSelector.tsx`
- Modify: `src/components/seller/dashboard/tabs/settingsTab.parts.tsx`

**Interfaces:**
- Consumes: the `.seller-*` classes from Task 1.
- Produces: nothing (internal styling only).

- [ ] **Step 1: See the gate fail**

Run:
```bash
rg -n "bg-white[^/]|text-slate-|border-slate-|bg-slate-|text-yellow-[67]00|bg-yellow-50[^0]|ring-yellow-300|text-blue-700|focus:ring-yellow-400" src/components/seller/dashboard/tabs/SettingsTab.tsx src/components/seller/dashboard/tabs/SettingsBusinessProfileSection.tsx src/components/seller/dashboard/tabs/SettingsLocationSection.tsx src/components/seller/dashboard/tabs/AppThemeToggle.tsx src/components/seller/ThemeSelector.tsx src/components/seller/dashboard/tabs/settingsTab.parts.tsx
```
Expected: dozens of matches (the light utilities to convert).

- [ ] **Step 2: Apply the conversion mapping to each file**

Apply the Global Constraints mapping. Representative conversions (apply the same pattern to every occurrence in these files):

`settingsTab.parts.tsx` — `SectionHeader`:
```tsx
// before
<h3 className="text-base font-black tracking-tight text-slate-950 sm:text-lg">{title}</h3>
<p className="mt-1 text-xs font-medium text-slate-600 sm:text-sm">{description}</p>
// after
<h3 className="text-base font-black tracking-tight text-white sm:text-lg">{title}</h3>
<p className="mt-1 seller-subtext">{description}</p>
```

`settingsTab.parts.tsx` — `SocialInput` (card, label, input, link, empty state):
```tsx
// before
<div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
  <p className="text-xs sm:text-sm font-medium text-slate-600 mb-1">{label}</p>
  <Input ... className="h-10 text-xs sm:text-sm bg-white border-slate-200 text-slate-950 placeholder:text-slate-400 focus:border-yellow-400 focus:ring-yellow-400" />
  <a ... className="text-sm sm:text-base lg:text-lg font-semibold text-blue-700 hover:underline flex items-center gap-1">
  <p className="text-sm sm:text-base font-semibold text-slate-500 italic">Not set</p>
// after
<div className="seller-card-soft p-4">
  <p className="seller-label mb-1">{label}</p>
  <Input ... className="seller-field text-xs sm:text-sm" />
  <a ... className="text-sm sm:text-base lg:text-lg font-semibold text-[var(--theme-accent,#f5c518)] hover:underline flex items-center gap-1">
  <p className="text-sm sm:text-base font-semibold text-white/40 italic">Not set</p>
```

`SettingsTab.tsx` — header eyebrow/heading/subtext, white `<section>`s, inset email/whatsapp tiles, primary/secondary buttons:
```tsx
// before
<p className="text-[10px] font-black uppercase tracking-[0.28em] text-yellow-600">Settings</p>
<h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Shop controls</h2>
<p className="mt-1 max-w-2xl text-xs font-medium text-slate-700 sm:text-sm">Keep your public shop details…</p>
<section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 lg:p-6"> … </section>
<div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"> … </div>
<Button className="h-10 w-full bg-yellow-400 font-black text-black hover:bg-yellow-300 sm:w-auto">
<Button variant="outline" className="h-10 w-full border-slate-200 bg-white text-slate-700 hover:bg-slate-50 sm:w-auto">Cancel</Button>
// after
<p className="seller-eyebrow">Settings</p>
<h2 className="mt-1 seller-heading sm:text-3xl">Shop controls</h2>
<p className="mt-1 max-w-2xl seller-subtext">Keep your public shop details…</p>
<section className="seller-card p-4 sm:p-5 lg:p-6"> … </section>
<div className="seller-card-soft p-4"> … </div>
<Button className="h-10 w-full bg-[var(--theme-button-bg,#f5c518)] font-black text-[var(--theme-button-text,#000000)] hover:opacity-90 sm:w-auto">
<Button variant="outline" className="h-10 w-full border-white/15 bg-white/[0.04] text-white hover:bg-white/[0.08] sm:w-auto">Cancel</Button>
```
The `whatsappNumber` `Input` inside `SettingsTab.tsx` gets `className="seller-field text-xs"` (drop its `bg-white border-slate-200 …` classes). The email/whatsapp value `<p>` uses `text-white` (was `text-slate-950`), labels use `seller-label`.

`AppThemeToggle.tsx` — icon chip, heading/subtext, option buttons:
```tsx
// before
<div className="rounded-xl border border-yellow-200 bg-yellow-50 p-2"><Sun className="h-5 w-5 text-yellow-700" /></div>
<h3 className="text-base font-black tracking-tight text-slate-950 sm:text-lg">App Theme</h3>
<p className="mt-0.5 text-xs font-medium text-slate-600 sm:text-sm">Choose how the dashboard looks…</p>
// option button (active / inactive):
active ? 'border-yellow-400 bg-yellow-50 ring-2 ring-yellow-300/30 shadow-sm'
       : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
// icon/label active vs inactive: text-yellow-600 / text-slate-400 ; text-yellow-700 / text-slate-600
// after
<div className="rounded-xl border border-[var(--theme-accent,#f5c518)]/30 bg-[var(--theme-accent,#f5c518)]/15 p-2"><Sun className="h-5 w-5 text-[var(--theme-accent,#f5c518)]" /></div>
<h3 className="text-base font-black tracking-tight text-white sm:text-lg">App Theme</h3>
<p className="mt-0.5 seller-subtext">Choose how the dashboard looks…</p>
active ? 'border-[var(--theme-accent,#f5c518)] bg-[var(--theme-accent,#f5c518)]/15 ring-2 ring-[var(--theme-accent,#f5c518)]/30'
       : 'border-white/10 bg-white/[0.04] hover:border-white/20'
// icon/label active vs inactive: text-[var(--theme-accent,#f5c518)] / text-white/40 ; text-white / text-white/60
```

Apply the same mapping to `SettingsBusinessProfileSection.tsx`, `SettingsLocationSection.tsx`, and `ThemeSelector.tsx` (all use the same `bg-white`/`bg-slate-50`/`text-slate-*`/`border-slate-200`/yellow-button vocabulary → `.seller-card` / `.seller-card-soft` / `text-white` / `text-white/60` / `border-white/10` / accent buttons). Any shadcn `Input`/`Textarea`/`<select>` in these files gets `seller-field` and drops its light classes.

- [ ] **Step 3: See the gate pass**

Run the exact `rg` command from Step 1 again.
Expected: no output (0 matches).

- [ ] **Step 4: Typecheck + lint**

Run: `npx tsc --noEmit`
Expected: exit 0.
Run: `npx eslint src/components/seller/dashboard/tabs/SettingsTab.tsx src/components/seller/dashboard/tabs/SettingsBusinessProfileSection.tsx src/components/seller/dashboard/tabs/SettingsLocationSection.tsx src/components/seller/dashboard/tabs/AppThemeToggle.tsx src/components/seller/ThemeSelector.tsx src/components/seller/dashboard/tabs/settingsTab.parts.tsx`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/components/seller/dashboard/tabs/SettingsTab.tsx src/components/seller/dashboard/tabs/SettingsBusinessProfileSection.tsx src/components/seller/dashboard/tabs/SettingsLocationSection.tsx src/components/seller/dashboard/tabs/AppThemeToggle.tsx src/components/seller/ThemeSelector.tsx src/components/seller/dashboard/tabs/settingsTab.parts.tsx
git commit -m "style(seller-ui): convert Settings cluster to dark surface

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Convert the Products list

**Files:**
- Modify: `src/components/seller/dashboard/tabs/ProductsTab.tsx`
- Modify: `src/components/seller/products-list/SellerProductCards.tsx`
- Modify: `src/components/seller/products-list/SellerProductsTable.tsx`

**Interfaces:**
- Consumes: the `.seller-*` classes from Task 1.
- Produces: nothing.

- [ ] **Step 1: See the gate fail**

Run:
```bash
rg -n "bg-white[^/]|text-slate-|border-slate-|bg-slate-|text-yellow-[67]00|bg-yellow-50[^0]|ring-yellow-300|text-blue-700|focus:ring-yellow-400" src/components/seller/dashboard/tabs/ProductsTab.tsx src/components/seller/products-list/SellerProductCards.tsx src/components/seller/products-list/SellerProductsTable.tsx
```
Expected: matches printed.

- [ ] **Step 2: Apply the conversion mapping**

Apply the Global Constraints mapping to all three files:
- White product cards / table container (`bg-white border-slate-200`) → `seller-card`.
- Inner tiles / rows (`bg-slate-50`, `border-slate-200`) → `seller-card-soft` / `border-white/10`.
- Table headers and cell text (`text-slate-950` / `text-slate-600` / `text-slate-500`) → `text-white` / `text-white/60` / `.seller-label`.
- Any product status/stock badge that uses light `-50`/`-100` hues → the translucent dark status form `bg-{hue}-500/15 text-{hue}-300 border-{hue}-500/30` (keep the hue).
- Any `Input`/`<select>` (e.g. inline stock edit) → `seller-field`.
- Primary action buttons (`bg-yellow-400 text-black`) → `bg-[var(--theme-button-bg,#f5c518)] text-[var(--theme-button-text,#000000)]`.

- [ ] **Step 3: See the gate pass**

Run the Step 1 `rg` command again. Expected: no output.

- [ ] **Step 4: Typecheck + lint**

Run: `npx tsc --noEmit` → exit 0.
Run: `npx eslint src/components/seller/dashboard/tabs/ProductsTab.tsx src/components/seller/products-list/SellerProductCards.tsx src/components/seller/products-list/SellerProductsTable.tsx` → exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/components/seller/dashboard/tabs/ProductsTab.tsx src/components/seller/products-list/SellerProductCards.tsx src/components/seller/products-list/SellerProductsTable.tsx
git commit -m "style(seller-ui): convert Products list to dark surface

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Convert the Product modals

**Files:**
- Modify: `src/components/seller/products-list/ProductEditDialog.tsx`
- Modify: `src/components/seller/products-list/ProductInventoryDialog.tsx`
- Modify: `src/components/seller/products-list/ProductEditPhysicalOptions.tsx`
- Modify: `src/components/seller/products-list/ProductDeleteDialog.tsx`

**Interfaces:**
- Consumes: the `.seller-*` classes from Task 1.
- Produces: nothing.

- [ ] **Step 1: See the gate fail**

Run:
```bash
rg -n "bg-white[^/]|text-slate-|border-slate-|bg-slate-|text-yellow-[67]00|bg-yellow-50[^0]|ring-yellow-300|text-blue-700|focus:ring-yellow-400" src/components/seller/products-list/ProductEditDialog.tsx src/components/seller/products-list/ProductInventoryDialog.tsx src/components/seller/products-list/ProductEditPhysicalOptions.tsx src/components/seller/products-list/ProductDeleteDialog.tsx
```
Expected: matches printed.

- [ ] **Step 2: Apply the conversion mapping (modal surfaces)**

These render inside shadcn `Dialog`. Convert per the Global Constraints mapping, and give each `DialogContent` an explicit dark surface so it doesn't inherit a light default:
```tsx
// on each DialogContent
className="… bg-[#0a0a0a] border-white/10 text-white"
```
- Dialog title/description → `text-white` / `text-white/60`.
- Field labels → `.seller-label`; `Input`/`Textarea`/`<select>` → `seller-field` (drop light classes).
- Inset/option panels (`bg-slate-50`, `border-slate-200`) → `seller-card-soft` / `border-white/10`.
- Confirm/primary buttons (`bg-yellow-400 text-black`) → `bg-[var(--theme-button-bg,#f5c518)] text-[var(--theme-button-text,#000000)]`; destructive delete buttons keep their red (`bg-red-600 text-white` is already dark-safe).
- Any status/quantity chip on light `-50` → translucent dark status form.

- [ ] **Step 3: See the gate pass**

Run the Step 1 `rg` command again. Expected: no output.

- [ ] **Step 4: Typecheck + lint**

Run: `npx tsc --noEmit` → exit 0.
Run: `npx eslint src/components/seller/products-list/ProductEditDialog.tsx src/components/seller/products-list/ProductInventoryDialog.tsx src/components/seller/products-list/ProductEditPhysicalOptions.tsx src/components/seller/products-list/ProductDeleteDialog.tsx` → exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/components/seller/products-list/ProductEditDialog.tsx src/components/seller/products-list/ProductInventoryDialog.tsx src/components/seller/products-list/ProductEditPhysicalOptions.tsx src/components/seller/products-list/ProductDeleteDialog.tsx
git commit -m "style(seller-ui): convert Product modals to dark surface

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Withdrawal history + web tab bar + analytics + stray cleanup, then full gate

**Files:**
- Modify: `src/components/seller/dashboard/tabs/WithdrawalHistoryCard.tsx`
- Modify: `src/components/seller/dashboard/widgets/SellerDashboardTabs.tsx` (web / non-native branch only)
- Modify: `src/components/seller/UnifiedAnalyticsHub.tsx`
- Modify (stray light cleanup): `src/components/seller/dashboard/tabs/OverviewTab.tsx`, `src/components/seller/dashboard/tabs/WithdrawalsTab.tsx`, `src/components/seller/dashboard/tabs/SellerAmbassadorInvites.tsx`

**Interfaces:**
- Consumes: the `.seller-*` classes from Task 1.
- Produces: nothing.

- [ ] **Step 1: Convert `WithdrawalHistoryCard.tsx`**

```tsx
// before
<Card className="group hover:shadow-xl transition-all duration-300 bg-white border border-slate-200">
<p className="text-base sm:text-xl font-black text-slate-950 truncate">{formatKes(request.amount)}</p>
// status badge
request.status === 'processing' ? 'bg-yellow-50 text-yellow-900 border-yellow-200'
: request.status === 'completed' ? 'bg-green-50 text-green-900 border-green-200'
: request.status === 'failed'    ? 'bg-red-50 text-red-900 border-red-200'
:                                  'bg-blue-50 text-blue-900 border-blue-200'
<p className="text-xs text-slate-700 break-words">M-Pesa: …</p>
<div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Requested</p>
  <p className="text-xs font-semibold text-slate-950">{…}</p>
</div>
// after
<Card className="group transition-all duration-300 seller-card">
<p className="text-base sm:text-xl font-black text-white truncate">{formatKes(request.amount)}</p>
request.status === 'processing' ? 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30'
: request.status === 'completed' ? 'bg-green-500/15 text-green-300 border-green-500/30'
: request.status === 'failed'    ? 'bg-red-500/15 text-red-300 border-red-500/30'
:                                  'bg-blue-500/15 text-blue-300 border-blue-500/30'
<p className="text-xs text-white/60 break-words">M-Pesa: …</p>
<div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
  <p className="text-[10px] font-semibold uppercase tracking-wide text-white/50">Requested</p>
  <p className="text-xs font-semibold text-white">{…}</p>
</div>
```
Apply the same to all six inset tiles. The failure-reason box (`bg-red-500/10 border-red-400/20 text-red-800`) → `bg-red-500/15 border-red-500/30 text-red-300`.

- [ ] **Step 2: Convert the web tab bar branch of `SellerDashboardTabs.tsx`**

Only the non-native `return (…)` branch (the native branch is already correct and is the reference). Mirror the native palette:
```tsx
// before (outer container + inactive/active pill)
<div className="sticky top-14 z-40 -mx-4 mb-5 border-y border-slate-200/60 bg-[#f8f7f2]/95 px-4 py-2 backdrop-blur sm:top-16 sm:-mx-6 sm:mb-7 sm:px-6 lg:static lg:mx-auto lg:mb-8 lg:w-full lg:max-w-4xl lg:rounded-2xl lg:border lg:border-slate-200/60 lg:bg-white lg:p-1.5 lg:shadow-[0_12px_35px_rgba(17,17,17,0.08)]">
// inactive pill classes:
'text-slate-600 border-transparent hover:text-slate-950 hover:bg-slate-100'
// after
<div className="sticky top-14 z-40 -mx-4 mb-5 border-y border-white/10 bg-[var(--byblos-surface,#0a0a0a)]/95 px-4 py-2 backdrop-blur sm:top-16 sm:-mx-6 sm:mb-7 sm:px-6 lg:static lg:mx-auto lg:mb-8 lg:w-full lg:max-w-4xl lg:rounded-2xl lg:border lg:border-white/10 lg:bg-[var(--byblos-surface,#0a0a0a)] lg:p-1.5 lg:shadow-[0_12px_35px_rgba(0,0,0,0.45)]">
'text-white/60 border-transparent hover:text-white hover:bg-white/[0.06]'
```
The active pill already uses `var(--theme-button-bg,#facc15)` / `var(--theme-button-text,#000000)` — leave it.

- [ ] **Step 3: Convert `UnifiedAnalyticsHub.tsx` and clean stray light in Overview / Withdrawals / Ambassador**

- `UnifiedAnalyticsHub.tsx`: apply the mapping to its few light utilities (`bg-white`/`text-slate-*`/`border-slate-200` → `.seller-card` / `text-white` / `border-white/10`).
- `OverviewTab.tsx`, `WithdrawalsTab.tsx`, `SellerAmbassadorInvites.tsx`: these are already dark; find and convert only the stray light utilities (each flagged 6–11 in the earlier sweep). Run the gate (Step 4) to locate them precisely; convert each per the mapping. Do NOT touch the surrounding dark styling.

- [ ] **Step 4: Run the FULL seller light-signal gate**

Run:
```bash
rg -n "bg-white[^/]|text-slate-|border-slate-|bg-slate-|#f8f7f2|text-yellow-[67]00|bg-yellow-50[^0]|bg-(green|red|blue)-50[^0]|ring-yellow-300|text-blue-700|focus:ring-yellow-400" src/components/seller
```
Expected: **no output** (0 matches across the entire seller directory). If anything prints, convert it per the mapping and re-run until clean. (If a match is a legitimate translucent dark pattern the regex over-caught, confirm by eye — but the regex above already excludes `bg-white/…`, `-500/…`, so a real hit is a genuine miss.)

- [ ] **Step 5: Typecheck, lint, and full build**

Run: `npx tsc --noEmit` → exit 0.
Run: `npx eslint src/components/seller/dashboard/tabs/WithdrawalHistoryCard.tsx src/components/seller/dashboard/widgets/SellerDashboardTabs.tsx src/components/seller/UnifiedAnalyticsHub.tsx src/components/seller/dashboard/tabs/OverviewTab.tsx src/components/seller/dashboard/tabs/WithdrawalsTab.tsx src/components/seller/dashboard/tabs/SellerAmbassadorInvites.tsx` → exit 0.
Run: `npm run build` → exit 0, `dist/` regenerated. (Vite build ~5–8 min; run in background or allow a long timeout.)

- [ ] **Step 6: Commit**

```bash
git add src/components/seller/dashboard/tabs/WithdrawalHistoryCard.tsx src/components/seller/dashboard/widgets/SellerDashboardTabs.tsx src/components/seller/UnifiedAnalyticsHub.tsx src/components/seller/dashboard/tabs/OverviewTab.tsx src/components/seller/dashboard/tabs/WithdrawalsTab.tsx src/components/seller/dashboard/tabs/SellerAmbassadorInvites.tsx
git commit -m "style(seller-ui): finish dark unification (withdrawals, web tabs, analytics, strays)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- Shared `.seller-*` vocabulary in `app.css` → Task 1. ✅
- Conversion mapping applied to Settings cluster → Task 2. ✅
- Products list → Task 3; Product modals → Task 4. ✅
- WithdrawalHistoryCard, web tab bar, analytics hub, stray cleanup → Task 5. ✅
- "Everything including modals" scope → Tasks 2–5 cover every file flagged light in the spec's sweep. ✅
- Hierarchy/signature (elevation not hue, single gold accent, keep status hues) → encoded in the mapping + status-badge rule (Global Constraints). ✅
- Presentation-only (no logic/layout/data change) → Global Constraints + every task is class swaps only. ✅
- Verification: light-signal grep → 0, tsc/eslint, build → Task 5 Step 4–5 (full gate) + per-task gates. ✅
- Visual per-tab pass → belongs to execution (run/verify skill), noted in the spec; not a code task here.

**Placeholder scan:** No TBD/TODO/"handle edge cases". Representative before/after code is shown for each distinct pattern; the grep gate proves per-file completeness (the mechanical remainder is the same mapping applied to identical utilities).

**Type consistency:** Class names (`.seller-card`, `.seller-card-soft`, `.seller-field`, `.seller-eyebrow`, `.seller-heading`, `.seller-subtext`, `.seller-label`, `.seller-value`) are defined once in Task 1 and referenced identically in Tasks 2–5. The `--theme-button-bg` / `--theme-button-text` / `--theme-accent` / `--byblos-surface` variables used in conversions are pre-existing app tokens. No new TS types introduced (CSS-only).
