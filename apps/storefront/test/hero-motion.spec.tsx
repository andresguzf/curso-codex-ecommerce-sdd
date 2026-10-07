import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HERO_INTERVAL_MS, useHeroMotion } from "../src/features/catalog/use-hero-motion";

describe("ambient hero motion", () => {
  let media: EventTarget & { matches: boolean };
  beforeEach(() => {
    vi.useFakeTimers();
    media = Object.assign(new EventTarget(), { matches: false });
    vi.stubGlobal("matchMedia", () => media);
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it("alternates only after images are ready and cleans up its interval", () => {
    const hook = renderHook(({ ready }) => useHeroMotion(2, ready), { initialProps: { ready: false } });
    act(() => vi.advanceTimersByTime(HERO_INTERVAL_MS));
    expect(hook.result.current.index).toBe(0);
    hook.rerender({ ready: true });
    act(() => vi.advanceTimersByTime(HERO_INTERVAL_MS));
    expect(hook.result.current.index).toBe(1);
    act(() => vi.advanceTimersByTime(HERO_INTERVAL_MS));
    expect(hook.result.current.index).toBe(0);
    hook.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("pauses for focus and search interaction", () => {
    const hook = renderHook(({ interacting }) => useHeroMotion(2, true, interacting), { initialProps: { interacting: false } });
    act(() => hook.result.current.setFocused(true));
    expect(hook.result.current.running).toBe(false);
    act(() => hook.result.current.setFocused(false));
    hook.rerender({ interacting: true });
    act(() => vi.advanceTimersByTime(HERO_INTERVAL_MS * 3));
    expect(hook.result.current.index).toBe(0);
    hook.rerender({ interacting: false });
    expect(hook.result.current.running).toBe(true);
  });
  it("keeps explicit pause until resume or manual selection", () => {
    const { result } = renderHook(() => useHeroMotion(2, true));
    act(() => result.current.toggle());
    expect(result.current.running).toBe(false);
    act(() => result.current.toggle());
    expect(result.current.running).toBe(true);
    act(() => { result.current.toggle(); result.current.setFocused(true); });
    act(() => result.current.select(1));
    expect(result.current.index).toBe(1);
    expect(result.current.paused).toBe(false);
    expect(result.current.running).toBe(true);
    act(() => vi.advanceTimersByTime(HERO_INTERVAL_MS));
    expect(result.current.index).toBe(0);
  });
  it("stops while the document is hidden and resumes without revoking explicit pause", () => {
    const visibility = vi.spyOn(document, "visibilityState", "get");
    const { result } = renderHook(() => useHeroMotion(2, true));
    visibility.mockReturnValue("hidden");
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(result.current.running).toBe(false);
    act(() => vi.advanceTimersByTime(HERO_INTERVAL_MS));
    expect(result.current.index).toBe(0);
    act(() => result.current.toggle());
    visibility.mockReturnValue("visible");
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(result.current.paused).toBe(true);
    expect(result.current.running).toBe(false);
  });
  it("explicit resume clears focus pause without requiring blur", () => {
    const { result } = renderHook(() => useHeroMotion(2, true));
    act(() => { result.current.setFocused(true); result.current.toggle(); });
    expect(result.current.running).toBe(false);
    act(() => result.current.toggle());
    expect(result.current.running).toBe(true);
    act(() => result.current.setFocused(true));
    expect(result.current.running).toBe(false);
  });
  it("respects initial and live reduced-motion preferences", () => {
    media.matches = true;
    const { result } = renderHook(() => useHeroMotion(2, true));
    act(() => vi.advanceTimersByTime(HERO_INTERVAL_MS * 3));
    expect(result.current.index).toBe(0);
    expect(result.current.running).toBe(false);
    act(() => result.current.select(1));
    expect(result.current.index).toBe(1);
    media.matches = false;
    act(() => media.dispatchEvent(new Event("change")));
    expect(result.current.running).toBe(true);
    media.matches = true;
    act(() => media.dispatchEvent(new Event("change")));
    expect(result.current.running).toBe(false);
  });
});
