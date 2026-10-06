// Monetary values are won. Strategy configuration is frozen with every day state.
const number = (key: string, fallback: number, min = 0) => {
  const raw = process.env[key]
  const value = raw ? Number(raw) : fallback
  if (!Number.isFinite(value) || value < min) throw new Error(`INVALID_${key}`)
  return value
}
export function surgeConfig() {
  return {
    version: process.env.SURGE_CHECKLIST === 'false' ? 'surge-rotation-v1' : 'surge-rotation-v2-checklist', gateWon: number('SURGE_GATE_WON', 10_000_000_000),
    // Checklist: hot theme, last-minute turnover, near the N-day daily high, prior leading surges.
    checklist: process.env.SURGE_CHECKLIST !== 'false', minuteGateWon: number('SURGE_MINUTE_GATE_WON', 5_000_000_000),
    nearHighPct: number('SURGE_NEAR_HIGH_PCT', 2), leaderMin: number('SURGE_LEADER_MIN', 1),
    stableMs: number('SURGE_STABLE_SECONDS', 180, 1) * 1000,
    topThemes: number('SURGE_TOP_THEMES', 3, 1), maxEntries: number('SURGE_MAX_ENTRIES', 3, 1),
    start: process.env.SURGE_START || '09:05:00', end: process.env.SURGE_ENTRY_END || '15:20:00',
    close: process.env.SURGE_CLOSE || '15:30:00', stopPct: number('SURGE_STOP_PCT', 3),
    costPct: number('SURGE_COST_PCT', 0.21), gapMs: number('SURGE_MAX_GAP_SECONDS', 30, 1) * 1000,
    quoteAgeMs: number('SURGE_QUOTE_AGE_SECONDS', 90, 1) * 1000,
    executionAgeMs: number('SURGE_EXECUTION_AGE_SECONDS', 20, 1) * 1000,
    broadMs: number('SURGE_BROAD_SECONDS', 60, 10) * 1000,
    hotLimit: number('SURGE_HOT_LIMIT', 60, 1), intervalSeconds: number('SURGE_INTERVAL_SECONDS', 10, 1),
    limitPct: number('SURGE_LIMIT_PCT', 29.5), singleton: process.env.SURGE_SINGLETON !== 'false',
    comparisonGates: (process.env.SURGE_COMPARISON_GATES || '50000000000,100000000000').split(',').filter(Boolean).map(v => {
      const n = Number(v); if (!(n > 0)) throw new Error('INVALID_SURGE_COMPARISON_GATES'); return n
    }),
  }
}
export type SurgeConfig = ReturnType<typeof surgeConfig>
export const variantId = (gate: number, seconds: number) => `GATE_${gate}_LEADER_STABLE_${seconds}`
export function notificationConfig() {
  const config = surgeConfig()
  return { enabled: process.env.NOTIFY_ENABLED === 'true', token: process.env.TELEGRAM_BOT_TOKEN,
    chatId: process.env.TELEGRAM_CHAT_ID, variant: process.env.SURGE_NOTIFY_VARIANT || variantId(config.gateWon, config.stableMs / 1000),
    stop: process.env.SURGE_NOTIFY_STOP === 'true', close: process.env.SURGE_NOTIFY_CLOSE === 'true',
    maxAttempts: 2, backoffMs: number('SURGE_NOTIFY_BACKOFF_MS', 1000, 1),
    maxAgeMs: number('SURGE_NOTIFY_MAX_AGE_SECONDS', 300, 1) * 1000 }
}
