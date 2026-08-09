const SITEVERIFY_URL =
  'https://challenges.cloudflare.com/turnstile/v0/siteverify';

interface TurnstileResponse {
  success: boolean;
}

/**
 * Verifies a Turnstile token server-side.
 *
 * If `secret` is empty (local dev without wrangler secrets), the check is
 * skipped and a console warning is emitted so the API stays usable locally.
 * In production TURNSTILE_SECRET is always populated.
 */
export async function verifyTurnstile(
  token: string,
  secret: string,
  ip?: string
): Promise<boolean> {
  if (!secret) {
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
