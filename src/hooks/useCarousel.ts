"use client";

import { useCallback, useEffect, useState } from "react";

/** Index-based carousel with wrap-around and pausable autoplay. */
export function useCarousel(length: number, { intervalMs = 7000 } = {}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const goTo = useCallback(
    (next: number) => setIndex(length ? ((next % length) + length) % length : 0),
    [length],
  );
  const next = useCallback(() => setIndex((i) => (length ? (i + 1) % length : 0)), [length]);
  const prev = useCallback(() => setIndex((i) => (length ? (i - 1 + length) % length : 0)), [length]);

  useEffect(() => {
    if (paused || length < 2) return;
    const timer = setInterval(next, intervalMs);
    return () => clearInterval(timer);
  }, [paused, length, intervalMs, next, index]);

  /** Relative item: `at(1)` is the upcoming slide. */
  const at = useCallback((offset: number) => (length ? (index + offset) % length : 0), [index, length]);

  return {
    index,
    at,
    goTo,
    next,
    prev,
    pause: () => setPaused(true),
    resume: () => setPaused(false),
  };
}
