# AGENTS.md

## Project

Reborn Margin/WMS app for 리본컴퍼니.

Production reference URL:
- https://reborn-margin-web.vercel.app/#wms

Latest baseline imported into this repository:
- reborn_margin_wms_inventory_manual_adjust_log_fix.zip
- Version string: reborn-inventory-manual-adjust-log-fix-01

This is a static web app using:
- index.html
- script.js
- style.css
- manifest.json
- vercel.json
- image/icon assets

Core modules:
- Margin calculator
- WMS inventory management
- Admin login and permission separation
- Purchase status and purchase item registration
- Purchase-complete records, hiding, deletion, CSV download
- Direct inbound entry
- Direct outbound entry
- Cancellation/return handling
- Excel order analysis and inventory deduction
- Total inventory asset calculation
- Sales/outbound graphs
- Net outbound tracking by date
- Outbound diagnostics
- Cache-safe recovery structure
- Box size management: 대/중/소/특대
- 박스 특대 automatic deduction only for 코디 3겹
- 쿠키속 초코짱 product support
- Admin-only manual inventory quantity adjustment

## Highest-priority rule

Make the smallest possible change needed for the requested task.
Do not refactor, restructure, rewrite, or “clean up” unrelated code.
This project has a history of UI-wide failures when broad changes are made.

## Do not change unless explicitly requested

- Margin calculation formula
- Coupang commission calculation
- VAT calculation
- Early-settlement penalty calculation
- Delivery fee / box fee flow
- Existing product costs
- Existing product packaging rules
- WMS inbound/outbound/return logic
- Excel analysis/deduction logic
- Purchase status logic
- Purchase item registration logic
- Purchase-complete button/form/save/hide/delete/CSV logic
- Admin login flow
- Admin permission checks
- Supabase connection structure
- Supabase tables, columns, policies, or RLS
- Existing state structure
- Existing localStorage key names
- Existing saved/backup data
- Cache-safe recovery structure
- 박스 대/중/소 existing rules
- 박스 특대 rule
- 코디 3겹 → 박스 특대 1:1 deduction rule
- 쿠키속 초코짱 WMS/Excel/margin/box deduction logic

## Strictly forbidden

- Do not use `localStorage.clear()`.
- Do not use `sessionStorage.clear()`.
- Do not delete IndexedDB.
- Do not reset Supabase data.
- Do not insert fake test data into production logic.
- Do not force overwrite existing inventory values.
- Do not rename existing localStorage keys.
- Do not change the state schema unless the user explicitly requests it.
- Do not merge from known failed files.

Known failed files that must not be used as a baseline:
- reborn_margin_wms_box_xl_tissue_deduct_fixed.zip
- reborn_margin_wms_box_xl_order_status_restore_fixed.zip

## Required checks after JavaScript changes

Run:

```bash
node --check script.js
```

Also verify by search:

```bash
grep -R "localStorage.clear\|sessionStorage.clear\|indexedDB.deleteDatabase" -n --include="*.js" --include="*.html" --include="*.css" --include="*.json" --exclude="package.json" . || true
```

If style.css is edited, check brace balance or run an equivalent CSS structure check.

## Cache/version rule

When changing app files for a new release, keep these aligned:

- `index.html` version meta value
- `index.html` `script.js?v=...`
- `index.html` `style.css?v=...`
- `index.html` `manifest.json?v=...`
- `script.js` internal `cacheVersion`
- `manifest.json` `start_url` version query

Never change cache behavior in a way that deletes business data.
Only app file caches/service worker caches may be repaired.

## Current confirmed version values

Current version string:

```txt
reborn-inventory-manual-adjust-log-fix-01
```

Current latest ZIP filename:

```txt
reborn_margin_wms_inventory_manual_adjust_log_fix.zip
```

## Known recent fix

The previous file `reborn_margin_wms_inventory_manual_adjust_fixed.zip` had a bug in `saveInventoryManualAdjust`.

The wrong pattern was:

```js
addAdminActionLog({
  actionType: "manual_adjust",
  ...
});
```

The fixed pattern is:

```js
addAdminActionLog("manual_adjust", {
  itemName: sku,
  qty: diffUnits,
  memo: `재고 직접 수정: ${reason}`,
  details: [...],
});
```

Do not revert this fix.

## Product-specific confirmed rules

### 박스 특대

- Unit cost: 680원
- 1파레트 = 30묶음
- 1묶음 = 20개
- 1파레트 = 600개
- Safety stock = 4파렛 = 2,400개
- Do not auto-deduct for all products.
- Auto-deduct only when 코디 3겹 is outbound.
- 코디 3겹 N개 출고 → 박스 특대 N개 차감.
- 쿠키속 초코짱 must not deduct 박스 특대.

### 쿠키속 초코짱

- Cost: 195원 per unit
- Margin product entry must exist in `MARGIN_PRODUCTS`.
- 1완박스 = 12박스
- 1박스 = 40낱개
- 1완박스 = 480낱개
- Internal inventory calculation uses total units.
- Pallet basis is unknown. Do not invent pallet quantity.

Packaging deduction for 쿠키속 초코짱:

- 1~80 units → 박스 소 1
- 81~240 units → 박스 중 1
- 241~440 units → 박스 대 1
- 441~479 units → no packaging box deduction
- 480 units → complete box outbound, no packaging box deduction
- Over 480 units: complete 480-unit groups use no packaging box; apply the above rule only to the remainder.

## Admin-only manual inventory adjustment

Requirements:

- Admin can directly set target inventory quantity from WMS inventory screen.
- General users must not see the UI.
- Save function must re-check admin permission.
- This is target quantity editing, not difference input.
- Example: current 73 → input 100 → final inventory 100.
- Internal storage uses total unit count.
- Reason input is required.
- Confirmation dialog is required before save.
- After save, UI must refresh immediately.
- Refresh persistence must continue to work.
- Total inventory asset must update from adjusted inventory.
- Unknown pallet-basis products must not produce NaN/Infinity.
- Box/material items should remain adjustable if currently supported.

## Reporting format after each task

When finishing a task, report:

1. Baseline file/branch used
2. Files changed
3. Functions changed
4. Exact behavior changed
5. Functions explicitly not changed
6. State/localStorage/Supabase unchanged confirmation
7. Forbidden deletion commands absent confirmation
8. Version/cache string changes, if any
9. Syntax check result
10. Test checklist for the user

## Review guidelines

When reviewing PRs, focus on high-risk regressions only:

- Any accidental data deletion
- Any localStorage/sessionStorage/IndexedDB clearing
- Any Supabase schema or RLS change
- Any broad refactor in script.js
- Any change to WMS deduction rules
- Any change to purchase status/complete workflow
- Any change to admin permission checks
- Any version/cache mismatch
- Any syntax error or missing function reference
