import { useEffect, useRef, useState } from "react";

/**
 * The measured width of an element, for drawing that cannot be done in CSS.
 *
 * An SVG chart needs a real pixel width: a viewBox with
 * `preserveAspectRatio="none"` would stretch the type along with the curve, and
 * axis labels have to stay upright and evenly spaced whatever the container
 * does. ResizeObserver reports the container's own size, so this follows a
 * rotation or a sidebar opening, not just a window resize.
 *
 * Starts at 0, which callers treat as "not measured yet" and skip drawing —
 * one frame of nothing beats a frame of a chart squeezed into zero pixels.
 */
export function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    // jsdom and older Safari have no ResizeObserver; the element still has a
    // width, it just will not report changes to it.
    if (typeof ResizeObserver === "undefined") {
      setWidth(node.clientWidth);
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width ?? node.clientWidth;
      setWidth((prev) => (Math.abs(prev - next) < 0.5 ? prev : next));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return { ref, width };
}
