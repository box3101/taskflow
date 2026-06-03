import { Router } from 'express'
import jwt from 'jsonwebtoken'
import { authenticate } from '../middleware/auth'
import type { AuthUser } from '../middleware/auth'
import prisma from '../prisma'

const router = Router()

// Guard 설정 조회 (카카오 연동 상태만)
router.get('/guard/settings', authenticate, async (req, res) => {
  try {
    const userId = req.user!.id

    const kakaoToken = await prisma.kakaoToken.findUnique({
      where: { userId },
      select: { id: true, expiresAt: true },
    })

    res.json({
      kakaoLinked: !!kakaoToken,
      kakaoExpiresAt: kakaoToken?.expiresAt ?? null,
    })
  } catch (e) {
    console.error('[stock-guard] settings GET 실패:', e)
    res.status(500).json({ message: '서버 오류' })
  }
})

// 카카오 OAuth 인가 → 카카오 로그인 페이지로 리다이렉트
// NOTE: Uses query param ?token= instead of Authorization header
// because browser redirect (window.location.href) can't send headers
router.get('/guard/kakao/auth', (req, res) => {
  const kakaoKey = process.env.KAKAO_REST_API_KEY
  const redirectUri = process.env.KAKAO_REDIRECT_URI
  if (!kakaoKey || !redirectUri) {
    res.status(500).json({ message: '카카오 API 키가 설정되지 않았습니다.' })
    return
  }

  // 쿼리에서 JWT 토큰 검증
  const token = req.query.token as string
  if (!token) {
    res.status(401).json({ message: '인증 토큰이 필요합니다.' })
    return
  }

  const secret = process.env.JWT_SECRET || 'taskflow-dev-secret'
  let user: AuthUser
  try {
    user = jwt.verify(token, secret) as AuthUser
  } catch {
    res.status(401).json({ message: '유효하지 않은 토큰입니다.' })
    return
  }

  const state = Buffer.from(JSON.stringify({ userId: user.id })).toString('base64')
  const url = `https://kauth.kakao.com/oauth/authorize?client_id=${kakaoKey}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=talk_message&state=${state}`
  res.redirect(url)
})

// 카카오 OAuth 콜백 — 토큰 교환 후 DB 저장
router.get('/guard/kakao/callback', async (req, res) => {
  try {
    const { code, state } = req.query as { code: string; state: string }

    if (!code || !state) {
      res.status(400).json({ message: '인가 코드가 없습니다.' })
      return
    }

    const { userId } = JSON.parse(Buffer.from(state, 'base64').toString())

    const kakaoKey = process.env.KAKAO_REST_API_KEY!
    const redirectUri = process.env.KAKAO_REDIRECT_URI!

    const tokenRes = await fetch('https://kauth.kakao.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: kakaoKey,
        redirect_uri: redirectUri,
        code,
      }),
    })

    const tokenData = await tokenRes.json()

    if (tokenData.error) {
      console.error('[kakao] 토큰 교환 실패:', tokenData)
      res.status(400).json({ message: `카카오 인증 실패: ${tokenData.error_description}` })
      return
    }

    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000)

    await prisma.kakaoToken.upsert({
      where: { userId },
      create: {
        userId,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt,
      },
      update: {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt,
      },
    })

    const frontUrl = process.env.TASKFLOW_URL || 'http://localhost:5173'
    res.redirect(`${frontUrl}/stock?kakao=linked`)
  } catch (e) {
    console.error('[kakao] 콜백 처리 실패:', e)
    res.status(500).json({ message: '카카오 연동 실패' })
  }
})

// 카카오 연동 해제
router.delete('/guard/kakao', authenticate, async (req, res) => {
  try {
    const userId = req.user!.id
    await prisma.kakaoToken.deleteMany({ where: { userId } })
    res.json({ message: '카카오 연동이 해제되었습니다.' })
  } catch (e) {
    console.error('[kakao] 연동 해제 실패:', e)
    res.status(500).json({ message: '서버 오류' })
  }
})

export default router
