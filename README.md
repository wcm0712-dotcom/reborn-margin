# Reborn Margin/WMS App

리본컴퍼니용 정적 웹앱입니다.

## Current baseline

- Latest imported ZIP: `reborn_margin_wms_inventory_manual_adjust_log_fix.zip`
- Current app version: `reborn-inventory-manual-adjust-log-fix-01`
- Production reference URL: `https://reborn-margin-web.vercel.app/#wms`

## Main files

- `index.html` — app shell and asset version query strings
- `script.js` — main app logic
- `style.css` — styles
- `manifest.json` — PWA manifest
- `vercel.json` — Vercel config

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
