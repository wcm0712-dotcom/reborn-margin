# 추가 의존성 안내

- `xlsx.full.min.js`: 기존 앱과 같은 SheetJS CE 0.18.5의 로컬 사본입니다. 코드 자체는 수정하지 않았습니다. `SHEETJS-LICENSE`에 Apache-2.0 라이선스를 포함했습니다. 기존 WMS 호환성과 기존 내보내기에 사용합니다.
- `xlsx-count-parser.min.js`: 새 일괄 계산기 Worker 전용 SheetJS CE 0.20.3입니다. 공식 CDN의 파일을 수정 없이 포함했고 `SHEETJS-PARSER-LICENSE`를 동봉했습니다. [공식 설치 자료](https://docs.sheetjs.com/docs/getting-started/installation/standalone/)와 [2023 취약점 공지](https://cdn.sheetjs.com/advisories/CVE-2023-30533), [2024 취약점 공지](https://cdn.sheetjs.com/advisories/CVE-2024-22363)를 기준으로 기존 취약 버전의 새 읽기 용도 확장을 피했습니다. 기존 WMS의 취약 버전 교체까지 완료했다는 뜻은 아닙니다.
- 사진 서버의 npm 의존성은 `@supabase/supabase-js@2.57.4`(MIT), `jpeg-js@0.4.4`(BSD-3-Clause), `pngjs@7.0.0`(MIT)로 고정했습니다. 서버 런타임이 해당 패키지의 배포물을 가져오며 프런트엔드에 비밀키를 넣지 않습니다.
- 기존 Lucide 아이콘 데이터 및 `LUCIDE-LICENSE`는 그대로 보존했습니다.
- 기존 프런트엔드 Supabase SDK의 로딩·인증 흐름은 유지했습니다. 이 SDK의 기존 CDN 경로는 별도 버전 고정 작업 대상으로 남겼습니다.
- `vendor/fflate-0.8.2.min.js`: [fflate 0.8.2](https://github.com/101arrowz/fflate/tree/v0.8.2)의 공식 npm UMD 배포물입니다. 코드 변경 없이 로컬 동봉했고 MIT 라이선스는 `vendor/FFLATE-LICENSE`에 있습니다. 순차 ZIP 생성에 사용하며 실제 업무 자료를 외부 압축 서비스로 보내지 않습니다.
