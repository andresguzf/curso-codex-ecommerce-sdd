import createClient from "openapi-fetch";

import type { paths } from "./generated/openapi";

export type ApiClientOptions = Parameters<typeof createClient<paths>>[0];
export type ApiClient = ReturnType<typeof createClient<paths>>;

export function createApiClient(options: ApiClientOptions): ApiClient {
  const baseUrl = options?.baseUrl === ""
    ? (typeof window === "undefined"
      ? process.env.API_REST_ORIGIN ?? "http://localhost:3001"
      : window.location.origin)
    : options?.baseUrl;
  return createClient<paths>({ ...options, baseUrl });
}
