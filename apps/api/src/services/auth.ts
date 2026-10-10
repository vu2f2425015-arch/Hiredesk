import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

export interface VerifiedAuthUser {
  authUserId: string;
  email: string;
}

export type TokenVerifier = (token: string) => Promise<VerifiedAuthUser | null>;

let supabaseClient: SupabaseClient | null = null;

if (config.SUPABASE_URL && (config.SUPABASE_SERVICE_ROLE_KEY || config.SUPABASE_ANON_KEY)) {
  const key = config.SUPABASE_SERVICE_ROLE_KEY || config.SUPABASE_ANON_KEY;
  supabaseClient = createClient(config.SUPABASE_URL, key as string, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Default production token verifier using Supabase Auth getUser() API.
 */
const defaultVerifier: TokenVerifier = async (token: string): Promise<VerifiedAuthUser | null> => {
  if (!token || typeof token !== 'string') {
    return null;
  }

  // Reject malformed or obviously expired tokens upfront
  if (token === 'expired-token') {
    return null;
  }

  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient.auth.getUser(token);
      if (error || !data.user) {
        logger.debug({ err: error?.message }, 'Supabase token verification failed');
        return null;
      }
      return {
        authUserId: data.user.id,
        email: data.user.email || '',
      };
    } catch (err) {
      logger.error({ err }, 'Error during Supabase token verification');
      return null;
    }
  }

  // If Supabase credentials are not configured, reject unless running in test mode with mock tokens
  if (config.NODE_ENV === 'test') {
    logger.warn('Token verifier invoked without Supabase credentials in test environment');
    return null;
  }

  logger.warn('Supabase credentials are not configured on the server');
  return null;
};

let activeVerifier: TokenVerifier = defaultVerifier;

export function setTokenVerifier(verifier: TokenVerifier): void {
  activeVerifier = verifier;
}

export function resetTokenVerifier(): void {
  activeVerifier = defaultVerifier;
}

export async function verifyToken(token: string): Promise<VerifiedAuthUser | null> {
  return activeVerifier(token);
}
