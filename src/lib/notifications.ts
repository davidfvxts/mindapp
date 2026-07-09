import { Capacitor } from '@capacitor/core'

const REMINDER_ID = 1001

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
  if (!Capacitor.isNativePlatform()) return

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
          body: cue ? `After you ${cue} — five minutes.` : 'Five minutes.',
          schedule: { on: { hour, minute }, allowWhileIdle: true },
        },
      ],
    })
  } catch (err) {
    console.warn('[mira] could not schedule reminder:', err)
  }
}

export async function cancelDailyReminder(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    await LocalNotifications.cancel({ notifications: [{ id: REMINDER_ID }] })
  } catch {
    /* no-op */
  }
}
