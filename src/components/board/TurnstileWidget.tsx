/**
 * Cloudflare Turnstile CAPTCHA widget.
 *
 * The Turnstile *site key* is a public value stored in VITE_TURNSTILE_SITE_KEY.
 * The secret key lives only in the Worker and is never shipped to the browser.
 *
 * When the env var is absent the widget renders nothing and
 * isTurnstileConfigured is false. In that case PostForm sends an empty token;
 * the server will return 403 captcha-failed, which is correct behaviour.
 */

import { useEffect, useRef } from "react";
import {
  TURNSTILE_SITE_KEY,
  isTurnstileConfigured,
} from "../../lib/board/turnstileConfig";


// Minimal type stub — Turnstile injects itself onto window at runtime.
declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          "expired-callback": () => void;
          "error-callback": () => void;
          theme: "dark" | "light" | "auto";
          size: "normal" | "compact";
        }
      ) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

let scriptLoaded = false;
let scriptLoading: Promise<void> | null = null;

function loadTurnstileScript(): Promise<void> {
  if (scriptLoaded) return Promise.resolve();
  if (scriptLoading) return scriptLoading;

  scriptLoading = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
    script.async = true;
    script.defer = true;
    script.dataset["turnstile"] = "1";
    script.onload = () => {
      scriptLoaded = true;
      resolve();
    };
    script.onerror = () => reject(new Error("Turnstile script failed to load"));
    document.head.appendChild(script);
  });

  return scriptLoading;
}

interface TurnstileWidgetProps {
  onToken: (token: string) => void;
  onExpire: () => void;
  onError: () => void;
  /** Defaults to "auto" so it follows the page theme. */
  theme?: "dark" | "light" | "auto";
}

export function TurnstileWidget({
  onToken,
  onExpire,
  onError,
  theme = "auto",
}: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isTurnstileConfigured || !containerRef.current) return;

    let cancelled = false;

    void loadTurnstileScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return;
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          callback: onToken,
          "expired-callback": onExpire,
          "error-callback": onError,
          theme,
          size: "normal",
        });
      })
      .catch(() => {
        if (!cancelled) onError();
      });

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
    // onToken/onExpire/onError are stable callbacks from PostForm (useCallback)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);

  if (!isTurnstileConfigured) return null;

  return (
    <div
      ref={containerRef}
      aria-label="보안 문자 확인"
      role="region"
    />
  );
}
