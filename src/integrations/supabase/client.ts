import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// In development, route ALL Supabase traffic through the Vite proxy server.
// Node.js (the proxy) does not implement QUIC, so all requests go over TCP —
// this permanently fixes ERR_QUIC_PROTOCOL_ERROR in Chrome dev mode.
// In production, the real Supabase URL is used directly.
const CLIENT_URL = import.meta.env.DEV
  ? `${window.location.origin}/supabase`
  : SUPABASE_URL;

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(CLIENT_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});

// Re-export for convenience
export { SUPABASE_URL, SUPABASE_ANON_KEY };