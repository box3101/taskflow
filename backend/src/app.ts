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
import skillUpRouter from './routes/skillUp'
import dailyMottoRouter from './routes/dailyMotto'
import calendarRouter from './routes/calendar'
import moodRouter from './routes/moods'
import mealRouter from './routes/meals'
import memoRouter from './routes/memos'
import workoutRouter from './routes/workouts'
import { startStockGuardCron } from './services/stockGuardCron'

const app = express()

app.use(cors({ origin: (origin, cb) => cb(null, true) }))
app.use(express.json())
app.use('/uploads', express.static(path.join(__dirname, '../uploads')))

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
app.use('/skill-up', skillUpRouter)
app.use('/daily-motto', dailyMottoRouter)
app.use('/calendar', calendarRouter)
app.use('/moods', moodRouter)
app.use('/meals', mealRouter)
app.use('/workouts', workoutRouter)
app.use('/memos', memoRouter)

// 헬스체크
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

// 프론트엔드 정적 파일 서빙 (배포 환경)
// 빌드 후 __dirname = backend/dist/src → ../../../frontend/dist
const clientPath = path.join(__dirname, '../../../frontend/dist')
app.use(express.static(clientPath))

// SPA catch-all — API 외 모든 경로를 index.html로 (Express 5 문법)
app.get('{*path}', (_req, res) => {
  res.sendFile(path.join(clientPath, 'index.html'))
})

const PORT = process.env.PORT || 4000
app.listen(PORT, () => {
  console.log(`서버 실행: http://localhost:${PORT}`)
  startStockGuardCron()
})
