export {
  type AuthenticatedRequest,
  requireAuthenticatedUser,
} from "./authenticated-request";
export { AuthenticationGuard } from "./authentication.guard";
export { OptionalAuthenticationGuard } from "./optional-authentication.guard";
export { CurrentUser } from "./current-user.decorator";
export {
  OWNED_RESOURCE_TYPES,
  OWNERSHIP_METADATA,
  RequireOwnership,
  type OwnedResourceType,
  type OwnershipRequirement,
} from "./ownership.decorator";
export { OwnershipGuard } from "./ownership.guard";
export { ResourceOwnershipService } from "./resource-ownership.service";
export { Roles, REQUIRED_ROLES_METADATA } from "./roles.decorator";
export { RolesGuard } from "./roles.guard";
