// Supabase client placeholder
// This file will be populated when Lovable Cloud is enabled

// import { createClient } from '@supabase/supabase-js';
// import type { Database } from '@/types/database';

// const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
// const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

// Placeholder export for type-safety until Cloud is enabled
export const supabase = null;

// Auth helper functions (to be implemented with Supabase)
export const auth = {
  signUp: async (email: string, password: string, metadata?: Record<string, unknown>) => {
    console.log('Auth signUp called - enable Lovable Cloud to activate', { email, metadata });
    return { data: null, error: new Error('Lovable Cloud not enabled') };
  },
  
  signIn: async (email: string, password: string) => {
    console.log('Auth signIn called - enable Lovable Cloud to activate', { email });
    return { data: null, error: new Error('Lovable Cloud not enabled') };
  },
  
  signOut: async () => {
    console.log('Auth signOut called - enable Lovable Cloud to activate');
    return { error: null };
  },
  
  getUser: async () => {
    console.log('Auth getUser called - enable Lovable Cloud to activate');
    return { data: { user: null }, error: null };
  },
  
  getSession: async () => {
    console.log('Auth getSession called - enable Lovable Cloud to activate');
    return { data: { session: null }, error: null };
  },
};
