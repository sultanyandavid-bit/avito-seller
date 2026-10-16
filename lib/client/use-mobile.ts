"use client";
import { useSyncExternalStore } from "react";
const query = "(max-width: 700px)";
const subscribe = (cb: () => void) => {
  const m = window.matchMedia(query);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};
const snapshot = () => window.matchMedia(query).matches;
export function useMobile() {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}
