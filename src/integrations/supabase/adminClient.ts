/**
 * adminClient.ts — Singleton Supabase Admin Client
 *
 * This module provides a single shared admin client instance that uses the
 * service role key for privileged operations (create user, delete user, etc.)
 *
 * ⚠️  IMPORTANT: The service role key in VITE_SUPABASE_SERVICE_ROLE_KEY is
 * intentionally exposed here because admin-only pages are:
 *   1. Protected by ProtectedRoute requiring `role === "admin"`
 *   2. This is a local-only / internal company app (not a public-facing product)
 *
 * For a public product, move these operations to a backend/Edge Function.
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { SUPABASE_URL } from './client';

const SERVICE_ROLE_KEY = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY as string | undefined;

// Singleton instance — created once, reused everywhere.
// This eliminates the "Multiple GoTrueClient instances" warning.
let _adminClient: ReturnType<typeof createClient<Database>> | null = null;

/**
 * Returns the admin Supabase client (singleton).
 * Throws a descriptive error if the service role key is not configured.
 */
export const getAdminClient = () => {
    if (!SERVICE_ROLE_KEY) {
        throw new Error(
            'Admin operations require VITE_SUPABASE_SERVICE_ROLE_KEY in your .env file.\n' +
            'This key is only used for privileged operations in the admin panel.'
        );
    }

    if (!_adminClient) {
        // Use the real Supabase URL directly for admin operations (bypasses proxy).
        // The proxy is only needed for the anon client to fix QUIC issues.
        _adminClient = createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
            },
        });
    }

    return _adminClient;
};
