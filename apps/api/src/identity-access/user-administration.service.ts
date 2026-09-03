import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import type { AuthRole } from "./auth.types";
import { PasswordService } from "./password/password.service";
import {
  LastActiveAdministratorError,
  UserAdministrationRepository,
} from "./user-administration.repository";
import type {
  AdministrativeUser,
  UserListQuery,
  UserPage,
  UserStatus,
} from "./user-administration.types";

@Injectable()
export class UserAdministrationService {
  constructor(
    @Inject(UserAdministrationRepository)
    private readonly repository: UserAdministrationRepository,
    @Inject(PasswordService) private readonly passwords: PasswordService,
  ) {}

  list(query: UserListQuery): Promise<UserPage> {
    return this.repository.list(query);
  }

  async get(userId: string): Promise<AdministrativeUser> {
    const user = await this.repository.findById(userId);

    if (!user) {
      throw this.notFound();
    }

    return user;
  }

  async create(
    input: {
      email: string;
      displayName: string;
      password: string;
      role: AuthRole;
      status: UserStatus;
    },
    actorUserId: string,
  ): Promise<AdministrativeUser> {
    try {
      return await this.repository.create(
        {
          displayName: input.displayName.trim(),
          email: input.email.trim().toLowerCase(),
          passwordHash: await this.passwords.hash(input.password),
          role: input.role,
          status: input.status,
        },
        actorUserId,
      );
    } catch (error) {
      this.rethrowDomainError(error);
    }
  }

  async update(
    userId: string,
    input: {
      email?: string;
      displayName?: string;
      password?: string;
      role?: AuthRole;
      status?: UserStatus;
    },
    actorUserId: string,
  ): Promise<AdministrativeUser> {
    try {
      const user = await this.repository.update(
        userId,
        {
          ...(input.displayName === undefined
            ? {}
            : { displayName: input.displayName.trim() }),
          ...(input.email === undefined
            ? {}
            : { email: input.email.trim().toLowerCase() }),
          ...(input.password === undefined
            ? {}
            : { passwordHash: await this.passwords.hash(input.password) }),
          ...(input.role === undefined ? {} : { role: input.role }),
          ...(input.status === undefined ? {} : { status: input.status }),
        },
        actorUserId,
      );

      if (!user) {
        throw this.notFound();
      }

      return user;
    } catch (error) {
      this.rethrowDomainError(error);
    }
  }

  async delete(userId: string, actorUserId: string): Promise<void> {
    try {
      if (!(await this.repository.softDelete(userId, actorUserId))) {
        throw this.notFound();
      }
    } catch (error) {
      this.rethrowDomainError(error);
    }
  }

  private rethrowDomainError(error: unknown): never {
    if (error instanceof LastActiveAdministratorError) {
      throw new ConflictException({
        code: "USER_LAST_ACTIVE_ADMIN",
        message: "The system must retain at least one active administrator",
      });
    }

    if (this.isUniqueEmailViolation(error)) {
      throw new ConflictException({
        code: "USER_EMAIL_ALREADY_REGISTERED",
        message: "An account with this email already exists",
      });
    }

    throw error;
  }

  private notFound(): NotFoundException {
    return new NotFoundException({
      code: "USER_NOT_FOUND",
      message: "The requested user does not exist",
    });
  }

  private isUniqueEmailViolation(error: unknown): boolean {
    let current: unknown = error;

    for (let depth = 0; depth < 3 && current; depth += 1) {
      if (
        typeof current === "object" &&
        "code" in current &&
        current.code === "23505" &&
        "constraint" in current &&
        current.constraint === "users_email_unique"
      ) {
        return true;
      }

      current =
        typeof current === "object" && "cause" in current
          ? current.cause
          : undefined;
    }

    return false;
  }
}
