import { Router } from 'express'
import jwt from 'jsonwebtoken'
import { authenticate } from '../middleware/auth'
import type { AuthUser } from '../middleware/auth'
import prisma from '../prisma'

const router = Router()

// 기본 윈도우
const DEFAULT_WINDOWS = [
  { open: '09:05', close: '13:00' },
  { open: '13:00', close: '15:35' },
  { open: '15:35', close: '16:00' },
]

interface TimeWindow {
  open: string  // 'HH:mm'
  close: string // 'HH:mm'
}

// HH:mm 문자열을 오늘 날짜의 분 단위로 변환
function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

// 현재 KST 시간의 분 단위
function nowKSTMinutes(): number {
  const now = new Date()
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  return kst.getUTCHours() * 60 + kst.getUTCMinutes()
}

// 현재 KST 요일 (0=일, 6=토)
function nowKSTDay(): number {
  const now = new Date()
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  return kst.getUTCDay()
}

// Guard 상태 조회
router.get('/guard/status', authenticate, async (req, res) => {
  try {
    const userId = req.user!.id

    const setting = await prisma.stockGuardSetting.findUnique({
      where: { userId },
    })

    // 설정이 없거나 비활성화면 항상 접근 가능
    if (!setting || !setting.enabled) {
      res.json({
        enabled: false,
        accessible: true,
        currentWindow: null,
        nextOpenTime: null,
        windows: DEFAULT_WINDOWS,
      })
      return
    }

    const windows: TimeWindow[] = (setting.windows as TimeWindow[]) || DEFAULT_WINDOWS
    const nowMin = nowKSTMinutes()
    const day = nowKSTDay()

    // 주말 체크 (토=6, 일=0)
    const isWeekend = day === 0 || day === 6

    if (isWeekend) {
      res.json({
        enabled: true,
        accessible: false,
        currentWindow: null,
        nextOpenTime: windows[0].open,
        nextOpenDay: 'monday',
        windows,
      })
      return
    }

    // 현재 어느 윈도우에 속하는지 판단
    let currentWindow: number | null = null
    let nextOpenTime: string | null = null

    for (let i = 0; i < windows.length; i++) {
      const openMin = timeToMinutes(windows[i].open)
      const closeMin = timeToMinutes(windows[i].close)
      if (nowMin >= openMin && nowMin < closeMin) {
        currentWindow = i + 1
        break
      }
    }

    if (currentWindow === null) {
      for (const w of windows) {
        if (timeToMinutes(w.open) > nowMin) {
          nextOpenTime = w.open
          break
        }
      }
      if (!nextOpenTime) {
        nextOpenTime = windows[0].open
      }
    }

    res.json({
      enabled: true,
      accessible: currentWindow !== null,
      currentWindow,
      nextOpenTime,
      windows,
    })
  } catch (e) {
    console.error('[stock-guard] status 실패:', e)
    res.status(500).json({ message: '서버 오류' })
  }
})

// Guard 설정 조회
router.get('/guard/settings', authenticate, async (req, res) => {
  try {
    const userId = req.user!.id

    const setting = await prisma.stockGuardSetting.findUnique({
      where: { userId },
    })

    const kakaoToken = await prisma.kakaoToken.findUnique({
      where: { userId },
      select: { id: true, expiresAt: true },
    })

    res.json({
      enabled: setting?.enabled ?? false,
      windows: setting?.windows ?? DEFAULT_WINDOWS,
      kakaoLinked: !!kakaoToken,
      kakaoExpiresAt: kakaoToken?.expiresAt ?? null,
    })
  } catch (e) {
    console.error('[stock-guard] settings GET 실패:', e)
    res.status(500).json({ message: '서버 오류' })
  }
})

// Guard 설정 변경
router.patch('/guard/settings', authenticate, async (req, res) => {
  try {
    const userId = req.user!.id
    const { enabled, windows } = req.body

    const data: any = {}
    if (typeof enabled === 'boolean') data.enabled = enabled
    if (Array.isArray(windows)) {
      const valid = windows.every(
        (w: any) => /^\d{2}:\d{2}$/.test(w.open) && /^\d{2}:\d{2}$/.test(w.close)
      )
      if (!valid) {
        res.status(400).json({ message: '시간 형식이 올바르지 않습니다. (HH:mm)' })
        return
      }
      data.windows = windows
    }

    const setting = await prisma.stockGuardSetting.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    })

    res.json(setting)
  } catch (e) {
    console.error('[stock-guard] settings PATCH 실패:', e)
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

    await prisma.stockGuardSetting.upsert({
      where: { userId },
      create: { userId, enabled: true },
      update: {},
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
