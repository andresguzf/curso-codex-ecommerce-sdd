import createClient from "openapi-fetch";

import type { paths } from "./generated/openapi";

export type ApiClientOptions = Parameters<typeof createClient<paths>>[0];
export type ApiClient = ReturnType<typeof createClient<paths>>;

export function createApiClient(options: ApiClientOptions): ApiClient {
  return createClient<paths>(options);
}
