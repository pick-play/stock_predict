/**
 * Live spot-ticker stream for the crypto entry on the tape.
 *
 * Separate from binance/websocketAdapter.ts on purpose. That adapter reads
 * @bookTicker on the futures socket, because for the TradFi symbols the mark
 * and ticker streams emit nothing. Spot BTCUSDT has no such limitation and
 * @ticker carries both the last price and the 24h change, which is exactly what
 * a tape row needs — reusing the futures adapter would mean deriving a mid from
 * the book and inventing a change figure.
 *
 * For crypto the comparison is the rolling 24h window, not a previous close:
 * there is no session to close.
 */

import { BINANCE_WS_BASE } from "../../config/market";

export type TickerStreamStatus = "connecting" | "connected" | "disconnected";

export interface LiveTicker {
  /** Binance symbol, e.g. "BTCUSDT". */
  symbol: string;
  price: number;
  changePercent24h: number;
  eventTime: string;
}

const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 15000, 30000];

interface SpotTickerMessage {
  e?: string;
  E?: number;
  s?: string;
  /** Last price, sent as a decimal string. */
  c?: string;
  /** 24h change percent, sent as a decimal string. */
  P?: string;
}

function parseNumber(value: string | undefined): number | null {
  if (value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Subscribes to the combined spot @ticker stream.
 *
 * Returns a disconnect function that stops reconnection and closes the socket.
 * Mirrors the backoff schedule of the futures adapter so a reader on a flaky
 * connection sees the same recovery behaviour everywhere on the page.
 */
export function connectBinanceSpotTicker(
  symbols: string[],
  onTicker: (ticker: LiveTicker) => void,
  onStatusChange?: (status: TickerStreamStatus) => void
): () => void {
  if (symbols.length === 0) return () => {};

  let ws: WebSocket | null = null;
  let reconnectCount = 0;
  let stopped = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  const streams = symbols.map((s) => `${s.toLowerCase()}@ticker`).join("/");
  const url = `${BINANCE_WS_BASE}/stream?streams=${streams}`;

  function scheduleReconnect() {
    if (stopped) return;
    const delay =
      RECONNECT_DELAYS[Math.min(reconnectCount, RECONNECT_DELAYS.length - 1)];
    reconnectCount++;
    reconnectTimer = setTimeout(connect, delay);
  }

  function connect() {
    if (stopped) return;

    onStatusChange?.("connecting");

    try {
      ws = new WebSocket(url);
    } catch (err) {
      console.warn("[spotTicker] socket construction failed", err);
      onStatusChange?.("disconnected");
      scheduleReconnect();
      return;
    }

    ws.onopen = () => {
      reconnectCount = 0;
      onStatusChange?.("connected");
    };

    ws.onmessage = (event) => {
      try {
        const envelope = JSON.parse(event.data as string) as {
          data?: SpotTickerMessage;
        };
        const data = envelope.data;
        if (!data?.s || data.e !== "24hrTicker") return;

        const price = parseNumber(data.c);
        const changePercent24h = parseNumber(data.P);
        // A zero or missing price is a malformed frame, not a cheap bitcoin.
        if (price === null || price <= 0 || changePercent24h === null) return;

        onTicker({
          symbol: data.s,
          price,
          changePercent24h,
          eventTime: new Date(data.E ?? Date.now()).toISOString(),
        });
      } catch (err) {
        console.error("[spotTicker] message parse error", err);
      }
    };

    ws.onerror = () => {
      onStatusChange?.("disconnected");
    };

    ws.onclose = () => {
      if (stopped) return;
      onStatusChange?.("disconnected");
      scheduleReconnect();
    };
  }

  connect();

  return () => {
    stopped = true;
    if (reconnectTimer !== null) clearTimeout(reconnectTimer);
    ws?.close();
    ws = null;
  };
}
