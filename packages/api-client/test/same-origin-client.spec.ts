import { afterEach, expect, it, vi } from "vitest";
import { createApiClient } from "../src/client";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it("uses the browser origin with an empty public base URL", async () => {
  vi.stubGlobal("window", { location: { origin: "https://store.example" } });
  const fetch = vi.fn(async () => new Response("{}", { headers: { "Content-Type": "application/json" } }));
  await createApiClient({ baseUrl: "", fetch }).GET("/api/v1/health");
  expect((fetch.mock.calls[0] as unknown as [Request])[0].url).toBe("https://store.example/api/v1/health");
});

it("uses the private API origin for server-side REST, preserving explicit local URLs", async () => {
  vi.stubEnv("API_REST_ORIGIN", "https://api.example");
  const fetch = vi.fn(async () => new Response("{}", { headers: { "Content-Type": "application/json" } }));
  await createApiClient({ baseUrl: "", fetch }).GET("/api/v1/health");
  expect((fetch.mock.calls[0] as unknown as [Request])[0].url).toBe("https://api.example/api/v1/health");
  await createApiClient({ baseUrl: "http://localhost:3001", fetch }).GET("/api/v1/health");
  expect((fetch.mock.calls[1] as unknown as [Request])[0].url).toBe("http://localhost:3001/api/v1/health");
});
