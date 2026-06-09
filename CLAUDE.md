# TaskFlow 프로젝트 규칙

## 셀프체크 (코드 변경 전 필수)

작업 완료 전 아래 항목을 확인한다. 하나라도 NO면 수정 후 진행.

- [ ] 해당 파일을 Read로 먼저 읽었나?
- [ ] 한국어 인코딩 깨짐 없나? (curl로 한글 전송 시 파일로 분리)
- [ ] 커밋 메시지가 한국어로 명확한가?
- [ ] 요청받지 않은 불필요한 변경을 하지 않았나?
- [ ] UI 라이브러리(ispark-ui)에 이미 있는 스타일을 중복 추가하지 않았나?
- [ ] 배열 객체 교체 시 같은 객체를 참조하는 다른 ref도 동기화했나?

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

## 외부 연동

- Google Sheets Apps Script URL: `https://script.google.com/macros/s/AKfycbwTDrTn456l1q5rT_fECsRLkrErRBEovRFib4WGZtSrkP4jE1YuSizei13UfDhuHVlS/exec`
  - 용도: 관리번호 클릭 시 구글시트 해당 행으로 이동
  - 파라미터: `?id={externalId}`

## 상세 규칙 (별도 파일)

- [작업 후 이슈 등록 규칙](docs/rules-issue-tracking.md) — TaskFlow #32, ispark-ui #33
- [ispark-ui 이슈 등록 상세](docs/rules-ispark-ui.md)
- [캐시/ref 동기화 패턴](docs/rules-stale-data.md)
- [실수 오답노트](docs/mistakes.md)
