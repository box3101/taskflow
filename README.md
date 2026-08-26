<p align="center">
<br>
<a href="https://ispark-task.up.railway.app/"><img src="https://img.shields.io/badge/TaskFlow-Project_Management-3b82f6?style=for-the-badge" /></a>
<br><br>
<strong>디자인 시스템을 만들었으면, 그걸로 제품을 만들어야 증명이 됩니다.</strong>
<br><br>
<a href="https://vuejs.org/"><img src="https://img.shields.io/badge/Vue_3-4FC08D?style=flat-square&logo=vue.js&logoColor=white" /></a>
<a href="https://typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white" /></a>
<a href="https://expressjs.com/"><img src="https://img.shields.io/badge/Express-000000?style=flat-square&logo=express&logoColor=white" /></a>
<a href="https://www.prisma.io/"><img src="https://img.shields.io/badge/Prisma-2D3748?style=flat-square&logo=prisma&logoColor=white" /></a>
<a href="https://www.postgresql.org/"><img src="https://img.shields.io/badge/PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white" /></a>
<a href="https://www.npmjs.com/package/@leechanyong/ispark-ui"><img src="https://img.shields.io/badge/ispark--ui-6366f1?style=flat-square" /></a>
</p>

---

### What is TaskFlow?

[ispark-ui](https://github.com/box3101/ispark-ui) 디자인 시스템의 **실전 적용 증명**입니다.  
프론트엔드부터 백엔드, DB 설계, 인증, 배포까지 **풀스택을 혼자 설계·구현**했습니다.

컴포넌트 라이브러리를 만드는 것과 그걸로 실제 제품을 만드는 건 전혀 다른 문제입니다.  
TaskFlow는 그 간극을 직접 메운 프로젝트입니다.

### Demo

🔗 **[ispark-task.up.railway.app](https://ispark-task.up.railway.app/)**

> [!TIP]
> **테스트 계정** — ID: `test` · PW: `test`

### Architecture

| Layer | Stack | Role |
|-------|-------|------|
| **Frontend** | Vue 3 + Vite + Pinia | SPA 클라이언트 |
| **UI** | ispark-ui | 디자인 시스템 컴포넌트 |
| **Backend** | Express + Prisma | REST API 서버 |
| **Database** | PostgreSQL (Railway) | 관계형 데이터 |
| **Auth** | JWT (Access + Refresh) | httpOnly 쿠키 기반 |
| **Deploy** | Vercel + Railway | 프론트·백 분리 배포 |

### Core Features

**📋 프로젝트 CRUD** — 프로젝트 생성·수정·삭제·상태 관리. 멤버 할당과 진행률 추적.

**📅 캘린더 뷰** — 일정 기반 태스크 관리. 마감일과 마일스톤을 한눈에.

**🔐 JWT 인증** — Access 토큰(15분) + Refresh 토큰(7일). httpOnly 쿠키로 XSS 차단.

**👥 역할 기반 권한** — 관리자와 멤버의 접근 권한을 분리하여 데이터 보호.

**🎨 ispark-ui 실전 적용** — Button, Modal, Table, Tab, Badge 등 디자인 시스템 컴포넌트를 실제 제품에 조합.

### Structure

```
├── frontend/
│   ├── src/views/        # 페이지 컴포넌트
│   ├── src/components/   # 재사용 컴포넌트
│   └── src/stores/       # Pinia 상태 관리
├── backend/
│   ├── src/routes/       # REST API 엔드포인트
│   ├── src/middleware/   # 인증·권한 미들웨어
│   └── prisma/           # DB 스키마
└── docker-compose.yml    # 로컬 개발 환경
```

### Setup

```bash
cd frontend && npm install && npm run dev   # http://localhost:5173
cd backend && npm install && npm run dev    # http://localhost:4000
```

---

<sub>이찬용 · <a href="https://github.com/box3101">@box3101</a></sub>
