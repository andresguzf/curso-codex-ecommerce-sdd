import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FlashRegion, useFlashStore } from "../src";

describe("shared flash region", () => {
  beforeEach(() => useFlashStore.getState().dismissFlash());
  afterEach(() => {
    vi.useRealTimers();
    useFlashStore.getState().dismissFlash();
  });

  it.each([
    ["success", "polite"],
    ["info", "polite"],
    ["warning", "assertive"],
    ["error", "assertive"],
  ] as const)("announces %s in the %s live region", (tone, politeness) => {
    render(<FlashRegion appearance="backoffice" />);
    act(() => useFlashStore.getState().showFlash(tone, `${tone} message`));

    const announcement = screen.getByText(`${tone} message`);
    expect(announcement.closest(`[aria-live="${politeness}"]`)).toHaveAttribute("aria-atomic", "true");
    expect(announcement.closest('[data-slot="flash-message"]')).toHaveAttribute("data-tone", tone);
  });

  it("deduplicates identical notices and allows dismissal", async () => {
    const user = userEvent.setup();
    render(<FlashRegion appearance="storefront" />);
    act(() => useFlashStore.getState().showFlash("success", "  Guardado  "));
    const first = useFlashStore.getState().flash;
    act(() => useFlashStore.getState().showFlash("success", "Guardado"));
    expect(useFlashStore.getState().flash).toBe(first);
    expect(screen.getAllByText("Guardado")).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "Cerrar aviso" }));
    expect(useFlashStore.getState().flash).toBeNull();
  });

  it("expires brief messages but preserves actionable warnings", () => {
    vi.useFakeTimers();
    render(<FlashRegion appearance="storefront" />);
    act(() => useFlashStore.getState().showFlash("info", "Sincronizado"));
    act(() => vi.advanceTimersByTime(6_000));
    expect(useFlashStore.getState().flash).toBeNull();

    act(() => useFlashStore.getState().showFlash("warning", "Revisa el stock"));
    act(() => vi.advanceTimersByTime(10_000));
    expect(useFlashStore.getState().flash?.tone).toBe("warning");
  });
});
