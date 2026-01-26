// Supabase client placeholder - used when Lovable Cloud is not enabled
// For production Supabase client, use: import { supabase } from '@/integrations/supabase/client'
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
