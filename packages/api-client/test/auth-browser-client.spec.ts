import { describe, expect, it, vi } from "vitest";

import { createAuthBrowserClient } from "../src/auth-browser-client";

const session = {
  accessToken: "access-token",
  tokenType: "Bearer",
  accessTokenExpiresAt: "2026-09-02T10:15:00.000Z",
  sessionExpiresAt: "2026-09-09T10:15:00.000Z",
  user: { id: "3296f1d5-5a1d-4b94-9caa-b26878f447e4", email: "ana@example.com", displayName: "Ana Díaz", role: "CUSTOMER" },
} as const;

describe("browser auth REST client", () => {
  it("uses credentialed REST requests and validates login responses", async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(session), { status: 200 }));
    const client = createAuthBrowserClient({ baseUrl: "http://localhost:3001/api/v1/", fetch: fetchImplementation });
    await expect(client.login({ email: "ana@example.com", password: "secret" })).resolves.toEqual(session);
    expect(fetchImplementation).toHaveBeenCalledWith("http://localhost:3001/api/v1/auth/login", expect.objectContaining({ credentials: "include", method: "POST" }));
  });

  it("obtains CSRF before logout and never exposes a refresh token", async () => {
    const fetchImplementation = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ csrfToken: "12345678901234567890123456789012" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const client = createAuthBrowserClient({ baseUrl: "http://localhost:3001/api/v1", fetch: fetchImplementation });
    await client.logout();
    expect(fetchImplementation).toHaveBeenNthCalledWith(2, "http://localhost:3001/api/v1/auth/logout", expect.objectContaining({ credentials: "include", headers: expect.objectContaining({ "X-CSRF-Token": "12345678901234567890123456789012" }) }));
    expect(session).not.toHaveProperty("refreshToken");
  });
});
