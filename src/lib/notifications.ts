import { Capacitor } from '@capacitor/core'
import { secondPerson } from './onboarding'

const REMINDER_ID = 1001

// ---- web: best-effort, honestly limited ----------------------------------
// Browsers cannot schedule a notification for a closed page (no push server
// here, by design). What a PWA pilot CAN have: with permission granted, an
// in-page timer fires the notification when its time arrives while the app
// is open or parked in a background tab. Native builds get the real thing.

const webTimers = new Map<string, number>()

const clearWebTimer = (key: string): void => {
  const t = webTimers.get(key)
  if (t !== undefined) {
    clearTimeout(t)
    webTimers.delete(key)
  }
}

async function webPermission(): Promise<boolean> {
  if (typeof Notification === 'undefined') return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  try {
    return (await Notification.requestPermission()) === 'granted'
  } catch {
    return false
  }
}

async function showWebNotification(key: string, title: string, body: string): Promise<void> {
  try {
    // Android requires the service-worker path; the PWA registers one.
    const reg = await navigator.serviceWorker?.getRegistration()
    if (reg) await reg.showNotification(title, { body, tag: key })
    else new Notification(title, { body, tag: key })
  } catch {
    /* best effort only */
  }
}

/** The next wall-clock occurrence of HH:MM, today or tomorrow. */
const nextOccurrence = (time: string): Date => {
  const [hour, minute] = time.split(':').map(Number)
  const at = new Date()
  at.setHours(hour, minute, 0, 0)
  if (at.getTime() <= Date.now()) at.setDate(at.getDate() + 1)
  return at
}

function armWebTimer(key: string, time: string, title: string, body: string, daily: boolean): void {
  clearWebTimer(key)
  const delay = nextOccurrence(time).getTime() - Date.now()
  webTimers.set(
    key,
    window.setTimeout(() => {
      void showWebNotification(key, title, body)
      if (daily) armWebTimer(key, time, title, body, true)
      else webTimers.delete(key)
    }, delay),
  )
}

/**
 * The daily reminder is the implementation-intention cue (Gollwitzer) —
 * the single mechanism that turns this from an app into a habit. It fires
 * at the user's chosen time, on-device.
 *
 * Deliberately a LOCAL notification, not a push:
 *   - no APNs certificates, no server, no backend dependency
 *   - fires offline
 *   - nothing about the user's reflections leaves the device
 *
 * On the web this degrades to a no-op (Notification scheduling isn't
 * reliable in browsers); native builds get the real thing.
 */
export async function scheduleDailyReminder(time: string, cue: string): Promise<void> {
  const body = cue ? `After you ${secondPerson(cue)} — five minutes.` : 'Five minutes.'
  if (!Capacitor.isNativePlatform()) {
    // Web pilot: while the app is open (or parked in a tab), the cue still fires.
    if (await webPermission()) armWebTimer('reminder', time, 'Time to reflect', body, true)
    return
  }

  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')

    const perm = await LocalNotifications.requestPermissions()
    if (perm.display !== 'granted') return

    await LocalNotifications.cancel({ notifications: [{ id: REMINDER_ID }] })

    const [hour, minute] = time.split(':').map(Number)

    await LocalNotifications.schedule({
      notifications: [
        {
          id: REMINDER_ID,
          title: 'Time to reflect',
          body,
          schedule: { on: { hour, minute }, allowWhileIdle: true },
        },
      ],
    })
  } catch (err) {
    console.warn('[facet] could not schedule reminder:', err)
  }
}

export async function cancelDailyReminder(): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    clearWebTimer('reminder')
    return
  }
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    await LocalNotifications.cancel({ notifications: [{ id: REMINDER_ID }] })
  } catch {
    /* no-op */
  }
}

const MORNING_ID = 1002

/**
 * The morning note — last night's "one thing I'll do differently", delivered
 * the next morning, at the moment it can actually be acted on (Gollwitzer:
 * cues work at execution time, and 11pm is not it). One-shot, rescheduled
 * after every reflection so the text is always tonight's intention; local,
 * offline, nothing leaves the device. Web: the same best-effort in-page timer
 * as the evening reminder.
 */
export async function scheduleMorningIntention(time: string, intention: string): Promise<void> {
  if (!time || !intention.trim()) return
  if (!Capacitor.isNativePlatform()) {
    if (await webPermission()) armWebTimer('morning', time, 'Today', intention.trim(), false)
    return
  }

  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')

    const perm = await LocalNotifications.requestPermissions()
    if (perm.display !== 'granted') return

    await LocalNotifications.cancel({ notifications: [{ id: MORNING_ID }] })

    const [hour, minute] = time.split(':').map(Number)
    const at = new Date()
    at.setHours(hour, minute, 0, 0)
    // Reflections happen at night; the note belongs to the NEXT occurrence.
    if (at.getTime() <= Date.now()) at.setDate(at.getDate() + 1)

    await LocalNotifications.schedule({
      notifications: [
        {
          id: MORNING_ID,
          title: 'Today',
          body: intention.trim(),
          schedule: { at, allowWhileIdle: true },
        },
      ],
    })
  } catch (err) {
    console.warn('[facet] could not schedule the morning note:', err)
  }
}

export async function cancelMorningIntention(): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    clearWebTimer('morning')
    return
  }
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    await LocalNotifications.cancel({ notifications: [{ id: MORNING_ID }] })
  } catch {
    /* no-op */
  }
}
