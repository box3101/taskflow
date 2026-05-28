# TaskFlow 빌드 & 배포 트러블슈팅

> 빌드/배포 과정에서 발생한 이슈와 해결 방법 정리 (2026-05-28)

---

## 1. ispark-ui CSS import 경로 오류

### 증상

```
[plugin:builtin:vite-resolve] "./dist/ispark-ui.css" is not exported under the conditions
["module", "browser", "development", "import"] from package @leechanyong/ispark-ui
(see exports field in package.json)
```

### 원인

ispark-ui `package.json`의 `exports` 필드에 `"./dist/ispark-ui.css"` 경로가 선언되어 있지 않았음.
Vite는 `exports` 필드를 strict하게 따르기 때문에, 선언되지 않은 하위 경로는 resolve를 거부한다.

```json
// ispark-ui package.json (v0.5.5) — exports 필드
{
  "exports": {
    ".": { ... },
    "./style.css": "./dist/ispark-ui.css",   // ✅ 선언됨
    "./styles": "./dist/ispark-ui.css"        // ✅ 선언됨
    // "./dist/ispark-ui.css" ← ❌ 없었음
  }
}
```

### 해결

**방법 A — consumer 쪽 수정 (taskflow/frontend)**

```ts
// ❌ Before
import '@leechanyong/ispark-ui/dist/ispark-ui.css'

// ✅ After — exports에 선언된 경로 사용
import '@leechanyong/ispark-ui/style.css'
```

**방법 B — 라이브러리 쪽 수정 (ispark-ui)**

`package.json`의 `exports`에 하위호환 경로 추가:

```json
{
  "exports": {
    "./dist/ispark-ui.css": "./dist/ispark-ui.css",  // ← 추가
    "./style.css": "./dist/ispark-ui.css",
    "./styles": "./dist/ispark-ui.css"
  }
}
```

**적용:** 양쪽 모두 수정 후 ispark-ui v0.5.6 배포

---

## 2. Railway 빌드 실패 — Rolldown resolve 에러

### 증상

```
Error: [vite]: Rolldown failed to resolve import "@leechanyong/ispark-ui/dist/ispark-ui.css"
from "/app/frontend/src/main.ts".
```

Railway에서 자동 배포 시 빌드가 실패함.

### 원인

Railway의 자동 배포가 **수정 이전 커밋**으로 빌드를 실행하고 있었음.
GitHub push 시점과 Railway 빌드 트리거 사이에 시간차가 있어, 이전 커밋 기준으로 빌드가 돌아감.

### 해결

1. 수정된 커밋이 push 된 후 Railway에서 **새 빌드가 최신 커밋으로 트리거**되는지 확인
2. 이전 빌드가 실패 상태로 남아있으면 Railway 대시보드에서 수동 **Redeploy** 실행
3. 캐시 문제가 의심되면 **"Clear build cache"** 옵션 체크 후 재배포

### 확인 방법

Railway 대시보드 → Deployments → 최신 빌드의 **commit SHA**가 올바른지 확인

---

## 3. Railway 비대화형 환경에서 CLI 로그인 불가

### 증상

```
Cannot login in non-interactive mode.
For non-interactive environments, set RAILWAY_API_TOKEN or RAILWAY_TOKEN.
```

### 원인

Railway CLI의 `railway login`은 브라우저 기반 OAuth 인증이라 비대화형 터미널(CI, 원격 세션 등)에서 사용 불가.

### 해결

| 방법 | 설명 |
|------|------|
| **API 토큰** | Railway 대시보드 → Account → Tokens → 생성 후 `RAILWAY_TOKEN` 환경변수 설정 |
| **GitHub 연동** | GitHub push → Railway 자동 배포 (별도 CLI 로그인 불필요) |

TaskFlow는 GitHub 연동 자동 배포가 설정되어 있으므로, `git push origin main`만으로 배포 가능.

---

## 배포 체크리스트

### ispark-ui (npm 라이브러리)

```bash
# 1. 버전 bump
# package.json의 version 수정

# 2. 빌드
npm run build

# 3. 배포
npm publish --access public
```

### taskflow (Railway 자동 배포)

```bash
# 1. 변경사항 커밋
git add <files>
git commit -m "커밋 메시지"

# 2. push → Railway 자동 배포 트리거
git push origin main

# 3. Railway 대시보드에서 빌드 상태 확인
# https://railway.com/project/5c0bc9c8-a805-4431-876d-f1779902431f
```

### ispark-ui 업데이트 후 taskflow 반영

```bash
# ispark-ui 새 버전 배포 후
cd taskflow/frontend
npm update @leechanyong/ispark-ui
# → package-lock.json 변경 커밋 후 push
```

---

## 핵심 교훈

| 항목 | 내용 |
|------|------|
| **exports 필드** | Vite는 `package.json`의 `exports`를 strict하게 따른다. 하위 경로 import 시 반드시 exports에 선언 필요 |
| **Railway 빌드 커밋** | 자동 배포 시 어떤 커밋으로 빌드되는지 반드시 확인 |
| **빌드 캐시** | 의심되면 "Clear build cache" 후 재배포 |
| **양쪽 수정** | 라이브러리 exports 추가(하위호환) + consumer import 경로 수정(정규화) 양쪽 모두 적용이 안전 |
