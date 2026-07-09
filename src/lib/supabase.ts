import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** Null when Supabase isn't configured — the app then runs local-only. */
export const supabase: SupabaseClient | null =
  url && key && !url.includes('YOUR-PROJECT') ? createClient(url, key) : null

export const cloudEnabled = (): boolean => supabase !== null
