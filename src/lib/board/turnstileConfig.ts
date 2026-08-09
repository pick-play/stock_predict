/**
 * Turnstile public configuration.
 * The site key is a build-time public value — never the secret key.
 * Separated from TurnstileWidget.tsx so react-refresh can fast-reload the
 * component file without warnings about mixed component/constant exports.
 */

export const TURNSTILE_SITE_KEY =
  (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined) ?? "";

export const isTurnstileConfigured = TURNSTILE_SITE_KEY.length > 0;
