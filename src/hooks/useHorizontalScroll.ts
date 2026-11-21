"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Drives a horizontally scrolling rail with prev/next controls. */
export function useHorizontalScroll<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [edges, setEdges] = useState({ atStart: true, atEnd: true });

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setEdges({
      atStart: el.scrollLeft <= 4,
      atEnd: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4,
    });
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    el.addEventListener("scroll", measure, { passive: true });
    return () => {
      observer.disconnect();
      el.removeEventListener("scroll", measure);
    };
  }, [measure]);

  const scrollBy = useCallback((direction: 1 | -1) => {
    const el = ref.current;
    el?.scrollBy({ left: direction * el.clientWidth * 0.85, behavior: "smooth" });
  }, []);

  return { ref, ...edges, scrollBy };
}
