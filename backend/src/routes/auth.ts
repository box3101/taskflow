import { Router } from 'express'
import bcrypt from 'bcryptjs'
import prisma from '../prisma'
import { signToken } from '../middleware/auth'

const router = Router()

// 회원가입
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body

    // 이메일 중복 확인
    const exists = await prisma.user.findUnique({ where: { email } })
    if (exists) {
      res.status(409).json({ message: '이미 등록된 이메일입니다.' })
      return
    }

    const hashed = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({
      data: { email, password: hashed, name },
      select: { id: true, email: true, name: true, role: true },
    })

    const token = signToken({ id: user.id, email: user.email, role: user.role })
    res.status(201).json({ user, token })
  } catch (err) {
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

// 로그인
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      res.status(401).json({ message: '이메일 또는 비밀번호가 틀렸습니다.' })
      return
    }

    const valid = await bcrypt.compare(password, user.password)
    if (!valid) {
      res.status(401).json({ message: '이메일 또는 비밀번호가 틀렸습니다.' })
      return
    }

    const token = signToken({ id: user.id, email: user.email, role: user.role })
    res.json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      token,
    })
  } catch (err) {
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

export default router
