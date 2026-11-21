"use client";

import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/** `false` during SSR and hydration, `true` once running in the browser. */
export const useHydrated = () =>
  useSyncExternalStore(noopSubscribe, () => true, () => false);
