/**
 * Facet — the draft layer. Words are never lost.
 *
 * Every writing surface persists its in-progress text here on each change
 * (debounced), restores it silently on return, and clears it on submit.
 * A refresh, a tab switch, or a mobile OS evicting the page costs nothing.
 *
 * Best-effort by design: a full or blocked localStorage must never break
 * the ritual — the real save path (the entry itself) is elsewhere.
 */

const PREFIX = 'facet.draft.'

const timers: Record<string, ReturnType<typeof setTimeout>> = {}

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

export function loadDraft<T>(key: string): T | null {
  const s = storage()
  if (!s) return null
  try {
    const raw = s.getItem(PREFIX + key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

/** Persist a draft, debounced per key so typing doesn't hammer storage. */
export function saveDraft(key: string, value: unknown, delay = 400): void {
  const t = timers[key]
  if (t) clearTimeout(t)
  timers[key] = setTimeout(() => {
    delete timers[key]
    const s = storage()
    if (!s) return
    try {
      s.setItem(PREFIX + key, JSON.stringify(value))
    } catch {
      /* best-effort */
    }
  }, delay)
}

export function clearDraft(key: string): void {
  const t = timers[key]
  if (t) {
    clearTimeout(t)
    delete timers[key]
  }
  const s = storage()
  if (!s) return
  try {
    s.removeItem(PREFIX + key)
  } catch {
    /* best-effort */
  }
}

/** Wipe every draft — part of "erase everything", nothing else. */
export function clearAllDrafts(): void {
  for (const k of Object.keys(timers)) {
    clearTimeout(timers[k])
    delete timers[k]
  }
  const s = storage()
  if (!s) return
  try {
    const doomed: string[] = []
    for (let i = 0; i < s.length; i++) {
      const k = s.key(i)
      if (k?.startsWith(PREFIX)) doomed.push(k)
    }
    for (const k of doomed) s.removeItem(k)
  } catch {
    /* best-effort */
  }
}

/** True when a restored draft carries any real text worth mentioning. */
export function draftHasText(d: Record<string, unknown> | null): boolean {
  if (!d) return false
  return Object.values(d).some((v) => typeof v === 'string' && v.trim().length > 0)
}
