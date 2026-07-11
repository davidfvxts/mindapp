/*
 * Analytics — the privacy contract, enforced in the type system.
 *
 * Facet counts THAT things happened, never WHAT was written (CLAUDE.md §6):
 * an event is a name from the closed list below plus a random device id.
 * No reflection content, no settings, no profile, no Night numbers beyond
 * what the event name itself encodes, no auth account — the device id is a
 * coin flip stored locally, tied to nothing.
 *
 * Events queue locally and flush opportunistically; a device that never
 * comes online simply never reports. Unconfigured builds are a no-op.
 * These ten-ish counters are exactly what the pilot needs to read D1/D7/D30.
 */

export const EVENTS = [
  'onboarding_started',
  'first_entry_saved',
  'first_read_viewed',
  'setup_completed',
  'entry_saved',
  'return_next_day',
  'return_after_lapse',
  'night_7',
  'night_30',
  'stone_pressed',
  'weekly_review_started',
  'weekly_review_completed',
  'monthly_arc_completed',
] as const
export type EventName = (typeof EVENTS)[number]

const QUEUE_KEY = 'facet.events.v1'
const DEVICE_KEY = 'facet.device.v1'
const QUEUE_CAP = 200

export interface QueuedEvent {
  name: EventName
  /** Client timestamp — server assigns its own on insert; this orders retries. */
  ts: number
}

/** Pure: append bounded — the oldest events fall off, telemetry never grows unbounded. */
export function pushEvent(queue: QueuedEvent[], evt: QueuedEvent, cap = QUEUE_CAP): QueuedEvent[] {
  const next = [...queue, evt]
  return next.length > cap ? next.slice(next.length - cap) : next
}

const storage = (): Storage | null => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

function deviceId(): string {
  const s = storage()
  if (!s) return 'ephemeral'
  let id = s.getItem(DEVICE_KEY)
  if (!id) {
    id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`
    s.setItem(DEVICE_KEY, id)
  }
  return id
}

const readQueue = (): QueuedEvent[] => {
  try {
    return JSON.parse(storage()?.getItem(QUEUE_KEY) ?? '[]') as QueuedEvent[]
  } catch {
    return []
  }
}
const writeQueue = (q: QueuedEvent[]): void => {
  try {
    storage()?.setItem(QUEUE_KEY, JSON.stringify(q))
  } catch {
    /* full or blocked — drop silently, never break the app */
  }
}

let flushing = false

/** Push whatever has gathered. Safe to call any time; no-op offline/unconfigured. */
export async function flushEvents(): Promise<void> {
  if (flushing) return
  flushing = true
  try {
    // Lazy: keeps this module dependency-free for the pure queue logic.
    const { supabase } = await import('./supabase')
    if (!supabase) return
    const device = deviceId()
    // Drain in rounds: events tracked while an insert is in flight land after
    // our snapshot, survive it, and go out in the next round. Bounded.
    for (let round = 0; round < 5; round++) {
      const queue = readQueue()
      if (!queue.length) return
      const rows = queue.map((e) => ({ device, name: e.name }))
      const { error } = await supabase.from('events').insert(rows)
      if (error) return // stays queued for the next flush
      writeQueue(readQueue().slice(queue.length))
    }
  } catch {
    /* stays queued for the next flush */
  } finally {
    flushing = false
  }
}

/** Count that something happened. Fire-and-forget; content can't get in. */
export function track(name: EventName): void {
  writeQueue(pushEvent(readQueue(), { name, ts: Date.now() }))
  void flushEvents()
}

// Whatever queued offline goes out the moment connectivity returns.
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => void flushEvents())
}
