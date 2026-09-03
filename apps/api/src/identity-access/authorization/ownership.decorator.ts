import { SetMetadata } from "@nestjs/common";

import type { AuthRole } from "../auth.types";

export const OWNERSHIP_METADATA = "identity-access:ownership";

export const OWNED_RESOURCE_TYPES = ["USER", "CART", "ORDER", "INVOICE"] as const;

export type OwnedResourceType = (typeof OWNED_RESOURCE_TYPES)[number];

export type OwnershipRequirement = Readonly<{
  resourceType: OwnedResourceType;
  resourceIdParameter: string;
  bypassRoles?: readonly AuthRole[];
}>;

export const RequireOwnership = (
  requirement: OwnershipRequirement,
): MethodDecorator & ClassDecorator => SetMetadata(OWNERSHIP_METADATA, requirement);
