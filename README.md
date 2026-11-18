# 유학생을 위한 날씨와 공휴일 조회 · Vercel Serverless 프로젝트

**유학생이 도시의 현재 날씨와 한국 공휴일을 함께 확인하는 Vercel Serverless 프로젝트**입니다. `/api/weather`는 Open-Meteo 응답을 필요한 필드만 정리해 10분 CDN 캐시하고, `/api/holidays`는 공공데이터(한국천문연구원 특일 정보)를 1시간 캐시합니다. 공공데이터 인증키는 Vercel 환경 변수에만 두며, 함수는 서울 리전(`icn1`)에서 실행합니다. 날씨·공휴일은 외부 패키지 없이 구현하며, 방명록은 Supabase SDK를 사용합니다.

```text
사용자가 연·월 선택 → 브라우저가 fetch('/api/holidays?year=2026&month=10')
  → Vercel CDN: 같은 조건의 저장된 응답이 있으면 바로 돌려줌(HIT)
  → 없으면 함수 api/holidays.js 실행(서울 icn1): 입력 검사 → 환경 변수의 인증키로 공공데이터 호출 → JSON 정리
  → 화면: 불러오는 중 · 결과 있음 · 결과 없음 · 오류
```

## 파일 역할

| 파일 | 역할 |
|---|---|
| `index.html` | 도시 날씨와 월별 공휴일을 한 화면에서 조회합니다 |
| `api/weather.js` | 도시명 검사, Open-Meteo 위치·날씨 조회, 200/400/404/502 처리, 10분 캐시 |
| `api/holidays.js` | Vercel 함수. 입력 검사, 인증키 확인, 공공데이터 호출, 응답 정리, 캐시 헤더 |
| `vercel.json` | 함수 리전을 서울(`icn1`)로 정합니다 |
| `package.json` | `"type": "module"`(ESM 문법 사용), Node.js 24, 시험 명령 |
| `tests/*.test.mjs` | 가짜 외부 응답으로 정상·잘못된 입력·결과 없음·키 없음·상위 오류를 확인하는 시험 |
| `tests/fixtures/` | 시험과 연습 모드에 쓰는 예시 응답 |
| `scripts/dev.mjs` | 수업용 로컬 시험 서버. 화면과 함수를 한 주소에서 엽니다 |
| `.vercelignore` | Vercel에 올리지 않을 파일(시험·로컬 도구·설명서) |
| `.env.example` | 로컬에서 실제 키를 쓸 때 복사해 `.env.local`로 만드는 틀 |

## 1. 로컬에서 먼저 확인하기 (Node.js가 있을 때)

터미널에서 `node --version`으로 Node.js 22 이상인지 확인하고, 이 폴더에서 실행합니다.

```bash
npm test                     # 시험이 모두 ✔(pass)이면 통과
node scripts/dev.mjs --mock  # 연습 모드 → 브라우저에서 http://localhost:3000
```

연습 모드는 공공데이터 대신 `tests/fixtures`의 예시 응답을 씁니다. 2026년 10월(여러 건), 11월(없음), 12월(한 건), 9월(상위 오류)을 골라 네 가지 화면 상태를 봅니다. 주소창에 `http://localhost:3000/?year=2026&month=13`을 넣으면 잘못된 입력 화면이 나옵니다.

실제 공공데이터를 로컬에서 부르려면 `.env.example`을 복사해 이름을 `.env.local`로 바꾸고 `DATA_GO_KR_KEY=` 뒤에 일반 인증키(Decoding)를 넣은 뒤 `node scripts/dev.mjs`로 엽니다. `.env.local`은 `.gitignore`에 있어 저장소에 올라가지 않습니다.

시험 서버는 수업용이라 Vercel과 완전히 같지는 않습니다. CDN 캐시(`x-vercel-cache`), 리전, 배포 보호, 대시보드 로그는 배포한 뒤 Vercel에서 확인합니다.

## 2. Vercel 가입과 저장소 연결 (Import)

1. <https://vercel.com/signup>에서 **Continue with GitHub**를 눌러 가입합니다. 플랜을 물으면 **Hobby**(무료·개인 비상업)를 고릅니다.
2. 이 폴더의 파일을 GitHub 저장소에 올립니다(숨김 파일 `.gitignore`, `.vercelignore` 포함). 이미 있는 개인 프로젝트 저장소에 넣을 때는 `api/`, `vercel.json`, `package.json`을 저장소 최상위에 둡니다.
3. Vercel 대시보드에서 **Add New… → Project**를 누릅니다(주소 <https://vercel.com/new>). 저장소 목록에 내 저장소가 없으면 같은 화면의 **Configure GitHub App**에서 그 저장소를 허용합니다.
4. 저장소 옆 **Import**를 누르고 설정 화면에서 확인합니다.
   - **Project Name**: 주소가 `이름.vercel.app`이 됩니다
   - **Framework Preset**: Other
   - **Root Directory**: 저장소 최상위면 그대로 둡니다
   - **Environment Variables**: Key `DATA_GO_KR_KEY`, Value 공공데이터포털 마이페이지의 일반 인증키(Decoding)
5. **Deploy**를 누르고, 끝나면 대시보드에서 **Domains**의 주소를 엽니다.

이후에는 `main`에 Push할 때마다 운영(Production) 배포가, 다른 브랜치에 Push하면 미리보기(Preview) 배포가 자동으로 만들어집니다.

## 3. 환경 변수와 리전

- 환경 변수는 프로젝트 **Settings → Environment Variables**에서 관리합니다. 종류를 고르는 칸이 있으면 값이 다시 보이지 않는 **Secret**을 고르고, 적용 환경은 **Production**과 **Preview**를 체크합니다.
- 환경 변수를 추가하거나 바꾼 뒤에는 **다시 배포해야** 새 값이 적용됩니다. **Deployments → 최신 배포의 ⋯ → Redeploy**를 누르거나 새 커밋을 Push합니다.
- 함수 리전은 `vercel.json`의 `"regions": ["icn1"]`이 정합니다. Hobby는 리전 하나를 고를 수 있고, 이 값이 프로젝트 설정보다 우선합니다.

## 4. 배포 확인

1. 운영 주소를 열어 이번 달 공휴일이 보이는지 확인합니다.
2. 주소창에 `https://이름.vercel.app/api/holidays?year=2026&month=10`을 넣어 함수의 JSON 응답을 직접 봅니다.
3. **캐시**: 개발자 도구(F12) → Network → `holidays` 요청 → Response Headers의 `x-vercel-cache`를 봅니다. 같은 조건을 처음 부르면 `MISS`, 다시 부르면 `HIT`입니다. 화면의 '가져온 시각'이 그대로면 CDN에 저장된 응답이 온 것입니다.
4. **리전**: 대시보드 **Logs**에서 방금 요청을 눌러 Function 정보의 실행 위치가 `icn1`인지 봅니다. 응답 헤더 `x-vercel-id`에도 요청이 거친 리전과 함수가 실행된 리전이 적힙니다.
5. **로그**: 함수의 `console.error` 줄과 상태 코드가 Logs에 남습니다. Hobby는 최근 1시간 로그를 보여 줍니다.

## 5. 검증표

| 상황 | 해 보는 방법 | 기대 결과 |
|---|---|---|
| 결과 있음 | 2026년 10월 조회 | 3일(개천절·대체공휴일·한글날)과 가져온 시각 |
| 결과 없음 | 2026년 11월 조회 | '공휴일이 없습니다' 안내 |
| 잘못된 입력 | `/api/holidays?year=2026&month=13` | 400과 고칠 방법이 담긴 JSON, 화면에는 오류 안내 |
| 키 없음 | 로컬에서 키 없이 `node scripts/dev.mjs` 후 조회 | 500과 환경 변수 설정 안내 |
| 상위 오류 | 연습 모드에서 2026년 9월 조회, 또는 `npm test` | 502와 '확인할 점' 안내, 다시 시도 버튼 |
| 캐시 | 같은 조건을 두 번 조회 | `x-vercel-cache`가 MISS → HIT |
| 리전 | Logs 또는 `x-vercel-id` | `icn1` |
| 휴대전화 폭 | 휴대전화로 운영 주소 열기 | 가로 넘침 없음 |

## 6. 내 프로젝트의 API로 바꿀 때

| 바꿀 곳 | 내용 |
|---|---|
| 파일 이름 | `api/holidays.js` → `api/내기능.js` (주소가 `/api/내기능`이 됩니다) |
| `API_URL` | 공공데이터포털 API 상세 화면의 요청주소 |
| ② 입력 검사 | 내 화면에서 사용자가 고르는 조건(지역 코드, 날짜, 검색어 등)의 허용 범위 |
| ④ 요청 변수 | 명세의 필수 요청 변수, JSON으로 받는 방법(`_type=json`, `returnType=json` 등 API마다 다름) |
| ⑥ 정리 | `toHoliday`처럼 화면에 필요한 필드만 골라 담기 |
| `CACHE_OK` | 데이터가 바뀌는 주기에 맞춘 캐시 시간(실시간 측정값은 짧게, 하루 단위 자료는 길게) |
| `index.html` | `showList`에서 항목을 그리는 부분 |

## 공식 문서

- 한국천문연구원 특일 정보: https://www.data.go.kr/data/15012690/openapi.do
- Vercel 함수 시작하기: https://vercel.com/docs/functions/quickstart
- 함수 리전: https://vercel.com/docs/functions/configuring-functions/region
- 환경 변수: https://vercel.com/docs/environment-variables
- CDN 캐시: https://vercel.com/docs/caching/cdn-cache
- Git 연결과 배포: https://vercel.com/docs/git
- 런타임 로그: https://vercel.com/docs/logs/runtime
- Hobby 요금제: https://vercel.com/docs/plans/hobby


# 기술개발연구프로젝트 10주차 — Supabase 방명록

기존 `121-cmaker/holiday-api` (날씨와 한국 공휴일 조회)에 **추가**할 파일입니다. 기존 9주차 파일을 삭제하거나 교체하지 않습니다.

## 기능
- `/guestbook.html` 한 줄 방명록
- `GET /api/guestbook`: 최신 글 20개, 성공 시 200
- `POST /api/guestbook`: `{ "name": "민지", "message": "좋아요" }`, 성공 시 201
- 별명 1~20자, 내용 1~200자. 공개 조회만 허용; 새 글은 Vercel 함수 입력 검사 후 저장.

## 구성
- `supabase/guestbook.sql` — Supabase SQL Editor에서 실행할 표와 RLS
- `api/guestbook.js` — Vercel 함수
- `lib/guestbook-validation.js` — 입력 검사
- `guestbook.html` — 웹 페이지 (방문자 글은 textContent로 렌더링)
- `test/guestbook.test.js` — 단위 테스트
- `supabase/weather_reviews.sql` — 내 프로젝트(유학생 도시 날씨) 후기를 위한 11/4 설계 파일. 실제 DB 실행과 저장 기능 구현은 11/11 전 별도 단계.

## 설치와 실행
1. 해당 파일들을 기존 `holiday-api` 저장소 같은 경로에 복사합니다.
2. 프로젝트 `package.json`의 dependencies에 `"@supabase/supabase-js": "^2.0.0"`를 추가하고 `npm install`을 실행합니다.
3. `npm test`로 단위 테스트를 확인합니다.
4. Supabase Free `guestbook-dev` (Seoul)를 만들고 SQL Editor에서 `supabase/guestbook.sql` 내용을 검토 후 실행합니다.
5. Vercel Settings → Environment Variables에 직접 `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`를 추가하고 재배포합니다.

**비밀키와 DB 비밀번호는 GitHub, README, 채팅에 절대 입력하지 않습니다.**

## 운영 검증 기록 (2026-11-04 KST)
운영 주소: https://holiday-api-ywgd.vercel.app/guestbook.html
배포 소스: PR #1 병합 커밋 `5aad3335726cf5242605eca85951832bdda56bf4`.

| 항목 | 실제 결과 |
|---|---|
| GET /api/guestbook | 200, 처음에는 빈 목록 |
| 빈 이름 POST | 400 |
| 201자 내용 POST | 400 |
| text/plain POST | 400 |
| 정상 POST | 201, 수업 테스트용 글 1개 저장 |
| 저장 후 GET | 200, 반환된 id가 목록에 존재 |
| guestbook.html | 200 |
| 화면 HTML 및 위 API 응답의 키 접두사 | sb_secret_, sb_publishable_ 없음 |
| RLS | true, 정책 1개, SELECT만 |
| anon 및 authenticated 권한 조회 | SELECT만, INSERT false |
| anon 직접 INSERT | begin; set local role anon; insert …; rollback; 실행 시 SQLSTATE 42501 permission denied |
| 기존 날씨 /api/weather?city=Seoul | 200 |
| 기존 공휴일 /api/holidays?year=2026&month=10 | 200, 개천절·대체공휴일·한글날 3개 (인증키 설정 후 재검증) |

HTTP 검증은 Python urllib.request로 운영 주소에 실제 GET/POST 요청을 보내 상태와 JSON을 확인했습니다. 정상 POST는 별명 `수업 테스트`, 내용 `11월 4일 배포 확인용 테스트입니다.`로 수행했습니다. 공개 테스트 글은 목록에 남습니다. RLS는 Supabase SQL Editor에서 실제 조회 및 anon 역할 INSERT 시도로 확인했습니다. 모바일 화면과 20개 초과 데이터 정렬은 별도 실측하지 않았습니다.

## 개인 프로젝트 설계
유학생 날씨·공휴일 조회 웹사이트에 방문자의 **도시별 날씨 정보 후기**를 저장하는 기능을 기획했습니다. 테이블 `weather_reviews` 컬럼은 `id`, `created_at`, `nickname`, `city`, `review`이며, 별명만 받고 전화번호·학번·실명은 저장하지 않습니다. SELECT는 공개하고 INSERT는 서버 검증을 통과한 요청만 처리합니다. SQL 설계 파일은 `supabase/weather_reviews.sql`입니다.


## 로컬 테스트
Node.js 24에서 `node --test`: 27/27 통과 (기존 공휴일·날씨 20개 + 입력 검증 6개 + API 오류 처리 1개). Supabase 의존성을 설치한 뒤 실행했으며 키 없음 500, DB 오류 502도 모의 응답으로 검증했습니다.

GitHub 연결의 저장소 선택에 holiday-api를 추가하여 403을 해결했고, PR #1을 승인 후 main에 병합했습니다. 비밀키는 Vercel Production의 Secret 유형으로 저장했습니다.


## 공휴일 API 최종 재검증 (2026-11-04 16:25 KST)
공공데이터포털에서 한국천문연구원 특일 정보의 공휴일 조회 개발계정을 신청하여 자동승인 받았습니다. 인증키는 Vercel Production의 DATA_GO_KR_KEY (Secret)에만 저장하고 재배포했습니다. 이전 500 NO_KEY 문제는 해결되었습니다.

| 실제 운영 요청 | 결과 |
|---|---|
| /api/holidays?year=2026&month=10 | 200, 10/3 개천절·10/5 대체공휴일·10/9 한글날 |
| /api/holidays?year=2026&month=11 | 200, count 0, items [] |
| /api/holidays?year=2026&month=12 | 200, 12/25 기독탄신일 1개 |
| /api/holidays?year=2026&month=13 | 400 BAD_MONTH |
| 10월 요청 2회 반복 | x-vercel-cache HIT / HIT |
| /api/weather?city=Seoul | 200 |
| /api/guestbook | 200 |

Python urllib.request로 실제 운영 주소에 요청하여 상태 코드, JSON 본문, 캐시 응답 헤더를 확인했습니다. 키나 비밀번호는 이 기록에 포함하지 않았습니다.


## 12주차 — Open HASA AI 추천 (2026-11-18 KST)

운영 주소: https://holiday-api-ywgd.vercel.app/
AI 함수: https://holiday-api-ywgd.vercel.app/api/suggest?year=2026&month=10

### 내 서비스의 AI 적용 자리와 선택

| 후보 | 사용자에게 주는 도움 | 선택 |
|---|---|---|
| 월별 공휴일 활용 추천 | 공휴일 목록에서 다음 행동 세 가지를 제안 | 이번 주 구현 |
| 도시 날씨 설명 | 기상 수치를 쉬운 한국어로 설명 | 향후 후보 |
| 날씨 정보 후기 요약 | 개인정보를 제거한 후기에서 공통 의견 정리 | 향후 후보 |

`api/suggest.js`는 기존 공휴일 함수를 재사용한 뒤 `https://open.hasa.re.kr/v1/chat/completions`의 `gemma-4-31b`를 호출합니다. 서버의 시스템 지시와 연·월·공휴일 목록을 분리하고, 한국어 세 줄·한 줄 40자 이내를 검사합니다. 공휴일이 없는 달에는 일반 여가 활동만 제안하도록 지시합니다. AI의 사실 정확성은 별도 확인이 필요합니다.

- 키는 `process.env.HASA_API_KEY`에서만 읽습니다. 학생 본인이 Vercel Production 환경 변수에 Sensitive로 추가한 뒤 재배포합니다.
- 요청 전체에 20초 중단 타이머를 두고 `max_tokens=300`, 사용자 메시지 500자 제한을 적용합니다.
- 잘못된 연·월 400, 키 없음 500, 상위 한도 429, 시간 초과 504, 통신·공휴일 조회 실패 502를 안내합니다. 형식이 잘못된 AI 답은 200과 `needsRetry: true`로 반환하고 원문은 숨깁니다.
- 같은 연·월의 성공 응답은 서버 인스턴스 메모리에 5분 저장하며 최대 24건입니다. 같은 인스턴스의 동시 중복 요청은 합칩니다. 영구 DB 저장은 하지 않습니다. 인스턴스가 종료되면 삭제됩니다.
- 이 캐시는 분산 전역 한도 장치가 아닙니다. 개발키의 분당 10회·동시 1건·하루 성공 500건 제한은 제공자가 집행하며 429를 화면에 안내합니다. 수업 시연용입니다.
- AI에는 연·월과 공개 공휴일 목록만 전송합니다. 실명·학번·연락처·도시 검색어·방명록은 보내지 않습니다. 화면에 전송 항목과 AI 오류 가능성을 알립니다.
- 추천 버튼은 요청 중 잠기며, 월을 바꾸거나 새 공휴일 조회를 하면 이전 추천을 취소합니다. 응답은 `textContent`로 표시합니다.

### 테스트와 운영 검증

`npm test`는 올바른 위치의 `tests/*.test.mjs`와 `test/*.test.js`만 실행합니다. 루트에 중복 업로드된 예전 테스트는 상대 경로가 잘못되어 실행 대상에서 제외합니다. GitHub Actions는 Node.js 24에서 의존성 설치 후 전체 테스트를 실행합니다.

| 항목 | 검증 방법 | 현재 결과 |
|---|---|---|
| AI 정상·400·키 없음·429·시간 초과 | `node --test tests/suggest.test.mjs` | 11개 테스트 통과(형식·캐시·중복·무공휴일·상위 오류 포함) |
| 기존 공휴일·날씨·입력 검증 | `node --test tests/*.test.mjs test/guestbook.test.js` | 37개 통과 |
| Supabase API 포함 전체 테스트 | GitHub Actions `npm test` | 38/38 통과 — [실행 기록](https://github.com/121-cmaker/holiday-api/actions/runs/44253302891) |
| 운영 정상 200·추천 세 줄 | `/api/suggest?year=2026&month=10` | HASA_API_KEY 미설정, 본인 입력 후 재배포·검증 필요 |
| 운영 13월·문자 입력 400 | `/api/suggest?year=2026&month=13`, `?year=abc&month=10` | 실제 운영 요청으로 확인: 400 BAD_MONTH / BAD_YEAR |
| 응답·화면의 비밀키 노출 없음 | HTML·응답 검사 | HTML·점검 API 응답에서 비밀키 접두사 패턴 없음 |
| 화면 로딩·오류·재시도 | 추천 버튼과 오류 안내 | 모의 브라우저에서 로딩·3개 결과·월 변경 초기화 확인. 운영 390px에서 키 없음 오류·재시도 활성화 확인, 가로 넘침 없음 |

로컬 전체 실행은 Supabase SDK 미설치로 실패했고, 네트워크 DNS 제한으로 설치하지 못했습니다. AI 테스트와 의존성 불필요 회귀 테스트는 실제 실행했습니다. 이후 GitHub Actions에서 실제 의존성 설치와 전체 38개 테스트 통과를 확인했습니다. 실제 AI 성공 응답이나 사용자 피드백을 모의 테스트 결과로 대체하지 않습니다.

### 사용자 피드백과 반영

실제 사용자 3명 이상의 피드백은 학생 본인이 받아 아래에 기록합니다. 현재 미수집이며 아래 행은 제출 완료 기록이 아닙니다.

| 사용자(익명) | 해 본 것 | 막힌 곳 | 좋았던 점 | 바꾸면 좋을 점 | 반영 계획·근거 |
|---|---|---|---|---|---|
| 사용자 1 | 미수집 | 미수집 | 미수집 | 미수집 | 피드백 후 작성 |
| 사용자 2 | 미수집 | 미수집 | 미수집 | 미수집 | 피드백 후 작성 |
| 사용자 3 | 미수집 | 미수집 | 미수집 | 미수집 | 피드백 후 작성 |


### 운영 검증 실행 기록 (2026-11-18 15:45 KST)

- 배포 소스: `6cdd737d12504f984e987b7314bd717df801f140`; Vercel `dpl_2HGENXTKXM554zXjzsphmkdYwrWh`, Production READY, `icn1`.
- 실제 실행 명령: Node.js 24.22.1에서 `node --test tests/*.test.mjs test/guestbook.test.js` → 37/37. GitHub Actions에서 `npm install --ignore-scripts --no-audit --no-fund`, `npm test` → 38/38.
- 운영 HTTP 요청은 인증된 배포 조회 도구로 GET을 전송해 아래 상태와 JSON을 확인했습니다. 키 값은 조회·출력하지 않았습니다.

| 실제 HTTP 요청 | 결과 |
|---|---|
| `GET /` | 200, AI 버튼·로딩 문구·개인정보 안내 있음 |
| `GET /api/suggest?year=2026&month=13` | 400, BAD_MONTH |
| `GET /api/suggest?year=abc&month=10` | 400, BAD_YEAR |
| `GET /api/suggest?year=2026&month=10` | 500, NO_KEY와 관리자 설정 안내. 실제 200 추천은 아직 검증하지 못함 |
| `GET /api/holidays?year=2026&month=10` | 200, 공휴일 3개 |
| `GET /api/guestbook` | 200, 기존 글 조회 성공 (추가 글 작성 없음) |
| `GET /api/weather?city=Seoul` | 첫 요청 502 UPSTREAM_TIMEOUT, 재시도 200. 외부 날씨 서버의 일시 지연 |
| HTML 및 위 점검 응답의 비밀키 패턴 검사 | 노출 발견 없음 |
| 운영 화면 390×844 | 10월 조회 후 AI 버튼 클릭 → 키 없음 안내·재시도 버튼 활성화, 가로 넘침 없음 |

Playwright 모의 응답 화면 점검에서는 요청 중 버튼 잠금·로딩 글, 세 줄 결과, 오류 후 재시도, 월 변경 시 결과 초기화를 확인했습니다. 모의 세 줄을 실제 AI 답변으로 기록하지 않았습니다.

남은 본인 수행 항목: HASA_API_KEY를 Sensitive·Production으로 입력 → 재배포 후 실제 200/추천 세 줄 확인; 사용자 3명 피드백 수집 및 반영 근거 작성.
