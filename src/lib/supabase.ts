import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** The anon/publishable key, also used as the fallback bearer for the Coach function. */
export const anonKey: string | undefined =
  key && !key.includes('your-anon') ? key : undefined

/** Null when Supabase isn't configured — the app then runs local-only. */
export const supabase: SupabaseClient | null =
  url && anonKey && !url.includes('YOUR-PROJECT')
    ? createClient(url, anonKey, {
        auth: { persistSession: true, autoRefreshToken: true },
      })
    : null

export const cloudEnabled = (): boolean => supabase !== null

/**
 * Give this device an identity so its reflections can sync under Row-Level
 * Security — without making the user sign in. Anonymous sign-in is the
 * no-UI bridge until magic-link auth ships; a later real sign-in can be
 * linked to this anonymous user, carrying the history over.
 *
 * Safe to call repeatedly: it no-ops once a session exists. Never throws —
 * a failure here must not block a local reflection.
 */
export async function ensureSession(): Promise<string | null> {
  if (!supabase) return null
  try {
    const { data } = await supabase.auth.getSession()
    if (data.session?.user) return data.session.user.id
    const { data: signed, error } = await supabase.auth.signInAnonymously()
    if (error) {
      console.warn('[facet] anonymous sign-in unavailable, staying local:', error.message)
      return null
    }
    return signed.user?.id ?? null
  } catch (err) {
    console.warn('[facet] session check failed, staying local:', err)
    return null
  }
}
