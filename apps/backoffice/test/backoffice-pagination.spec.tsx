import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BackofficePagination } from "../src/components/backoffice-pagination";

const navigation = vi.hoisted(() => ({
  pathname: "/products",
  push: vi.fn(),
  searchParams: new URLSearchParams("search=monitor&status=ACTIVE&page=10"),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ push: navigation.push }),
  useSearchParams: () => navigation.searchParams,
}));

describe("backoffice pagination", () => {
  beforeEach(() => {
    navigation.push.mockReset();
    navigation.searchParams = new URLSearchParams(
      "search=monitor&status=ACTIVE&page=10",
    );
  });

  it("changes only the page and preserves active list criteria", async () => {
    const user = userEvent.setup();
    render(<BackofficePagination page={10} totalPages={20} />);

    await user.click(screen.getByRole("button", { name: "Ir a la página 12" }));

    expect(navigation.push).toHaveBeenCalledWith(
      "/products?search=monitor&status=ACTIVE&page=12",
      { scroll: false },
    );
  });
});
