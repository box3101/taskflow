import express from 'express'
import cors from 'cors'
import authRouter from './routes/auth'
import projectRouter from './routes/projects'
import issueRouter from './routes/issues'

const app = express()

app.use(cors({ origin: 'http://localhost:5173' }))
app.use(express.json())

// 라우터
app.use('/auth', authRouter)
app.use('/projects', projectRouter)
app.use('/issues', issueRouter)

// 헬스체크
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

const PORT = process.env.PORT || 4000
app.listen(PORT, () => {
  console.log(`서버 실행: http://localhost:${PORT}`)
})
