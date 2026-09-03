import { Inject, Injectable } from "@nestjs/common";
import { and, eq, gt, isNull, sql } from "drizzle-orm";

import { DatabaseService } from "../database/database.service";
import {
  roleAssignments,
  sessions,
  users,
} from "../database/schema/identity";
import type { AuthenticatedUser, SessionUser } from "./auth.types";

type LoginUser = AuthenticatedUser &
  Readonly<{
    passwordHash: string;
    status: "ACTIVE" | "INACTIVE" | "BLOCKED";
    deletedAt: Date | null;
  }>;

@Injectable()
export class AuthRepository {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  async findUserForLogin(email: string): Promise<LoginUser | undefined> {
    const [user] = await this.database.client
      .select({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        passwordHash: users.passwordHash,
        status: users.status,
        deletedAt: users.deletedAt,
        role: roleAssignments.role,
      })
      .from(users)
      .innerJoin(roleAssignments, eq(roleAssignments.userId, users.id))
      .where(eq(sql<string>`lower(${users.email})`, email))
      .limit(1);

    return user;
  }

  async updatePasswordHash(userId: string, passwordHash: string): Promise<void> {
    await this.database.client
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, userId));
  }

  async createCustomer(input: {
    email: string;
    displayName: string;
    passwordHash: string;
  }): Promise<AuthenticatedUser> {
    return this.database.client.transaction(async (transaction) => {
      const [user] = await transaction
        .insert(users)
        .values({
          email: input.email,
          displayName: input.displayName,
          passwordHash: input.passwordHash,
          status: "ACTIVE",
        })
        .returning({
          id: users.id,
          email: users.email,
          displayName: users.displayName,
        });

      if (!user) {
        throw new Error("PostgreSQL did not return the registered customer");
      }

      const [assignment] = await transaction
        .insert(roleAssignments)
        .values({ userId: user.id, role: "CUSTOMER" })
        .returning({ role: roleAssignments.role });

      if (!assignment) {
        throw new Error("PostgreSQL did not return the customer role assignment");
      }

      return { ...user, role: assignment.role };
    });
  }

  async createSession(input: {
    id: string;
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    userAgent?: string;
    ipAddress?: string;
  }): Promise<void> {
    await this.database.client.insert(sessions).values(input);
  }

  async findSessionByRefreshToken(
    sessionId: string,
    tokenHash: string,
  ): Promise<SessionUser | undefined> {
    return this.findSession(
      and(eq(sessions.id, sessionId), eq(sessions.tokenHash, tokenHash)),
    );
  }

  async findSessionById(sessionId: string): Promise<SessionUser | undefined> {
    return this.findSession(eq(sessions.id, sessionId));
  }

  async rotateRefreshToken(input: {
    sessionId: string;
    previousTokenHash: string;
    nextTokenHash: string;
    now: Date;
  }): Promise<boolean> {
    const [updatedSession] = await this.database.client
      .update(sessions)
      .set({ tokenHash: input.nextTokenHash, updatedAt: input.now })
      .where(
        and(
          eq(sessions.id, input.sessionId),
          eq(sessions.tokenHash, input.previousTokenHash),
          isNull(sessions.revokedAt),
          gt(sessions.expiresAt, input.now),
        ),
      )
      .returning({ id: sessions.id });

    return Boolean(updatedSession);
  }

  async revokeByRefreshToken(
    sessionId: string,
    tokenHash: string,
    revokedAt: Date,
  ): Promise<void> {
    await this.database.client
      .update(sessions)
      .set({ revokedAt, updatedAt: revokedAt })
      .where(
        and(
          eq(sessions.id, sessionId),
          eq(sessions.tokenHash, tokenHash),
          isNull(sessions.revokedAt),
        ),
      );
  }

  private async findSession(
    condition: ReturnType<typeof eq> | ReturnType<typeof and>,
  ): Promise<SessionUser | undefined> {
    const [session] = await this.database.client
      .select({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        role: roleAssignments.role,
        userStatus: users.status,
        userDeletedAt: users.deletedAt,
        sessionId: sessions.id,
        sessionExpiresAt: sessions.expiresAt,
        sessionRevokedAt: sessions.revokedAt,
      })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .innerJoin(roleAssignments, eq(roleAssignments.userId, users.id))
      .where(condition)
      .limit(1);

    return session;
  }
}
