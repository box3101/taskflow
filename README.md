<p align="center">
<br>
<a href="https://ispark-task.up.railway.app/"><img src="https://img.shields.io/badge/TaskFlow-프로젝트_관리-3b82f6?style=for-the-badge" alt="TaskFlow" /></a>
<br><br>
</p>

# TaskFlow

> ispark-ui 디자인 시스템으로 만든 풀스택 프로젝트 관리 앱

<p>
<a href="https://vuejs.org/"><img src="https://img.shields.io/badge/-Vue_3-4FC08D?style=flat-square&logo=vue.js&logoColor=white" /></a>
<a href="https://typescriptlang.org/"><img src="https://img.shields.io/badge/-TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white" /></a>
<a href="https://expressjs.com/"><img src="https://img.shields.io/badge/-Express-000000?style=flat-square&logo=express&logoColor=white" /></a>
<a href="https://www.prisma.io/"><img src="https://img.shields.io/badge/-Prisma-2D3748?style=flat-square&logo=prisma&logoColor=white" /></a>
<a href="https://www.postgresql.org/"><img src="https://img.shields.io/badge/-PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white" /></a>
<a href="https://www.npmjs.com/package/@leechanyong/ispark-ui"><img src="https://img.shields.io/badge/-ispark--ui-6366f1?style=flat-square" /></a>
</p>

---

ispark-ui 디자인 시스템의 실제 적용 사례입니다.  
프론트엔드부터 백엔드, DB 설계까지 풀스택으로 구현했습니다.

### Demo

🔗 **[ispark-task.up.railway.app](https://ispark-task.up.railway.app/)**

> **테스트 계정** — ID: `test` / PW: `test`

### Features

| | |
|---|---|
| **프로젝트 관리** | 생성·수정·삭제·상태 관리 (CRUD) |
| **태스크 보드** | 칸반 스타일 드래그 앤 드롭 |
| **JWT 인증** | Access + Refresh 토큰 기반 |
| **역할 기반 권한** | 관리자 / 멤버 분리 |
| **ispark-ui** | 디자인 시스템 컴포넌트 실전 적용 |

### Structure

```
├── frontend/           # Vue 3 + Vite + Pinia
│   ├── src/views/      # 페이지
│   └── src/components/ # 컴포넌트
├── backend/            # Express + Prisma
│   ├── src/routes/     # API
│   └── prisma/         # 스키마
└── docker-compose.yml
```

### Setup

```bash
# Frontend
cd frontend && npm install && npm run dev

# Backend
cd backend && npm install && npm run dev
```

---

<sub>Built by <a href="https://github.com/box3101">@box3101</a> · 이찬용</sub>
