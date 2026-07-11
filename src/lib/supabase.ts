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

/** Who's signed in right now, read straight from the live session. */
export interface Account {
  /** null on a fully local device or a signed-out one. */
  email: string | null
  /** True for the no-UI anonymous bridge; false for a real, named account. */
  anonymous: boolean
}

export async function currentAccount(): Promise<Account | null> {
  if (!supabase) return null
  try {
    const { data } = await supabase.auth.getSession()
    const user = data.session?.user
    if (!user) return { email: null, anonymous: false }
    return { email: user.email ?? null, anonymous: user.is_anonymous ?? !user.email }
  } catch {
    return null
  }
}

/**
 * A real, named sign-in — set up manually for now (Supabase dashboard:
 * Authentication → Users → Add user, with "Auto Confirm User" on). Replaces
 * whatever session was active, anonymous or not; the caller is responsible
 * for recovering that account's backed-up nights afterward.
 */
export async function signInWithPassword(
  email: string,
  password: string,
): Promise<{ userId: string | null; error: string | null }> {
  if (!supabase) return { userId: null, error: 'Backup isn’t configured.' }
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { userId: null, error: 'That email and password don’t match.' }
    return { userId: data.user?.id ?? null, error: null }
  } catch {
    return { userId: null, error: 'Couldn’t reach the server. Try again in a moment.' }
  }
}

export async function signOut(): Promise<void> {
  if (!supabase) return
  try {
    await supabase.auth.signOut()
  } catch {
    /* the local session clears client-side regardless */
  }
}
