# ispark-ui 수정 시 이슈 자동 등록 규칙

ispark-ui 컴포넌트를 수정/추가한 후에는 **반드시** TaskFlow 프로젝트 #33 (ispark-ui 디자인 시스템)에 이슈를 등록한다.

## 등록 형식

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

## 등록 방법

1. ispark-ui 커밋 & npm 배포 완료 후
2. taskflow 백엔드 서버 기동
3. API로 프로젝트 33에 이슈 POST
4. description에 변경 내역 + 버전 + 커밋 해시 포함

## 등록 대상

- 새 컴포넌트 추가
- 기존 컴포넌트 prop 추가/변경
- 기존 컴포넌트 동작 변경
- 스토리북 문서 추가 (별도 이슈로)
- 버그 수정
