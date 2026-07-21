import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'path'
import authRouter from './routes/auth'
import projectRouter from './routes/projects'
import issueRouter from './routes/issues'
import todoRouter from './routes/todos'
import stockRouter from './routes/stock'
import stockGuardRouter from './routes/stockGuard'
import stockNewsRouter from './routes/stockNews'
import aiToolRouter from './routes/aiTools'
import techNoteRouter from './routes/techNotes'
import dailyMottoRouter from './routes/dailyMotto'
import calendarRouter from './routes/calendar'
import moodRouter from './routes/moods'
import mealRouter from './routes/meals'
import memoRouter from './routes/memos'
import tradeLogRouter from './routes/tradeLogs'
import workoutRouter from './routes/workouts'
import marketEventRouter from './routes/marketEvents'
import marketJournalRouter from './routes/marketJournal'
import preferencesRouter from './routes/preferences'
import scoreSnapshotRouter from './routes/scoreSnapshots'
import scorePortfolioRouter from './routes/scorePortfolio'
import movieRouter from './routes/movies'
import { startStockGuardCron } from './services/stockGuardCron'
import { startScoreMaturityCron } from './services/scoreMaturityCron'
import { startSyncMoviesCron } from './services/syncMoviesCron'

const app = express()

import { isR2Configured, getR2Url } from './services/storage'

app.use(cors({ origin: (origin, cb) => cb(null, true) }))
app.use(express.json())

// 파일 서빙: R2 설정 시 리다이렉트, 미설정 시 로컬 디스크
if (isR2Configured()) {
  app.get('/uploads/{*key}', (req, res) => {
    const key = (req.params as Record<string, string>).key
    res.redirect(getR2Url(key))
  })
} else {
  app.use('/uploads', express.static(path.join(__dirname, '../uploads')))
}

// 프론트엔드 정적 파일 경로 (빌드 후 __dirname = backend/dist/src → ../../../frontend/dist)
const clientPath = path.join(__dirname, '../../../frontend/dist')

// 하드 새로고침(브라우저 문서 요청)이 API 경로와 겹치는 프론트 라우트로 들어올 때
// API 라우터가 먼저 잡혀 401 JSON("로그인이 필요합니다.")이 그대로 노출되는 문제 방지.
// → 프론트 라우트면 index.html(SPA) 반환. XHR/API 호출은 Accept에 text/html이 없어 그대로 통과한다.
const FRONTEND_ROUTES = [
  '/', '/login', '/settings', '/main',
  '/projects', '/todos', '/calendar', '/screenings', '/ai-tools', '/memos', '/stock', '/health',
]
app.use((req, res, next) => {
  if (req.method !== 'GET') return next()
  if (!String(req.headers.accept || '').includes('text/html')) return next()
  const isFrontRoute =
    FRONTEND_ROUTES.includes(req.path) || /^\/projects\/[^/]+$/.test(req.path)
  if (isFrontRoute) {
    res.sendFile(path.join(clientPath, 'index.html'))
    return
  }
  next()
})

// API 라우터
app.use('/auth', authRouter)
app.use('/projects', projectRouter)
app.use('/issues', issueRouter)
app.use('/todos', todoRouter)
app.use('/stock', stockRouter)
app.use('/stock', stockGuardRouter)
app.use('/stock-news', stockNewsRouter)
app.use('/ai-tools', aiToolRouter)
app.use('/tech-notes', techNoteRouter)
app.use('/daily-motto', dailyMottoRouter)
app.use('/calendar', calendarRouter)
app.use('/moods', moodRouter)
app.use('/meals', mealRouter)
app.use('/workouts', workoutRouter)
app.use('/memos', memoRouter)
app.use('/trade-logs', tradeLogRouter)
app.use('/market-events', marketEventRouter)
app.use('/market-journal', marketJournalRouter)
app.use('/preferences', preferencesRouter)
app.use('/score-snapshots', scoreSnapshotRouter)
app.use('/score-portfolio', scorePortfolioRouter)
app.use('/movies', movieRouter)

// 헬스체크
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

// 프론트엔드 정적 파일 서빙 (배포 환경)
app.use(express.static(clientPath))

// SPA catch-all — API 외 모든 경로를 index.html로 (Express 5 문법)
app.get('{*path}', (_req, res) => {
  res.sendFile(path.join(clientPath, 'index.html'))
})

const PORT = process.env.PORT || 4000
app.listen(PORT, () => {
  console.log(`서버 실행: http://localhost:${PORT}`)
  startStockGuardCron()
  startScoreMaturityCron()
  startSyncMoviesCron()
})
