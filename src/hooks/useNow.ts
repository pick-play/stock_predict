import { useEffect, useState } from "react";

const TICK_INTERVAL_MS = 1_000;

/**
 * One clock for the whole page.
 *
 * Every consumer used to own an interval and re-render its subtree once a
 * second. On the dashboard that was five timers and five subtree renders per
 * second, forever, on a phone that is also compositing a marquee — which is how
 * a page that only shows prices ends up warming a hand.
 *
 * Now there is a single interval, shared, and each caller states how precise it
 * needs to be. A component showing "3분 전" subscribes at 30s and wakes twice a
 * minute instead of sixty times; only the readouts that literally count seconds
 * ask for 1s, and those should be leaves (see RelativeTime) so a tick repaints a
 * text node rather than a card.
 */

type Subscriber = {
  resolutionMs: number;
  /** Bucket last delivered, so a coarse subscriber skips ticks it cannot show. */
  lastBucket: number;
  notify: (now: Date) => void;
};

const subscribers = new Set<Subscriber>();
let timer: number | undefined;

function tick(): void {
  const now = new Date();
  for (const subscriber of subscribers) {
    const bucket = Math.floor(now.getTime() / subscriber.resolutionMs);
    if (bucket === subscriber.lastBucket) continue;
    subscriber.lastBucket = bucket;
    subscriber.notify(now);
  }
}

function start(): void {
  if (timer !== undefined || subscribers.size === 0) return;
  timer = window.setInterval(tick, TICK_INTERVAL_MS);
}

function stop(): void {
  if (timer === undefined) return;
  window.clearInterval(timer);
  timer = undefined;
}

function handleVisibilityChange(): void {
  if (document.visibilityState === "visible") {
    // Catch up first: labels frozen since the tab was hidden are wrong on sight.
    tick();
    start();
  } else {
    stop();
  }
}

function subscribe(subscriber: Subscriber): () => void {
  const first = subscribers.size === 0;
  subscribers.add(subscriber);

  if (first) {
    document.addEventListener("visibilitychange", handleVisibilityChange);
  }
  if (document.visibilityState === "visible") start();

  return () => {
    subscribers.delete(subscriber);
    if (subscribers.size === 0) {
      stop();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    }
  };
}

/**
 * The current time, re-rendering the caller no more often than `resolutionMs`.
 *
 * Ticking pauses while the document is hidden and catches up on return, so a
 * backgrounded tab costs nothing and never comes back showing a stale age.
 */
export function useNow(resolutionMs: number = TICK_INTERVAL_MS): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const subscriber: Subscriber = {
      resolutionMs: Math.max(TICK_INTERVAL_MS, resolutionMs),
      lastBucket: Math.floor(Date.now() / Math.max(TICK_INTERVAL_MS, resolutionMs)),
      notify: setNow,
    };
    return subscribe(subscriber);
  }, [resolutionMs]);

  return now;
}
