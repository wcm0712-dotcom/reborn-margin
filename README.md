# Reborn Margin/WMS App

리본컴퍼니용 정적 웹앱입니다.

## Current baseline

- Source baseline: `reborn_margin_wms_accounting_evidence_batch_count_01.zip`
- Current package: `reborn_margin_wms_evidence_partner_categories_01.zip`
- Current app version: `reborn-evidence-partner-categories-01`
- 적용·공개 범위·사진 저장소·검증 한계: [APPLY_GUIDE.md](APPLY_GUIDE.md)
- Production reference URL: `https://reborn-margin-web.vercel.app/#wms`

## Main files

- `index.html` — app shell and asset version query strings
- `script.js` — main app logic
- `style.css` — styles
- `manifest.json` — PWA manifest
- `vercel.json` — Vercel config
- `accounting-evidence.js` - partner categories, category/date registration and complete image exports
- `evidence-categories-core.js` - grouping, complete pagination and bounded ZIP streaming
- `vendor/fflate-0.8.2.min.js` - locally bundled ZIP library with its MIT license

## Local checks

```bash
node --check script.js
```

Forbidden deletion command check:

```bash
grep -R "localStorage.clear\|sessionStorage.clear\|indexedDB.deleteDatabase" -n --include="*.js" --include="*.html" --include="*.css" --include="*.json" --exclude="package.json" . || true
```

## Codex instructions

Read `AGENTS.md` before making changes. This project must be modified conservatively because broad refactors have broken core WMS and UI behavior in the past.
