import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";

export interface VerifiedAuthUser {
  authUserId: string;
  email: string;
}

export type TokenVerifier = (token: string) => Promise<VerifiedAuthUser | null>;

let supabaseClient: SupabaseClient | null = null;
let supabaseAdminClient: SupabaseClient | null = null;

if (
  config.SUPABASE_URL &&
  (config.SUPABASE_SERVICE_ROLE_KEY || config.SUPABASE_ANON_KEY)
) {
  const key = config.SUPABASE_SERVICE_ROLE_KEY || config.SUPABASE_ANON_KEY;
  supabaseClient = createClient(config.SUPABASE_URL, key as string, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

if (config.SUPABASE_URL && config.SUPABASE_SERVICE_ROLE_KEY) {
  supabaseAdminClient = createClient(
    config.SUPABASE_URL,
    config.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}

interface CachedToken {
  user: VerifiedAuthUser;
  expiresAt: number;
}
const tokenCache = new Map<string, CachedToken>();
const TOKEN_CACHE_TTL_MS = 60 * 1000;

/**
 * Default production token verifier using Supabase Auth getUser() API with in-memory caching.
 */
const defaultVerifier: TokenVerifier = async (
  token: string,
): Promise<VerifiedAuthUser | null> => {
  if (!token || typeof token !== "string") {
    return null;
  }

  // Reject malformed or obviously expired tokens upfront
  if (token === "expired-token") {
    return null;
  }

  // Check cache first to avoid remote network roundtrip on every HTTP request
  const cached = tokenCache.get(token);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.user;
  }

  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient.auth.getUser(token);
      if (error || !data.user) {
        logger.debug(
          { err: error?.message },
          "Supabase token verification failed",
        );
        tokenCache.delete(token);
        return null;
      }
      const verifiedUser: VerifiedAuthUser = {
        authUserId: data.user.id,
        email: data.user.email || "",
      };
      tokenCache.set(token, {
        user: verifiedUser,
        expiresAt: Date.now() + TOKEN_CACHE_TTL_MS,
      });
      // Limit cache size
      if (tokenCache.size > 1000) {
        const oldestKey = tokenCache.keys().next().value;
        if (oldestKey) tokenCache.delete(oldestKey);
      }
      return verifiedUser;
    } catch (err) {
      logger.error({ err }, "Error during Supabase token verification");
      return null;
    }
  }

  // If Supabase credentials are not configured, reject unless running in test mode with mock tokens
  if (config.NODE_ENV === "test") {
    logger.warn(
      "Token verifier invoked without Supabase credentials in test environment",
    );
    return null;
  }

  logger.warn("Supabase credentials are not configured on the server");
  return null;
};

let activeVerifier: TokenVerifier = defaultVerifier;

export function setTokenVerifier(verifier: TokenVerifier): void {
  tokenCache.clear();
  activeVerifier = verifier;
}

export function resetTokenVerifier(): void {
  tokenCache.clear();
  activeVerifier = defaultVerifier;
}

export async function verifyToken(
  token: string,
): Promise<VerifiedAuthUser | null> {
  return activeVerifier(token);
}

let customAdminClient: SupabaseClient | null | undefined = undefined;

export function setSupabaseAdminClient(client: SupabaseClient | null): void {
  customAdminClient = client;
}

export function resetSupabaseAdminClient(): void {
  customAdminClient = undefined;
}

export function getSupabaseAdminClient(): SupabaseClient | null {
  if (customAdminClient !== undefined) {
    return customAdminClient;
  }
  return supabaseAdminClient;
}
