import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { averageSpike, spikeOwner } from '../services/averageSpike'

const router = Router()
router.use(authenticate)
router.get('/', async (req, res) => {
  const owner = spikeOwner()
  if (!owner) { res.status(503).json({ message: '급등 기록 연결이 아직 설정되지 않았습니다.' }); return }
  if (req.user!.id !== owner) { res.status(403).json({ message: '연결된 급등 기록의 소유자만 조회할 수 있습니다.' }); return }
  try { res.set('Cache-Control', 'no-store').json({ data: await averageSpike() }) }
  catch { res.status(503).json({ message: 'Average 급등 기록에 연결할 수 없습니다. 원본 데이터와 서버 연결 설정을 확인하세요.' }) }
})
export default router
