export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

// Acepta la publishable key nueva (sb_publishable_...) o la anon key legacy.
export const SUPABASE_KEY = (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!;
