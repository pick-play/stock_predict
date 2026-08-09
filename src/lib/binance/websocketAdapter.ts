import type { NormalizedQuote, BinanceFuturesBookTickerWS } from "./types";
import { normalizeFuturesBookTickerWS } from "./normalizer";
import { BINANCE_FUTURES_WS_BASE } from "../../config/market";

export type WsConnectionStatus = "connecting" | "connected" | "disconnected";

const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 15000, 30000];

/**
 * Connects to Binance USDT-M Futures combined WebSocket stream for @bookTicker.
 *
 * Note: only @bookTicker reliably emits for TradFi symbols (SAMSUNGUSDT, SKHYNIXUSDT).
 * @markPrice / @ticker produce no messages for these symbols (verified live 2026-08-09).
 *
 * Returns a disconnect function that stops reconnection and closes the socket.
 */
export function connectBinanceFuturesStream(
  symbols: string[],
  onQuote: (quote: NormalizedQuote) => void,
  onStatusChange?: (status: WsConnectionStatus) => void
): () => void {
  let ws: WebSocket | null = null;
  let reconnectCount = 0;
  let stopped = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  const streams = symbols
    .map((s) => `${s.toLowerCase()}@bookTicker`)
    .join("/");
  const url = `${BINANCE_FUTURES_WS_BASE}/stream?streams=${streams}`;

  function connect() {
    if (stopped) return;

    onStatusChange?.("connecting");
    ws = new WebSocket(url);

    ws.onopen = () => {
      reconnectCount = 0;
      onStatusChange?.("connected");
    };

    ws.onmessage = (event) => {
      try {
        const envelope = JSON.parse(event.data as string) as {
          data: BinanceFuturesBookTickerWS;
        };
        const data = envelope.data;
        if (!data?.s || data.e !== "bookTicker") return;
        onQuote(normalizeFuturesBookTickerWS(data, "binance-websocket"));
      } catch (err) {
        console.error("[WebSocket] Message parse error:", err);
      }
    };

    ws.onerror = () => {
      // All errors surface through onclose; no separate action needed here.
    };

    ws.onclose = () => {
      if (stopped) return;
      onStatusChange?.("disconnected");
      const delay =
        RECONNECT_DELAYS[Math.min(reconnectCount, RECONNECT_DELAYS.length - 1)];
      reconnectCount++;
      reconnectTimer = setTimeout(connect, delay);
    };
  }

  connect();

  return () => {
    stopped = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (ws) {
      ws.onclose = null;
      ws.close();
    }
  };
}
