const trimEnv = (value?: string) => value?.trim() || '';
const normalizeSupabaseUrl = (value?: string) =>
  trimEnv(value)
    .replace(/\/rest\/v1\/?$/i, '')
    .replace(/\/+$/, '');

export const env = {
  supabaseUrl: normalizeSupabaseUrl(process.env.EXPO_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: trimEnv(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY),
};

export const isSupabaseConfigured = Boolean(env.supabaseUrl && env.supabaseAnonKey);
