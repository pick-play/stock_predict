/**
 * Warms the TLS connection to the API origin before anything asks for it.
 *
 * Measured against the deployed Worker, a cold request spent 0.36s of its 0.55s
 * on the handshake. Joining the chat room pays that twice — once for the join
 * ticket, once for the socket upgrade — and a phone's round trips are longer
 * still, which is most of why entering the room felt slow. A preconnect moves
 * the handshake off the critical path.
 *
 * Injected at runtime rather than written into index.html so the origin keeps
 * coming from VITE_BOARD_API_BASE; a hard-coded host in the HTML would have to
 * be edited to point the site at a different Worker.
 */

const TURNSTILE_ORIGIN = "https://challenges.cloudflare.com";

function addPreconnect(href: string): void {
  const link = document.createElement("link");
  link.rel = "preconnect";
  link.href = href;
  // The API is read with credentials-less CORS requests, and a preconnect whose
  // crossorigin mode does not match the later request opens a second connection
  // instead of being reused.
  link.crossOrigin = "anonymous";
  document.head.appendChild(link);
}

export function preconnectApiOrigins(): void {
  const base = (import.meta.env.VITE_BOARD_API_BASE as string | undefined) ?? "";
  if (base !== "") {
    try {
      addPreconnect(new URL(base).origin);
    } catch {
      // A malformed base is the build's problem, not a reason to fail startup.
    }
  }

  // Only worth a connection when a captcha will actually be rendered.
  if ((import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined)) {
    addPreconnect(TURNSTILE_ORIGIN);
  }
}
