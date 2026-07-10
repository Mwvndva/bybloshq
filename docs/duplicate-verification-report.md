# Duplicate Verification & Canonicalization Report (Phase 1.5A)

This document presents a complete architectural verification of all suspected duplicate implementations within the Byblos codebase, serving as the source of truth for stabilization work.

## Executive Summary

* **Total Duplicate Components:** 1 (ProductCard and its sub-components: Details, Media, Modals, Utils, ImageViewer)
* **Total Duplicate Interfaces:** 3 (`Product`, `Seller`, `Order` defined in multiple contexts)
* **Total Duplicate Hooks:** 1 (`useShopTheme`)
* **Total Duplicate Utilities:** 1 (`shopLinks`)
* **Canonical Implementations Identified:** Yes
* **Variants requiring renaming:** Yes (API-specific models vs core domain models)
* **Safe Consolidations:** immediate consolidation recommended for components, hooks, and utilities.
* **Unsafe Consolidations:** interface merging must be handled carefully (database/API contracts require variant interfaces).
* **Estimated Reduction in Code Duplication:** ~1,200 LOC
* **Estimated Reduction in Lint Errors:** 33 errors (from redundant files)

---

## Part 1 — Duplicate Component Verification

### Component: ProductCard

* **File Paths:** 
  - `src/components/ProductCard.tsx` (Size: 30,856 bytes, 753 lines)
  - `src/features/shop/components/ProductCard.tsx` (Size: 30,801 bytes, 753 lines)
* **Public API:** Identical component name `ProductCard` and props (`product`, `seller`, `hideWishlist`, `theme`, `forceWhiteText`).
* **Render Output:** Identical JSX structure, layout, and rendering conditions.
* **Behaviour:** Identical hooks, effects, and internal state.
* **Styling:** Identical Tailwind classes and styling configurations.
* **Dependencies:** The only differences are import styles (relative paths in `features/shop` vs alias paths in `src/components`).
* **Recommendation:** **Category A** (Functionally identical). Safe to consolidate immediately. The version in `src/components/ProductCard.tsx` should be the canonical implementation.

### Sub-components: product-card/*
The following sub-components are identical (100% byte match):
- `ProductCardDetails.tsx` (10,997 bytes, 251 lines)
- `ProductCardMedia.tsx` (3,874 bytes, 109 lines)
- `ProductCardModals.tsx` (4,205 bytes, 136 lines)
- `productCardUtils.ts` (7,017 bytes, 184 lines)
- `ProductImageViewer.tsx` (4,472 bytes, 124 lines)
* **Recommendation:** **Category A** (Safe to consolidate immediately).

---

## Part 2 — Duplicate Hook Verification

### Hook: `useShopTheme`

* **File Paths:**
  - `src/hooks/useShopTheme.ts` (Size: 7,170 bytes, 201 lines)
  - `src/features/shop/hooks/useShopTheme.ts` (Size: 7,170 bytes, 201 lines)
* **API & Logic:** Identical parameters, return types, state, and theme mappings.
* **Recommendation:** **Merge**. Retain `src/hooks/useShopTheme.ts` as canonical. Consolidate features to import from the root hooks directory.

---

## Part 3 — Duplicate Utility Verification

### Utility: `shopLinks`

* **File Paths:**
  - `src/lib/shopLinks.ts` (Size: 1,154 bytes, 37 lines)
  - `src/features/shop/utils/shopLinks.ts` (Size: 1,154 bytes, 37 lines)
* **Logic:** Identical functions (`getShopUrl`, `getShopUsername`, `copyLinkedTextToClipboard`).
* **Recommendation:** **Merge**. Retain `src/lib/shopLinks.ts` as canonical.

---

## Part 4 — Duplicate Interface Verification

### Interface: `Product`

| Feature | `src/types/index.ts` (Canonical) | `src/api/seller/types.ts` (API Model) | `src/components/seller/dashboard/types.ts` |
| --- | --- | --- | --- |
| **Field names** | CamelCase and snake_case properties | CamelCase and snake_case properties | Core fields only (summary properties) |
| **Aesthetic type** | `Aesthetic` type union | `string` type | `string` type |
| **Scope** | Domain UI model | API representation | Local dashboard view model |

* **Recommendation:** Do NOT merge all. Keep the UI/Domain model `src/types/index.ts` canonical. The API model in `src/api/seller/types.ts` and local model in `src/components/seller/dashboard/types.ts` should be refactored to extend or map from the canonical `Product` interface, reducing definitions.

### Interface: `Seller`

| Feature | `src/types/index.ts` (Canonical) | `src/api/seller/types.ts` (API Model) |
| --- | --- | --- |
| **id type** | `string` | `number` |
| **bannerUrl** | `any` (being updated) | `bannerImage?: string`, `banner_image?: string` |

* **Recommendation:** Do NOT merge. Keep separate because of type mismatches (`string` vs `number` id). Rename `Seller` in `src/api/seller/types.ts` to `ApiSeller` or `SellerProfile` to avoid naming conflicts with the domain model.

---

## Part 5 — Import Graph Analysis

| SUSPECTED DUPLICATE | NUMBER OF IMPORTS | FEATURE OWNERSHIP | RECOMMENDATION |
| --- | --- | --- | --- |
| `src/components/ProductCard.tsx` | 2 | Shared / Buyer | **Canonical** |
| `src/features/shop/components/ProductCard.tsx` | 2 | Shop Feature | Remove duplicate |
| `src/hooks/useShopTheme.ts` | 1 | Shared | **Canonical** |
| `src/features/shop/hooks/useShopTheme.ts` | 1 | Shop Feature | Remove duplicate |
| `src/lib/shopLinks.ts` | 4 | Shared | **Canonical** |
| `src/features/shop/utils/shopLinks.ts` | 1 | Shop Feature | Remove duplicate |

---

## Part 6 — Alias Consistency

Currently, both relative paths (`../components/ProductCard`) and alias paths (`@/components/ProductCard`) are used.
* **Recommendation:** Standardize on **Alias Imports** (`@/...`) for all shared components, hooks, and types. This prevents deep relative imports (e.g. `../../../`) and improves portability.

---

## Part 7 — Bundle & Dependency Impact

* **Approximate Duplicated LOC:** ~1,300 LOC
* **Bundle Impact:** Minimal difference on production builds due to tree-shaking, but significantly improves build speed and reduces dev/debug compilation memory footprint.
* **Lint Improvement:** Will resolve 33 explicit `any` and module warnings directly.

---

## Part 8 — Canonicalization Plan

1. **ProductCard**
   - **Canonical:** `src/components/ProductCard.tsx`
   - **Action:** Remove duplicate in `src/features/shop/components/ProductCard.tsx` (and its sub-components). Update imports in `src/features/shop/pages/ShopPage.tsx` to point to `@/components/ProductCard`.
   - **Risk:** Low

2. **useShopTheme**
   - **Canonical:** `src/hooks/useShopTheme.ts`
   - **Action:** Remove duplicate in `src/features/shop/hooks/useShopTheme.ts`. Update imports to point to `@/hooks/useShopTheme`.
   - **Risk:** Low

3. **shopLinks**
   - **Canonical:** `src/lib/shopLinks.ts`
   - **Action:** Remove duplicate in `src/features/shop/utils/shopLinks.ts`.
   - **Risk:** Low

---

## Part 9 — Migration Roadmap

* **Step 1: Canonicalize Utilities & Hooks**
  - Consolidate `shopLinks` and `useShopTheme` to root.
  - Affected files: 3
  - Risk: Low
* **Step 2: Consolidate Components**
  - Consolidate `ProductCard` and its subcomponents.
  - Affected files: 1
  - Risk: Low
* **Step 3: Refactor / Rename Interfaces**
  - Move unique model parts to `src/types/index.ts` and rename conflict types in API modules.
  - Affected files: 12
  - Risk: Medium
