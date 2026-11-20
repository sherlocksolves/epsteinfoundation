// Browser-safe Supabase client. The publishable key is intentionally public.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
export const SUPABASE_URL = "https://elndnwiujkghclblnuyl.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_3GDhqVQb7f277WFeHfBfmQ_YhMSYztJ";
export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: "pkce"
  },
  realtime: { params: { eventsPerSecond: 5 } }
});
export const functionUrl = (name) => `${SUPABASE_URL}/functions/v1/${name}`;
