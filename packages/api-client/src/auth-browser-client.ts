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

export type AuthBrowserClient = ReturnType<typeof createAuthBrowserClient>;

export function createAuthBrowserClient({
  baseUrl,
  fetch: fetchImplementation = globalThis.fetch,
}: AuthBrowserClientOptions) {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");
  let csrfToken: string | undefined;

  async function parseError(response: Response): Promise<AuthApiError> {
    const result = apiErrorSchema.safeParse(await response.json().catch(() => null));
    return new AuthApiError(response.status, result.success ? result.data.code : undefined);
  }

  async function jsonRequest(path: string, init: RequestInit): Promise<unknown> {
    const response = await fetchImplementation(`${normalizedBaseUrl}${path}`, {
      ...init,
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
    });

    if (!response.ok) {
      throw await parseError(response);
    }

    return response.status === 204 ? undefined : response.json();
  }

  async function ensureCsrfToken(): Promise<string> {
    if (csrfToken) return csrfToken;
    const payload = await jsonRequest("/auth/csrf", { method: "GET" });
    csrfToken = csrfTokenResponseSchema.parse(payload).csrfToken;
    return csrfToken;
  }

  return {
    async login(input: LoginRequest): Promise<AuthSession> {
      const payload = await jsonRequest("/auth/login", {
        body: JSON.stringify(input),
        method: "POST",
      });
      return authSessionSchema.parse(payload);
    },

    async register(input: RegisterRequest): Promise<AuthenticatedUser> {
      const payload = await jsonRequest("/auth/register", {
        body: JSON.stringify(input),
        method: "POST",
      });
      return authenticatedUserSchema.parse(payload);
    },

    async refresh(): Promise<AuthSession> {
      const token = await ensureCsrfToken();
      const payload = await jsonRequest("/auth/refresh", {
        headers: { "X-CSRF-Token": token },
        method: "POST",
      });
      return authSessionSchema.parse(payload);
    },

    async logout(): Promise<void> {
      const token = await ensureCsrfToken();
      await jsonRequest("/auth/logout", {
        headers: { "X-CSRF-Token": token },
        method: "POST",
      });
      csrfToken = undefined;
    },
  };
}
