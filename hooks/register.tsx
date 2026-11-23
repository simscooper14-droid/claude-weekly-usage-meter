import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, SessionRateLimit } from 'claude-code'

type Engine = EngineInterface

import type { Reading } from '../types'

const weekly = atom({ plugin: 'weekly-usage-meter', key: 'weekly' } as const, null)
const isHidden = atom({ plugin: 'weekly-usage-meter', key: 'isHidden' } as const, false)
const STORE_KEY = 'lastWeekly'
const WIDTH = 20

// Fallback reset: Sunday 7 PM America/Chicago (used only when the API gives no resetsAt).
function nextSundayReset(now: number): number {
  const offsetHours = chicagoOffset(now)
  const local = new Date(now + offsetHours * 3600_000)
  const target = new Date(local)
  target.setUTCHours(19, 0, 0, 0)
  target.setUTCDate(local.getUTCDate() + ((7 - local.getUTCDay()) % 7))
  if (target.getTime() <= local.getTime()) target.setUTCDate(target.getUTCDate() + 7)
  return target.getTime() - offsetHours * 3600_000
}

function chicagoOffset(now: number): number {
  try {
    const name = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', timeZoneName: 'short' })
      .formatToParts(new Date(now)).find(p => p.type === 'timeZoneName')?.value
    return name === 'CDT' ? -5 : -6
  } catch {
    return -6
  }
}

function untilText(ms: number): string {
  if (ms <= 0) return 'resetting now'
  const h = Math.floor(ms / 3600_000)
  const d = Math.floor(h / 24)
  return d > 0 ? `resets in ${d}d ${h % 24}h` : `resets in ${h}h ${Math.floor((ms % 3600_000) / 60_000)}m`
}

function bar(percent: number): string {
  const filled = Math.max(0, Math.min(WIDTH, Math.round((percent / 100) * WIDTH)))
  return '█'.repeat(filled) + '░'.repeat(WIDTH - filled)
}

function color(percent: number): string {
  return percent >= 90 ? 'red' : percent >= 75 ? 'yellow' : 'green'
}

function summary(r: Reading | null, now: number): string {
  const resetMs = (r?.resetsAt ? Date.parse(r.resetsAt) : NaN) || nextSundayReset(now)
  const until = untilText(resetMs - now)
  if (!r) return `Week ${bar(0)} no reading yet · ${until}`
  const stale = now - r.seenAt > 6 * 3600_000 ? ' (last seen)' : ''
  return `Week ${bar(r.percent)} ${r.percent}%${stale} · ${until}`
}

async function take($: Engine, limits: SessionRateLimit[]) {
  const seven = limits.find(l => l.kind === 'seven_day')
  const now = await $.clock.now()
  if (seven) {
    const r: Reading = { percent: seven.percentUsed, resetsAt: seven.resetsAt, seenAt: now }
    const prev = await read($, weekly)
    await update($, weekly, () => r)
    await $.store.set(STORE_KEY, r)
    if (prev && prev.percent < 90 && r.percent >= 90) $.ui.toast(`Weekly Claude usage is at ${r.percent}%`)
  }
  $.ui.status(summary(await read($, weekly), now))
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    const saved = (await $.store.get(STORE_KEY)) as Reading | undefined
    if (saved && typeof saved.percent === 'number' && !(await read($, weekly))) {
      await update($, weekly, () => saved)
    }
    await take($, (await $.session.usage()).rateLimits)
    return result
  })

  on('session.measure', async ($, e, next) => {
    if (e.changed.includes('rateLimits')) await take($, e.rateLimits)
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || (await read($, isHidden))) return next(e)
    const r = await read($, weekly)
    const now = await $.clock.now()
    const { Box, Button, Text } = $.ui.resolve(e)
    return (
      <Box>
        <Text color={r ? color(r.percent) : undefined} dimColor={!r}>
          {summary(r, now)}{' '}
        </Text>
        <Button key="hide" label="Hide" onPress={() => update($, isHidden, () => true)} />
      </Box>
    )
  })
}
