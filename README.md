<div align="center">

# TaskFlow

**ispark-ui 디자인 시스템으로 만든 풀스택 프로젝트 관리 앱**

[![Vue3](https://img.shields.io/badge/Vue_3-4FC08D?style=flat-square&logo=vue.js&logoColor=white)](https://vuejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://typescriptlang.org/)
[![Express](https://img.shields.io/badge/Express-000000?style=flat-square&logo=express&logoColor=white)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org/)

</div>

---

## Overview

ispark-ui 디자인 시스템의 실제 적용 사례로 만든 프로젝트 관리 앱입니다.  
프론트엔드부터 백엔드, DB 설계까지 풀스택으로 구현했습니다.

## Tech Stack

| 영역 | 기술 |
|------|------|
| **Frontend** | Vue 3 + TypeScript + Vite |
| **State** | Pinia |
| **Backend** | Express + Prisma |
| **Database** | PostgreSQL (Railway) |
| **Auth** | JWT (Access + Refresh) |
| **UI** | [@leechanyong/ispark-ui](https://www.npmjs.com/package/@leechanyong/ispark-ui) |
| **Deploy** | Vercel (Frontend) + Railway (Backend) |

## Key Features

- **프로젝트 관리** — 생성, 수정, 삭제, 상태 관리
- **칸반 보드** — 드래그 앤 드롭 작업 관리
- **JWT 인증** — Access/Refresh 토큰 기반 보안
- **역할 기반 권한** — 관리자/멤버 권한 분리
- **디자인 시스템** — ispark-ui 컴포넌트 실전 적용

## Project Structure

```
├── frontend/
│   ├── src/views/        # 페이지 컴포넌트
│   ├── src/components/   # 재사용 컴포넌트
│   └── src/stores/       # Pinia 상태 관리
├── backend/
│   ├── src/routes/       # API 라우트
│   ├── src/prisma.ts     # DB 클라이언트
│   └── prisma/schema.prisma
└── docker-compose.yml
```

## Getting Started

```bash
# Frontend
cd frontend && npm install && npm run dev

# Backend
cd backend && npm install && npm run dev
```

## Links

- **Live** — [ispark-task.up.railway.app](https://ispark-task.up.railway.app/)

---

<div align="center">
  <sub>Built by <a href="https://github.com/box3101">@box3101</a></sub>
</div>
