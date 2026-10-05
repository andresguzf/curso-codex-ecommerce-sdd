import { Module } from "@nestjs/common";

import { AuthController } from "./auth.controller.js";
import { IdentitySummaryReader } from "./identity-summary.reader.js";
import { AuthCookieService } from "./auth-cookie.service.js";
import { AuthRepository } from "./auth.repository.js";
import { AuthService } from "./auth.service.js";
import { AuthTokenService } from "./auth-token.service.js";
import { AuthenticationAttemptLimiter } from "./authentication-attempt-limiter.service.js";
import { PasswordService } from "./password/password.service.js";
import { CsrfGuard } from "./csrf.guard.js";
import { UserAdministrationController } from "./user-administration.controller.js";
import { UserAdministrationRepository } from "./user-administration.repository.js";
import { UserAdministrationService } from "./user-administration.service.js";
import {
  AuthenticationGuard,
  OptionalAuthenticationGuard,
  OwnershipGuard,
  ResourceOwnershipService,
  RolesGuard,
} from "./authorization/index.js";

const authorizationProviders = [
  AuthenticationGuard,
  OptionalAuthenticationGuard,
  OwnershipGuard,
  ResourceOwnershipService,
  RolesGuard,
];

@Module({
  controllers: [AuthController, UserAdministrationController],
  providers: [
    AuthRepository,
    IdentitySummaryReader,
    AuthService,
    AuthTokenService,
    AuthCookieService,
    AuthenticationAttemptLimiter,
    CsrfGuard,
    PasswordService,
    UserAdministrationRepository,
    UserAdministrationService,
    ...authorizationProviders,
  ],
  exports: [AuthService, PasswordService, IdentitySummaryReader, ...authorizationProviders],
})
export class AuthModule {}
