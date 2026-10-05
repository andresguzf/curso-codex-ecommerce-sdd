export {
  type AuthenticatedRequest,
  requireAuthenticatedUser,
} from "./authenticated-request.js";
export { AuthenticationGuard } from "./authentication.guard.js";
export { OptionalAuthenticationGuard } from "./optional-authentication.guard.js";
export { CurrentUser } from "./current-user.decorator.js";
export {
  OWNED_RESOURCE_TYPES,
  OWNERSHIP_METADATA,
  RequireOwnership,
  type OwnedResourceType,
  type OwnershipRequirement,
} from "./ownership.decorator.js";
export { OwnershipGuard } from "./ownership.guard.js";
export { ResourceOwnershipService } from "./resource-ownership.service.js";
export { Roles, REQUIRED_ROLES_METADATA } from "./roles.decorator.js";
export { RolesGuard } from "./roles.guard.js";
