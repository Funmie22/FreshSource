import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

if (!isSupabaseConfigured) {
  console.warn('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env for data features.')
}

const makeNoopSupabaseClient = () => {
  const errorMessage = 'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env to enable authentication.'
  const noopSubscription = { unsubscribe: () => {} }

  return {
    auth: {
      getUser: async () => ({ data: { user: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: noopSubscription } }),
      signInWithPassword: async () => ({ data: null, error: { message: errorMessage } }),
      signUp: async () => ({ data: null, error: { message: errorMessage } }),
      resetPasswordForEmail: async () => ({ data: null, error: { message: errorMessage } }),
      signOut: async () => ({ error: null }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: null }),
          single: async () => ({ data: null, error: null }),
        }),
      }),
      insert: async () => ({ data: null, error: { message: errorMessage } }),
      update: async () => ({ data: null, error: { message: errorMessage } }),
      delete: () => ({ eq: async () => ({ data: null, error: { message: errorMessage } }) }),
    }),
    removeChannel: () => {},
    channel: () => ({
      on: () => ({ subscribe: () => ({ data: { subscription: noopSubscription } }) }),
    }),
  }
}

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : makeNoopSupabaseClient()