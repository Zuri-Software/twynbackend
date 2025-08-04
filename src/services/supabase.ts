import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client with service role key for backend operations
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!, // Use service key for admin operations
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export { supabase };

// Helper function to verify JWT token from client
export async function verifySupabaseToken(token: string) {
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error) {
      console.error('Supabase token verification error:', error);
      return null;
    }
    
    return user;
  } catch (error) {
    console.error('Error verifying Supabase token:', error);
    return null;
  }
}

// Get user profile from Supabase Auth
export async function getSupabaseUserProfile(userId: string) {
  try {
    const { data, error } = await supabase.auth.admin.getUserById(userId);
    
    if (error) {
      console.error('Error getting user profile:', error);
      return null;
    }
    
    return data.user;
  } catch (error) {
    console.error('Error getting user profile:', error);
    return null;
  }
}