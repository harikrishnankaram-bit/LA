import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Custom fetch that forces HTTP/1.1 by disabling the QUIC/HTTP3 cache hint.
 * This fixes ERR_QUIC_PROTOCOL_ERROR on networks that block UDP (QUIC).
 */
const customFetch: typeof fetch = (input, init) => {
  return fetch(input, {
    ...init,
    // 'no-store' prevents Chrome from using a cached QUIC/Alt-Svc connection
    // that might be broken, forcing it to fall back to TCP/HTTP2
    cache: 'no-store',
  });
};

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
    // Reduce retries so a bad session fails fast instead of retrying 3x
    // causing a flood of ERR_QUIC errors in the console
  },
  global: {
    fetch: customFetch,
  },
});