import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://uuysjtxxewqchejkllhs.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseAnonKey) {
  console.warn('[RealSSA] Supabase publishable key is not configured. Supabase-backed features will be unavailable.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
