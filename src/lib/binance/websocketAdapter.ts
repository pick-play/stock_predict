import type { NormalizedQuote } from "./types";
import { normalizeTicker } from "./normalizer";
import { BINANCE_WS_BASE } from "../../config/market";

interface BookTickerMessage {
  e?: string;
  s: string;
  b: string;
  B: string;
  a: string;
  A: string;
  T?: number;
}

const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 15000, 30000];

export function connectBinanceStream(
  symbols: string[],
  onQuote: (quote: NormalizedQuote) => void
): () => void {
  let ws: WebSocket | null = null;
  let reconnectCount = 0;
  let stopped = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  const streams = symbols
    .map((s) => `${s.toLowerCase()}@bookTicker`)
    .join("/");
  const url = `${BINANCE_WS_BASE}/stream?streams=${streams}`;

  function connect() {
    if (stopped) return;

    ws = new WebSocket(url);

    ws.onopen = () => {
      reconnectCount = 0;
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as {
          data: BookTickerMessage;
        };
        const data = msg.data;
        if (!data?.s) return;

        const quote = normalizeTicker(
          {
            symbol: data.s,
            lastPrice: data.b, // use bid as approximation for last in book stream
            bidPrice: data.b,
            askPrice: data.a,
            volume: "0",
            priceChangePercent: "0",
            time: data.T,
          },
          "binance-websocket"
        );

        onQuote(quote);
      } catch (err) {
        console.error("[WebSocket] Message parse error:", err);
      }
    };

    ws.onerror = () => {
      // Error handled in onclose
    };

    ws.onclose = () => {
      if (stopped) return;
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
