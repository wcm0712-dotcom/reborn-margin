# First Codex task prompt

Use this prompt for the first Codex run after connecting the repository.

```txt
이 저장소는 Reborn Margin/WMS 앱입니다.
먼저 파일을 수정하지 말고 코드 구조만 파악해주세요.

반드시 확인할 것:
1. AGENTS.md 내용을 읽고 요약
2. index.html, script.js, style.css, manifest.json, vercel.json 구조 파악
3. 현재 cacheVersion과 index.html 버전 쿼리 일치 여부 확인
4. saveInventoryManualAdjust 안의 addAdminActionLog 호출이 `addAdminActionLog("manual_adjust", payload)` 형태로 유지되어 있는지 확인
5. localStorage.clear/sessionStorage.clear/indexedDB.deleteDatabase 사용 여부 확인
6. node --check script.js 가능 여부 확인

수정 금지:
- 어떤 파일도 변경하지 마세요.
- 리팩토링하지 마세요.
- 기능 개선 제안만 하지 말고, 현재 위험 요소와 다음 작업 순서만 보고해주세요.
```
