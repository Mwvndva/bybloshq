# Codebase Audit Report (Phase 1A)

This report establishes the baseline metrics for the stabilization refactor of the Byblos codebase.

## 1. TypeScript Metrics

* **Total TypeScript Errors (Default Config):** 0
* **Total TypeScript Errors (Strict Mode):** 31
* **Explicit `any` Count:** 398 instances (flagged by ESLint `@typescript-eslint/no-explicit-any`)
* **Implicit `any` Count:** 0 (Code compiles without implicit any errors under `--noImplicitAny`)
* **Unsafe Type Assertions (`as any`):** 107 instances
* **Untyped API Responses (`Promise<any>`):** 5 instances
  - `src/api/buyerApi.ts:765` - `getOrderStatus`
  - `src/api/buyerApi.ts:775` - `autoLogin`
  - `src/api/publicApi.ts:419` - `becomeClient`
  - `src/api/publicApi.ts:431` - `pollPaymentStatus`
  - `src/api/seller/ordersApi.ts:59` - `ordersApi` response

## 2. ESLint Metrics

* **Total Lint Errors:** 405
* **Total Lint Warnings:** 46
* **Error Categories:**
  - `@typescript-eslint/no-explicit-any`: 398
  - `react-refresh/only-export-components`: 39 (Warnings)
  - `react-hooks/exhaustive-deps`: 7 (Warnings)
  - `@typescript-eslint/no-empty-object-type`: 3
  - `no-useless-catch`: 2
  - `prefer-const`: 1
  - `@typescript-eslint/no-require-imports`: 1
* **Files Producing the Largest Number of Issues:**
  1. `src\api\buyerApi.ts`: 46 issues
  2. `src\components\ProductCard.tsx`: 24 issues
  3. `src\features\shop\components\ProductCard.tsx`: 24 issues
  4. `src\api\publicApi.ts`: 23 issues
  5. `src\components\buyer\dashboard\hooks\useBuyerFollowedShops.ts`: 19 issues

## 3. Architecture duplicates

* **Duplicate Components / Folders:**
  - `src\features\shop\components\ProductCard.tsx` (and all sub-components under `src\features\shop\components\product-card\`) are duplicate implementations of `src\components\ProductCard.tsx` (and `src\components\product-card\`). The only difference is the import style (relative vs path aliases).
* **Duplicate Interfaces:**
  - `interface Product` is defined in 4 places:
    - `src\api\public\productTransforms.ts`
    - `src\api\seller\types.ts`
    - `src\components\seller\dashboard\types.ts`
    - `src\types\index.ts` (Canonical)
  - `interface Seller` is defined in 3 places:
    - `src\api\public\sellerTransforms.ts`
    - `src\api\seller\types.ts`
    - `src\types\index.ts` (Canonical)
  - `interface Order` is defined in 2 places:
    - `src\types\index.ts` (Canonical)
    - `src\types\order.ts` (Specific variant)
* **Duplicate Hooks:**
  - `useShopTheme.ts` is exactly duplicated:
    - `src\features\shop\hooks\useShopTheme.ts`
    - `src\hooks\useShopTheme.ts`
* **Duplicate Utility Functions:**
  - `shopLinks.ts` is exactly duplicated:
    - `src\features\shop\utils\shopLinks.ts`
    - `src\lib\shopLinks.ts`

## 4. Repository Hygiene

* **Backup Files / Snapshot Files:**
  - `src\components\AppProviders.pre-feature-auth.backup.tsx`
  - `src\pages\ShopPage.original.backup.tsx`
  - `src\App.pre-appshell.backup.tsx`
  - `src\main.pre-appshell.backup.tsx`
  - `eslint.config.js.bak`
* **Circular Imports:** 0 cycles found.
* **Files Exceeding 1000 Lines:**
  - `src\pages\admin\NewDashboardPage.tsx`: 1338 lines
  - `src\components\seller\SellerOrdersSection.tsx`: 1146 lines
* **Files Exceeding 500 Lines:**
  - `src\components\seller\SellerRegistration.tsx`: 880 lines
  - `src\api\buyerApi.ts`: 791 lines
  - `src\components\ui\sidebar.tsx`: 766 lines
  - `src\components\ProductCard.tsx`: 753 lines
  - `src\features\shop\components\ProductCard.tsx`: 753 lines
  - `src\pages\logistics\MzigoDashboardPage.tsx`: 750 lines
  - `src\components\buyer\BuyerRegister.tsx`: 730 lines
  - `src\components\seller\AddProductForm.tsx`: 679 lines
  - `src\components\seller\dashboard\tabs\SettingsTab.tsx`: 618 lines
  - `src\components\BuyerInfoModal.tsx`: 567 lines
  - `src\api\adminApi.ts`: 566 lines
  - `src\features\shop\pages\ShopPage.tsx`: 516 lines
  - `src\pages\ShopPage.original.backup.tsx`: 516 lines
  - `src\components\seller\ProductsList.tsx`: 513 lines

## 5. Baseline Summary

| Metric | Baseline Count |
| --- | --- |
| TypeScript Errors (Default) | 0 |
| TypeScript Errors (Strict Mode) | 31 |
| ESLint Errors | 405 |
| ESLint Warnings | 46 |
| Explicit `any` | 398 |
| `as any` Assertions | 107 |
| Untyped API Responses | 5 |
| Duplicate Basename Components | 6 (ProductCard & sub-components) |
| Duplicate Hooks | 1 (useShopTheme) |
| Duplicate Utilities | 1 (shopLinks) |
| Backup Files Found | 5 |
| Circular Imports | 0 |
