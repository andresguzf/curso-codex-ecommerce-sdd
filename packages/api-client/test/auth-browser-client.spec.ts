import { afterEach, describe, expect, it, vi } from "vitest";

import { createAuthBrowserClient } from "../src/auth-browser-client";

const session = {
  accessToken: "access-token",
  tokenType: "Bearer",
  accessTokenExpiresAt: "2026-09-02T10:15:00.000Z",
  sessionExpiresAt: "2026-09-09T10:15:00.000Z",
  user: { id: "3296f1d5-5a1d-4b94-9caa-b26878f447e4", email: "ana@example.com", displayName: "Ana Díaz", role: "CUSTOMER" },
} as const;

describe("browser auth REST client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

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

  it("does not reuse a pre-login CSRF token when restoring the new session", async () => {
    const fetchImplementation = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ csrfToken: "old-csrf-token-123456789012345678901234567890" }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code: "AUTH_INVALID_SESSION", message: "Invalid session" }), { status: 401 }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify(session), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ csrfToken: "new-csrf-token-123456789012345678901234567890" }), { status: 200 }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify(session), { status: 200 }));
    const client = createAuthBrowserClient({ baseUrl: "http://localhost:3001/api/v1", fetch: fetchImplementation });

    await expect(client.refresh()).rejects.toThrow();
    await expect(client.login({ email: "ana@example.com", password: "secret" })).resolves.toEqual(session);
    await expect(client.refresh()).resolves.toEqual(session);

    expect(fetchImplementation).toHaveBeenNthCalledWith(
      5,
      "http://localhost:3001/api/v1/auth/refresh",
      expect.objectContaining({
        headers: expect.objectContaining({ "X-CSRF-Token": "new-csrf-token-123456789012345678901234567890" }),
      }),
    );
  });

  it("uses the rotated CSRF token after refresh when logging out", async () => {
    const fetchImplementation = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(session), {
          headers: { "X-CSRF-Token": "login-csrf-token-123456789012345678901234" },
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(session), {
          headers: { "X-CSRF-Token": "refresh-csrf-token-12345678901234567890" },
          status: 200,
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const client = createAuthBrowserClient({ baseUrl: "http://localhost:3001/api/v1", fetch: fetchImplementation });

    await client.login({ email: "ana@example.com", password: "secret" });
    await client.refresh();
    await client.logout();

    expect(fetchImplementation).toHaveBeenNthCalledWith(
      3,
      "http://localhost:3001/api/v1/auth/logout",
      expect.objectContaining({
        headers: expect.objectContaining({ "X-CSRF-Token": "refresh-csrf-token-12345678901234567890" }),
      }),
    );
  });

  it("recovers from a stale CSRF token during logout", async () => {
    const fetchImplementation = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ csrfToken: "stale-csrf-token-123456789012345678901234" }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code: "CSRF_TOKEN_INVALID", correlationId: "logout-csrf", message: "Invalid CSRF token" }), { status: 403 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ csrfToken: "fresh-csrf-token-12345678901234567890123" }), { status: 200 }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const client = createAuthBrowserClient({ baseUrl: "http://localhost:3001/api/v1", fetch: fetchImplementation });

    await expect(client.logout()).resolves.toBeUndefined();
    expect(fetchImplementation).toHaveBeenNthCalledWith(
      4,
      "http://localhost:3001/api/v1/auth/logout",
      expect.objectContaining({
        headers: expect.objectContaining({ "X-CSRF-Token": "fresh-csrf-token-12345678901234567890123" }),
      }),
    );
  });

  it("coalesces concurrent session restores in the same tab", async () => {
    let resolveRefresh: ((response: Response) => void) | undefined;
    const refreshResponse = new Promise<Response>((resolve) => {
      resolveRefresh = resolve;
    });
    const fetchImplementation = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ csrfToken: "csrf-token-123456789012345678901234567890" }), { status: 200 }),
      )
      .mockImplementationOnce(() => refreshResponse);
    const client = createAuthBrowserClient({ baseUrl: "http://localhost:3001/api/v1", fetch: fetchImplementation });

    const firstRestore = client.refresh();
    const secondRestore = client.refresh();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(fetchImplementation).toHaveBeenCalledTimes(2);

    resolveRefresh?.(new Response(JSON.stringify(session), { status: 200 }));
    await expect(Promise.all([firstRestore, secondRestore])).resolves.toEqual([session, session]);
  });

  it("serializes refreshes from separate tabs with a storage lock", async () => {
    const values = new Map<string, string>();
    const localStorage = {
      getItem: (key: string) => values.get(key) ?? null,
      removeItem: (key: string) => void values.delete(key),
      setItem: (key: string, value: string) => void values.set(key, value),
    } as Storage;
    vi.stubGlobal("window", { localStorage });

    let resolveFirstRefresh: ((response: Response) => void) | undefined;
    const firstRefreshResponse = new Promise<Response>((resolve) => {
      resolveFirstRefresh = resolve;
    });
    const firstFetch = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ csrfToken: "first-csrf-token-123456789012345678901234" }), { status: 200 }),
      )
      .mockImplementationOnce(() => firstRefreshResponse);
    const secondFetch = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ csrfToken: "second-csrf-token-12345678901234567890123" }), { status: 200 }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify(session), { status: 200 }));
    const firstClient = createAuthBrowserClient({ baseUrl: "http://localhost:3001/api/v1", fetch: firstFetch });
    const secondClient = createAuthBrowserClient({ baseUrl: "http://localhost:3001/api/v1", fetch: secondFetch });

    const firstRestore = firstClient.refresh();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    const secondRestore = secondClient.refresh();
    await new Promise<void>((resolve) => setTimeout(resolve, 35));
    expect(secondFetch).not.toHaveBeenCalled();

    resolveFirstRefresh?.(new Response(JSON.stringify(session), { status: 200 }));
    await expect(Promise.all([firstRestore, secondRestore])).resolves.toEqual([session, session]);
    expect(secondFetch).toHaveBeenCalledTimes(2);
  });

  it("validates an in-memory access token without rotating the refresh cookie", async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(session.user), { status: 200 }),
    );
    const client = createAuthBrowserClient({ baseUrl: "http://localhost:3001/api/v1", fetch: fetchImplementation });

    await expect(client.getCurrentUser(session.accessToken)).resolves.toEqual(session.user);
    expect(fetchImplementation).toHaveBeenCalledWith(
      "http://localhost:3001/api/v1/auth/me",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: `Bearer ${session.accessToken}` }),
        method: "GET",
      }),
    );
  });

  it("retries a refresh after another tab wins token rotation", async () => {
    const fetchImplementation = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ csrfToken: "stale-csrf-token-123456789012345678901234" }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code: "AUTH_INVALID_SESSION", correlationId: "refresh-race", message: "Invalid session" }), { status: 401 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ csrfToken: "fresh-csrf-token-12345678901234567890123" }), { status: 200 }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify(session), { status: 200 }));
    const client = createAuthBrowserClient({ baseUrl: "http://localhost:3001/api/v1", fetch: fetchImplementation });

    await expect(client.refresh({ retryOnInvalidSession: true })).resolves.toEqual(session);
    expect(fetchImplementation).toHaveBeenNthCalledWith(
      4,
      "http://localhost:3001/api/v1/auth/refresh",
      expect.objectContaining({
        headers: expect.objectContaining({ "X-CSRF-Token": "fresh-csrf-token-12345678901234567890123" }),
      }),
    );
  });
});
