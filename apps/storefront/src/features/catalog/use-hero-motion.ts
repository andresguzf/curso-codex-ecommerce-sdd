"use client";

import { useEffect, useState } from "react";

export const HERO_INTERVAL_MS = 14_000;

/** Timers and browser preferences are external systems; no commercial state. */
export function useHeroMotion(count: number, ready: boolean, interacting = false) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [reduced, setReduced] = useState(true);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const updateMedia = () => setReduced(media?.matches ?? true);
    const updateVisibility = () => setVisible(document.visibilityState === "visible");
    updateMedia();
    updateVisibility();
    media?.addEventListener("change", updateMedia);
    document.addEventListener("visibilitychange", updateVisibility);
    return () => {
      media?.removeEventListener("change", updateMedia);
      document.removeEventListener("visibilitychange", updateVisibility);
    };
  }, []);
  const running = ready && visible && !reduced && !paused && !hovered && !focused && !interacting;
  useEffect(() => {
    if (!running || count < 2) return;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % count), HERO_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [count, running]);
  function select(nextIndex: number) { setIndex(nextIndex); setPaused(true); }
  return { index, paused, reduced, running, select, setHovered, setFocused, toggle: () => setPaused((current) => !current) };
}
