import { Capacitor } from '@capacitor/core'

/*
 * The stone's pulse. While the film develops under the user's finger, a soft
 * rhythmic haptic runs — the evolution felt, not just seen. Native builds get
 * real haptics via Capacitor; the web PWA gets navigator.vibrate where the
 * platform allows it; everywhere else this degrades to silence, never an error.
 */

let timer: number | null = null

async function pulseOnce(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      const { Haptics, ImpactStyle } = await import('@capacitor/haptics')
      await Haptics.impact({ style: ImpactStyle.Light })
      return
    } catch { /* fall through to the web path */ }
  }
  try { navigator.vibrate?.(24) } catch { /* not supported — fine */ }
}

/** The ongoing development pulse — a soft beat while the stone changes. */
export function startDevelopPulse(): void {
  stopDevelopPulse()
  void pulseOnce()
  timer = window.setInterval(() => void pulseOnce(), 170)
}

export function stopDevelopPulse(): void {
  if (timer !== null) {
    clearInterval(timer)
    timer = null
  }
  try { navigator.vibrate?.(0) } catch { /* not supported — fine */ }
}

/** One quiet tap — the stone is settled, nothing new tonight. */
export function settledPulse(): void {
  void pulseOnce()
}
