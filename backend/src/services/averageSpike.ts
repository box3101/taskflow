import { execFile } from 'node:child_process'
import path from 'node:path'
import { promisify } from 'node:util'
import { cloudMode, cloudSpikeDashboard } from './spikeCloud'

const exec = promisify(execFile)
let cached: { at: number; data: unknown; root: string } | undefined
let pending: Promise<unknown> | undefined

export function spikeOwner() {
  const id = Number(process.env.AVERAGE_SPIKE_OWNER_ID || process.env.FLOW_AUTO_USER_ID)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

export async function averageSpike() {
  if (cloudMode()) return cloudSpikeDashboard()
  const root = process.env.AVERAGE_ROOT
  if (!root) throw new Error('AVERAGE_NOT_CONFIGURED')
  if (cached?.root === root && Date.now() - cached.at < 15_000) return cached.data
  if (pending) return pending
  // Root is server configuration, never a client-supplied path. No shell or trading process.
  pending = exec(process.env.PYTHON_BIN || 'python', [path.resolve(process.cwd(), 'scripts/read-average-spike.py'), root], {
    timeout: 15_000, maxBuffer: 12 * 1024 * 1024, windowsHide: true,
  }).then(({ stdout }) => {
    const data = JSON.parse(stdout)
    if (!Array.isArray(data?.spike?.days) || !data?.spike?.rule) throw new Error('INVALID_SPIKE_DATA')
    cached = { at: Date.now(), data, root }
    return data
  }).finally(() => { pending = undefined })
  return pending
}
