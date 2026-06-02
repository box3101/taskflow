import { Router } from 'express'
import { authenticate } from '../middleware/auth'
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

export default router
