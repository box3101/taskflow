# TaskFlow 프로젝트 규칙

## 셀프체크 (코드 변경 전 필수)

작업 완료 전 아래 항목을 확인한다. 하나라도 NO면 수정 후 진행.

- [ ] 해당 파일을 Read로 먼저 읽었나?
- [ ] 한국어 인코딩 깨짐 없나? (curl로 한글 전송 시 파일로 분리)
- [ ] 커밋 메시지가 한국어로 명확한가?
- [ ] 요청받지 않은 불필요한 변경을 하지 않았나?
- [ ] UI 라이브러리(ispark-ui)에 이미 있는 스타일을 중복 추가하지 않았나?
- [ ] 배열 객체 교체 시 같은 객체를 참조하는 다른 ref도 동기화했나?

## 실수 기록

### [인코딩] curl 한글 깨짐
- **상황**: curl -d로 한글 JSON 전송
- **실수**: 직접 문자열로 넣으면 cp949 인코딩 문제로 깨짐
- **해결**: 반드시 UTF-8 파일로 저장 후 `-d @파일경로`로 전송
- **날짜**: 2026-06-08

### [확인 부족] UI 스타일 중복 추가
- **상황**: 테이블 행 구분선 추가
- **실수**: ispark-ui UiTable에 이미 border가 있는데 확인 안 하고 중복 추가
- **해결**: :deep() 오버라이드 전에 기존 라이브러리 스타일 먼저 확인
- **날짜**: 2026-06-09

### [디자인] 배경색 변경 실패
- **상황**: 전체 배경 + 카드 배경 동시 변경
- **실수**: 여러 파일 동시에 바꿔서 결과가 안 맞음
- **해결**: 한 번에 하나만 바꾸고 확인 (루프 엔지니어링 원칙)
- **날짜**: 2026-06-09

### [URL] Apps Script URL 오타
- **상황**: 구글시트 연동 URL 하드코딩
- **실수**: 대소문자 오타 (HVIS → HVlS)
- **해결**: 사용자가 제공한 URL을 그대로 복사, 직접 타이핑하지 않기
- **날짜**: 2026-06-09

### [캐시] 배열 교체 시 ref 참조 끊김 (stale data)
- **상황**: 이슈 필드 변경 후 API 응답으로 `issues.value[idx] = data` 교체
- **실수**: `panelIssue` 등 별도 ref가 옛 객체를 가리켜 화면 갱신 안 됨
- **해결**: `issues.value[idx] = data` 하는 모든 곳에서 관련 ref도 동기화
- **규칙**: `배열[idx] = newObj` 패턴 사용 시 해당 객체를 참조하는 다른 ref가 있는지 반드시 확인
- **날짜**: 2026-06-09

## 기술 스택

- Frontend: Vue 3 + TypeScript + SCSS
- Backend: Express + Prisma + PostgreSQL (Railway)
- UI: @leechanyong/ispark-ui
- 배포: Vercel (자동, main push 시)

## 프로젝트 구조

- `frontend/src/views/` - 페이지 컴포넌트
- `frontend/src/components/` - 재사용 컴포넌트
- `backend/src/routes/` - API 라우트
- `backend/src/prisma.ts` - DB 클라이언트

## ispark-ui 수정 시 이슈 자동 등록 규칙

ispark-ui 컴포넌트를 수정/추가한 후에는 **반드시** TaskFlow 프로젝트 #33 (ispark-ui 디자인 시스템)에 이슈를 등록한다.

### 등록 형식

- **제목**: `{컴포넌트명} {변경 요약}` (예: `UiTextarea 전체보기(expandable) 기능 추가`)
- **description** (필수):
  ```
  변경: {무엇을 바꿨는지}
  - {상세 변경사항 1}
  - {상세 변경사항 2}
  버전: v{x.y.z}
  커밋: {short sha}
  ```
- **category**: `improvement` (기능 추가/개선) 또는 `bug` (버그 수정)
- **status**: `done` (이미 완료된 작업이므로)
- **externalId**: 자동 채번 (미입력)

### 등록 방법

1. ispark-ui 커밋 & npm 배포 완료 후
2. taskflow 백엔드 서버 기동
3. API로 프로젝트 33에 이슈 POST
4. description에 변경 내역 + 버전 + 커밋 해시 포함

### 등록 대상

- 새 컴포넌트 추가
- 기존 컴포넌트 prop 추가/변경
- 기존 컴포넌트 동작 변경
- 스토리북 문서 추가 (별도 이슈로)
- 버그 수정

## 외부 연동

- Google Sheets Apps Script URL: `https://script.google.com/macros/s/AKfycbwTDrTn456l1q5rT_fECsRLkrErRBEovRFib4WGZtSrkP4jE1YuSizei13UfDhuHVlS/exec`
  - 용도: 관리번호 클릭 시 구글시트 해당 행으로 이동
  - 파라미터: `?id={externalId}`
