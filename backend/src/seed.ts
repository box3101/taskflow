import 'dotenv/config'
import bcrypt from 'bcryptjs'
import prisma from './prisma'

async function main() {
  // 기존 데이터 정리
  await prisma.issue.deleteMany()
  await prisma.member.deleteMany()
  await prisma.project.deleteMany()
  await prisma.user.deleteMany()

  // 사용자 생성
  const password = await bcrypt.hash('1234', 10)

  const chanyong = await prisma.user.create({
    data: { email: 'chanyong@test.com', password, name: '이찬용', role: 'admin' },
  })
  const hyunji = await prisma.user.create({
    data: { email: 'hyunji@test.com', password, name: '현지', role: 'member' },
  })

  // 프로젝트 생성
  const project = await prisma.project.create({
    data: {
      name: 'TaskFlow MVP',
      description: '프로젝트 관리 앱 MVP 개발',
      status: 'active',
      members: {
        create: [
          { userId: chanyong.id, role: 'owner' },
          { userId: hyunji.id, role: 'dev' },
        ],
      },
      issues: {
        create: [
          { title: 'DB 스키마 설계', status: 'done', priority: 'high', assigneeId: chanyong.id },
          { title: 'JWT 인증 구현', status: 'doing', priority: 'high', assigneeId: chanyong.id },
          { title: '로그인 화면 퍼블', status: 'doing', priority: 'high', assigneeId: hyunji.id },
          { title: '프로젝트 목록 페이지', status: 'todo', priority: 'mid', assigneeId: hyunji.id },
          { title: '이슈 CRUD API', status: 'todo', priority: 'mid', assigneeId: chanyong.id },
          { title: '배포 설정', status: 'todo', priority: 'low' },
        ],
      },
    },
  })

  console.log(`시드 완료: 사용자 2명, 프로젝트 1개, 이슈 6개`)
  console.log(`로그인: chanyong@test.com / 1234`)
  console.log(`로그인: hyunji@test.com / 1234`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
