import type { Env } from '../types';

const SITEVERIFY_URL =
  'https://challenges.cloudflare.com/turnstile/v0/siteverify';

interface TurnstileResponse {
  success: boolean;
}

/**
 * Verifies a Turnstile token server-side.
 *
 * If `env.TURNSTILE_SECRET` is empty the behaviour depends on where we are:
 *
 * - Production (ALLOWED_ORIGIN names kospinow.com): fail CLOSED. A deployment
 *   that forgot the secret must refuse posts, not silently drop the CAPTCHA —
 *   the same rule adminAuth applies to a missing ADMIN_TOKEN. Failing open here
 *   would turn one missed `wrangler secret put` into an unprotected board.
 * - Local dev (wrangler dev without secrets): skip the check with a warning so
 *   the API stays usable without registering a Turnstile site.
 */
export async function verifyTurnstile(
  token: string,
  env: Pick<Env, 'TURNSTILE_SECRET' | 'ALLOWED_ORIGIN'>,
  ip?: string
): Promise<boolean> {
  const secret = env.TURNSTILE_SECRET;
  if (!secret) {
    if ((env.ALLOWED_ORIGIN ?? '').includes('kospinow.com')) {
      console.error(
        '[worker] TURNSTILE_SECRET is not set in production — refusing CAPTCHA verification (fail closed)'
      );
      return false;
    }
    console.warn(
      '[worker] TURNSTILE_SECRET is not set — skipping CAPTCHA verification (dev mode only)'
    );
    return true;
  }

  const params = new URLSearchParams({ secret, response: token });
  if (ip) params.set('remoteip', ip);

  try {
    const res = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const data = (await res.json()) as TurnstileResponse;
    return data.success === true;
  } catch {
    return false;
  }
}
