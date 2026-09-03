import { Inject, Injectable } from "@nestjs/common";
import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  isNull,
  or,
  sql,
} from "drizzle-orm";

import { DatabaseService } from "../database/database.service";
import { auditEntries } from "../database/schema/audit";
import {
  roleAssignments,
  sessions,
  users,
} from "../database/schema/identity";
import type {
  AdministrativeUser,
  CreateAdministrativeUser,
  UpdateAdministrativeUser,
  UserListQuery,
  UserPage,
} from "./user-administration.types";

export class LastActiveAdministratorError extends Error {
  constructor() {
    super("The last active administrator cannot be removed");
    this.name = "LastActiveAdministratorError";
  }
}

const administrativeUserSelection = {
  id: users.id,
  email: users.email,
  displayName: users.displayName,
  role: roleAssignments.role,
  status: users.status,
  createdAt: users.createdAt,
  updatedAt: users.updatedAt,
  deletedAt: users.deletedAt,
};

@Injectable()
export class UserAdministrationRepository {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  async list(query: UserListQuery): Promise<UserPage> {
    const conditions = [isNull(users.deletedAt)];

    if (query.search) {
      const pattern = `%${query.search}%`;
      conditions.push(
        or(ilike(users.email, pattern), ilike(users.displayName, pattern))!,
      );
    }

    if (query.role) {
      conditions.push(eq(roleAssignments.role, query.role));
    }

    if (query.status) {
      conditions.push(eq(users.status, query.status));
    }

    const where = and(...conditions);
    const sortColumn = {
      createdAt: users.createdAt,
      displayName: users.displayName,
      email: users.email,
      role: roleAssignments.role,
      status: users.status,
    }[query.sortBy];
    const order = query.sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn);
    const [{ totalItems = 0 } = {}] = await this.database.client
      .select({ totalItems: count() })
      .from(users)
      .innerJoin(roleAssignments, eq(roleAssignments.userId, users.id))
      .where(where);
    const items = await this.database.client
      .select(administrativeUserSelection)
      .from(users)
      .innerJoin(roleAssignments, eq(roleAssignments.userId, users.id))
      .where(where)
      .orderBy(order, asc(users.id))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize);

    return {
      items,
      page: query.page,
      pageSize: query.pageSize,
      totalItems,
      totalPages: Math.ceil(totalItems / query.pageSize),
    };
  }

  async findById(userId: string): Promise<AdministrativeUser | undefined> {
    const [user] = await this.database.client
      .select(administrativeUserSelection)
      .from(users)
      .innerJoin(roleAssignments, eq(roleAssignments.userId, users.id))
      .where(and(eq(users.id, userId), isNull(users.deletedAt)))
      .limit(1);

    return user;
  }

  async create(
    input: CreateAdministrativeUser,
    actorUserId: string,
  ): Promise<AdministrativeUser> {
    return this.database.client.transaction(async (transaction) => {
      const [user] = await transaction
        .insert(users)
        .values({
          displayName: input.displayName,
          email: input.email,
          passwordHash: input.passwordHash,
          status: input.status,
        })
        .returning({
          createdAt: users.createdAt,
          deletedAt: users.deletedAt,
          displayName: users.displayName,
          email: users.email,
          id: users.id,
          status: users.status,
          updatedAt: users.updatedAt,
        });

      if (!user) {
        throw new Error("PostgreSQL did not return the created user");
      }

      const [assignment] = await transaction
        .insert(roleAssignments)
        .values({
          assignedByUserId: actorUserId,
          role: input.role,
          userId: user.id,
        })
        .returning({ role: roleAssignments.role });

      if (!assignment) {
        throw new Error("PostgreSQL did not return the assigned role");
      }

      const createdUser = { ...user, role: assignment.role };
      await transaction.insert(auditEntries).values({
        action: "USER_CREATED",
        actorUserId,
        changes: { after: this.auditSnapshot(createdUser) },
        entityId: user.id,
        entityType: "USER",
      });

      return createdUser;
    });
  }

  async update(
    userId: string,
    input: UpdateAdministrativeUser,
    actorUserId: string,
  ): Promise<AdministrativeUser | undefined> {
    return this.database.client.transaction(async (transaction) => {
      await transaction.execute(
        sql`select pg_advisory_xact_lock(hashtext('identity-active-admin'))`,
      );
      const [current] = await transaction
        .select(administrativeUserSelection)
        .from(users)
        .innerJoin(roleAssignments, eq(roleAssignments.userId, users.id))
        .where(and(eq(users.id, userId), isNull(users.deletedAt)))
        .limit(1);

      if (!current) {
        return undefined;
      }

      const nextRole = input.role ?? current.role;
      const nextStatus = input.status ?? current.status;

      if (
        current.role === "ADMIN" &&
        current.status === "ACTIVE" &&
        (nextRole !== "ADMIN" || nextStatus !== "ACTIVE")
      ) {
        await this.ensureAnotherActiveAdministrator(transaction, current.id);
      }

      const now = new Date();
      const [updatedUser] = await transaction
        .update(users)
        .set({
          ...(input.displayName === undefined
            ? {}
            : { displayName: input.displayName }),
          ...(input.email === undefined ? {} : { email: input.email }),
          ...(input.passwordHash === undefined
            ? {}
            : { passwordHash: input.passwordHash }),
          ...(input.status === undefined ? {} : { status: input.status }),
          updatedAt: now,
        })
        .where(eq(users.id, userId))
        .returning({
          createdAt: users.createdAt,
          deletedAt: users.deletedAt,
          displayName: users.displayName,
          email: users.email,
          id: users.id,
          status: users.status,
          updatedAt: users.updatedAt,
        });

      if (!updatedUser) {
        throw new Error("PostgreSQL did not return the updated user");
      }

      let role = current.role;

      if (input.role !== undefined && input.role !== current.role) {
        const [assignment] = await transaction
          .update(roleAssignments)
          .set({
            assignedByUserId: actorUserId,
            role: input.role,
            updatedAt: now,
          })
          .where(eq(roleAssignments.userId, userId))
          .returning({ role: roleAssignments.role });
        role = assignment?.role ?? current.role;
      }

      if (nextStatus !== "ACTIVE") {
        await transaction
          .update(sessions)
          .set({ revokedAt: now, updatedAt: now })
          .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
      }

      const result = { ...updatedUser, role };
      await transaction.insert(auditEntries).values({
        action: "USER_UPDATED",
        actorUserId,
        changes: {
          after: this.auditSnapshot(result),
          before: this.auditSnapshot(current),
        },
        entityId: userId,
        entityType: "USER",
      });

      return result;
    });
  }

  async softDelete(userId: string, actorUserId: string): Promise<boolean> {
    return this.database.client.transaction(async (transaction) => {
      await transaction.execute(
        sql`select pg_advisory_xact_lock(hashtext('identity-active-admin'))`,
      );
      const [current] = await transaction
        .select(administrativeUserSelection)
        .from(users)
        .innerJoin(roleAssignments, eq(roleAssignments.userId, users.id))
        .where(and(eq(users.id, userId), isNull(users.deletedAt)))
        .limit(1);

      if (!current) {
        return false;
      }

      if (current.role === "ADMIN" && current.status === "ACTIVE") {
        await this.ensureAnotherActiveAdministrator(transaction, current.id);
      }

      const now = new Date();
      await transaction
        .update(users)
        .set({ deletedAt: now, status: "INACTIVE", updatedAt: now })
        .where(eq(users.id, userId));
      await transaction
        .update(sessions)
        .set({ revokedAt: now, updatedAt: now })
        .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
      await transaction.insert(auditEntries).values({
        action: "USER_DELETED",
        actorUserId,
        changes: {
          after: {
            ...this.auditSnapshot(current),
            deletedAt: now.toISOString(),
            status: "INACTIVE",
          },
          before: this.auditSnapshot(current),
        },
        entityId: userId,
        entityType: "USER",
      });

      return true;
    });
  }

  private async ensureAnotherActiveAdministrator(
    transaction: Parameters<
      Parameters<typeof this.database.client.transaction>[0]
    >[0],
    excludedUserId: string,
  ): Promise<void> {
    const [{ activeAdministrators = 0 } = {}] = await transaction
      .select({ activeAdministrators: count() })
      .from(users)
      .innerJoin(roleAssignments, eq(roleAssignments.userId, users.id))
      .where(
        and(
          eq(roleAssignments.role, "ADMIN"),
          eq(users.status, "ACTIVE"),
          isNull(users.deletedAt),
          sql`${users.id} <> ${excludedUserId}`,
        ),
      );

    if (activeAdministrators === 0) {
      throw new LastActiveAdministratorError();
    }
  }

  private auditSnapshot(user: AdministrativeUser): Record<string, unknown> {
    return {
      deletedAt: user.deletedAt?.toISOString() ?? null,
      displayName: user.displayName,
      email: user.email,
      role: user.role,
      status: user.status,
    };
  }
}
