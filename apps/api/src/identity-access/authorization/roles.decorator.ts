import { SetMetadata } from "@nestjs/common";

import type { AuthRole } from "../auth.types";

export const REQUIRED_ROLES_METADATA = "identity-access:required-roles";

export const Roles = (...roles: readonly AuthRole[]): MethodDecorator & ClassDecorator =>
  SetMetadata(REQUIRED_ROLES_METADATA, roles);
