export type Reading = { percent: number; resetsAt?: string; seenAt: number }

declare module 'claude-code' {
  interface PluginState {
    'weekly-usage-meter': { weekly: Reading | null; isHidden: boolean }
  }
}
