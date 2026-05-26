# TaskFlow — 프로젝트 관리 앱

> ispark-ui 디자인 시스템을 활용한 풀스택 프로젝트

## 기술 스택

| 구분 | 스택 |
|---|---|
| 프론트엔드 | Vue 3 + TypeScript + Vite + ispark-ui + Pinia + Vue Router |
| 백엔드 | Node.js + Express + TypeScript + Prisma |
| DB | PostgreSQL |
| 인증 | JWT |

## 빠른 시작

### 1. PostgreSQL 준비

로컬에 PostgreSQL이 없으면 Docker로 실행:

```bash
docker run -d --name taskflow-db -e POSTGRES_PASSWORD=1234 -e POSTGRES_DB=taskflow -p 5432:5432 postgres:16
```

### 2. 백엔드

```bash
cd backend
cp .env.example .env    # DB 접속 정보 수정
npm run db:migrate      # 테이블 생성
npm run db:seed         # 테스트 데이터 투입
npm run dev             # http://localhost:4000
```

### 3. 프론트엔드

```bash
cd frontend
npm run dev             # http://localhost:5173
```

### 테스트 계정

| 이메일 | 비밀번호 | 역할 |
|---|---|---|
| chanyong@test.com | 1234 | admin |
| hyunji@test.com | 1234 | member |

## 역할 분담

- **찬용** (백엔드): API + DB + 인증 + 배포
- **현지** (프론트): Vue 화면 + ispark-ui 컴포넌트 + API 연동

## API 엔드포인트

```
POST   /auth/login              로그인
POST   /auth/register           회원가입
GET    /projects                 프로젝트 목록
POST   /projects                 프로젝트 생성
GET    /projects/:id             프로젝트 상세
PUT    /projects/:id             프로젝트 수정
GET    /projects/:id/members     멤버 목록
POST   /projects/:id/members     멤버 추가
GET    /projects/:id/issues      이슈 목록
POST   /projects/:id/issues      이슈 생성
PUT    /issues/:id               이슈 수정
DELETE /issues/:id               이슈 삭제
```
