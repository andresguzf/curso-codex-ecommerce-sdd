import {
  apiErrorSchema,
  authenticatedUserSchema,
  authSessionSchema,
  csrfTokenResponseSchema,
  type AuthenticatedUser,
  type AuthSession,
  type LoginRequest,
  type RegisterRequest,
} from "@technology-ecommerce/api-schemas";

export class AuthApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(status: number, code = "AUTH_REQUEST_FAILED") {
    super(
      code === "AUTH_INVALID_CREDENTIALS"
        ? "El correo o la contraseña no son correctos."
        : "No pudimos completar la solicitud. Inténtalo nuevamente.",
    );
    this.name = "AuthApiError";
    this.code = code;
    this.status = status;
  }
}

type FetchImplementation = typeof fetch;

type AuthBrowserClientOptions = Readonly<{
  baseUrl: string;
  fetch?: FetchImplementation;
}>;

type RefreshOptions = Readonly<{
  /** Retry once when another tab won refresh-token rotation concurrently. */
  retryOnInvalidSession?: boolean;
}>;

const REFRESH_LOCK_TTL_MS = 10_000;
const REFRESH_LOCK_WAIT_MS = 25;
const REFRESH_LOCK_WAIT_LIMIT_MS = 15_000;

export type AuthBrowserClient = ReturnType<typeof createAuthBrowserClient>;

export function createAuthBrowserClient({
  baseUrl,
  fetch: fetchImplementation = globalThis.fetch,
}: AuthBrowserClientOptions) {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");
  let csrfToken: string | undefined;
  let refreshPromise: Promise<AuthSession> | undefined;
  const refreshLockKey = `technology-ecommerce:auth-refresh-lock:${normalizedBaseUrl}`;
  const refreshLockOwner = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  async function withRefreshLock<T>(operation: () => Promise<T>): Promise<T> {
    const browserWindow =
      typeof globalThis.window === "undefined" ? undefined : globalThis.window;
    if (!browserWindow) return operation();

    let storage: Storage;
    try {
      storage = browserWindow.localStorage;
      storage.getItem(refreshLockKey);
    } catch {
      return operation();
    }

    const waitUntil = Date.now() + REFRESH_LOCK_WAIT_LIMIT_MS;
    while (Date.now() < waitUntil) {
      const currentLock = readRefreshLock(storage, refreshLockKey);
      if (!currentLock || currentLock.expiresAt <= Date.now()) {
        const lock = JSON.stringify({
          expiresAt: Date.now() + REFRESH_LOCK_TTL_MS,
          owner: refreshLockOwner,
        });

        let acquired = false;
        try {
          storage.setItem(refreshLockKey, lock);
          acquired = storage.getItem(refreshLockKey) === lock;
        } catch {
          return operation();
        }

        if (acquired) {
          try {
            return await operation();
          } finally {
            try {
              if (storage.getItem(refreshLockKey) === lock) {
                storage.removeItem(refreshLockKey);
              }
            } catch {
              // A tab can lose storage access while a request is in flight.
            }
          }
        }
      }

      await new Promise<void>((resolve) => {
        globalThis.setTimeout(resolve, REFRESH_LOCK_WAIT_MS);
      });
    }

    return operation();
  }

  function readRefreshLock(
    storage: Storage,
    key: string,
  ): { expiresAt: number; owner: string } | undefined {
    const value = storage.getItem(key);
    if (!value) return undefined;

    try {
      const parsed: unknown = JSON.parse(value);
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        "expiresAt" in parsed &&
        typeof parsed.expiresAt === "number" &&
        "owner" in parsed &&
        typeof parsed.owner === "string"
      ) {
        return { expiresAt: parsed.expiresAt, owner: parsed.owner };
      }
    } catch {
      // Ignore malformed lock values and let the next tab claim the lock.
    }

    return undefined;
  }

  async function parseError(response: Response): Promise<AuthApiError> {
    const result = apiErrorSchema.safeParse(await response.json().catch(() => null));
    return new AuthApiError(response.status, result.success ? result.data.code : undefined);
  }

  async function jsonRequest(path: string, init: RequestInit): Promise<unknown> {
    const csrfTokenAtRequestStart = csrfToken;
    const response = await fetchImplementation(`${normalizedBaseUrl}${path}`, {
      ...init,
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
    });

    const responseCsrfToken = response.headers.get("X-CSRF-Token");
    // A session restore can overlap with login. Do not let an older response
    // overwrite the token already rotated by the newer request.
    if (responseCsrfToken && csrfToken === csrfTokenAtRequestStart) {
      csrfToken = responseCsrfToken;
    }

    if (!response.ok) {
      throw await parseError(response);
    }

    return response.status === 204 ? undefined : response.json();
  }

  async function ensureCsrfToken(force = false): Promise<string> {
    if (!force && csrfToken) return csrfToken;
    const csrfTokenAtRequestStart = csrfToken;
    const payload = await jsonRequest("/auth/csrf", { method: "GET" });
    const nextToken = csrfTokenResponseSchema.parse(payload).csrfToken;
    if (csrfToken === csrfTokenAtRequestStart) csrfToken = nextToken;
    return csrfToken ?? nextToken;
  }

  async function csrfRequest(path: string, init: RequestInit): Promise<unknown> {
    const send = (token: string) =>
      jsonRequest(path, {
        ...init,
        headers: { ...init.headers, "X-CSRF-Token": token },
      });

    try {
      return await send(await ensureCsrfToken());
    } catch (error) {
      // If a concurrent login/refresh rotated the CSRF cookie, recover once
      // with the token issued for the current cookie instead of surfacing a
      // misleading generic logout/refresh error to the user.
      if (!(error instanceof AuthApiError) || error.code !== "CSRF_TOKEN_INVALID") {
        throw error;
      }
      csrfToken = undefined;
      return send(await ensureCsrfToken(true));
    }
  }

  return {
    async login(input: LoginRequest): Promise<AuthSession> {
      const previousCsrfToken = csrfToken;
      const payload = await jsonRequest("/auth/login", {
        body: JSON.stringify(input),
        method: "POST",
      });
      // Login rotates the CSRF cookie. A token obtained by a pre-login
      // session restore must not be reused for the new session.
      if (csrfToken === previousCsrfToken) csrfToken = undefined;
      return authSessionSchema.parse(payload);
    },

    async register(input: RegisterRequest): Promise<AuthenticatedUser> {
      const payload = await jsonRequest("/auth/register", {
        body: JSON.stringify(input),
        method: "POST",
      });
      return authenticatedUserSchema.parse(payload);
    },

    async getCurrentUser(accessToken: string): Promise<AuthenticatedUser> {
      const payload = await jsonRequest("/auth/me", {
        headers: { Authorization: `Bearer ${accessToken}` },
        method: "GET",
      });
      return authenticatedUserSchema.parse(payload);
    },

    async refresh(options: RefreshOptions = {}): Promise<AuthSession> {
      if (refreshPromise) return refreshPromise;

      const request = withRefreshLock(async (): Promise<AuthSession> => {
        try {
          const payload = await csrfRequest("/auth/refresh", {
            method: "POST",
          });
          return authSessionSchema.parse(payload);
        } catch (error) {
          if (
            !options.retryOnInvalidSession ||
            !(error instanceof AuthApiError) ||
            error.code !== "AUTH_INVALID_SESSION"
          ) {
            throw error;
          }

          // A different tab may have just rotated the cookie. Give the
          // browser time to apply its Set-Cookie response, then retry with a
          // fresh CSRF token and the current refresh cookie.
          csrfToken = undefined;
          await new Promise<void>((resolve) => {
            globalThis.setTimeout(resolve, 50);
          });
          const retryPayload = await csrfRequest("/auth/refresh", {
            method: "POST",
          });
          return authSessionSchema.parse(retryPayload);
        }
      });

      refreshPromise = request.finally(() => {
        refreshPromise = undefined;
      });
      return refreshPromise;
    },

    async logout(): Promise<void> {
      await csrfRequest("/auth/logout", {
        method: "POST",
      });
      csrfToken = undefined;
    },
  };
}
