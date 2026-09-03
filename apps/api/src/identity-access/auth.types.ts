export const AUTH_ROLES = ["CUSTOMER", "ADMIN", "BILLING"] as const;

export type AuthRole = (typeof AUTH_ROLES)[number];

export type AuthenticatedUser = Readonly<{
  id: string;
  email: string;
  displayName: string;
  role: AuthRole;
}>;

export type SessionUser = AuthenticatedUser &
  Readonly<{
    sessionId: string;
    sessionExpiresAt: Date;
    sessionRevokedAt: Date | null;
    userStatus: "ACTIVE" | "INACTIVE" | "BLOCKED";
    userDeletedAt: Date | null;
  }>;

export type AuthSession = Readonly<{
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
  accessTokenExpiresAt: string;
  sessionExpiresAt: string;
  user: AuthenticatedUser;
}>;

export type PublicAuthSession = Omit<AuthSession, "refreshToken">;
