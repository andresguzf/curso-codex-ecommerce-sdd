import { Module } from "@nestjs/common";

import { AuthController } from "./auth.controller";
import { IdentitySummaryReader } from "./identity-summary.reader";
import { AuthCookieService } from "./auth-cookie.service";
import { AuthRepository } from "./auth.repository";
import { AuthService } from "./auth.service";
import { AuthTokenService } from "./auth-token.service";
import { AuthenticationAttemptLimiter } from "./authentication-attempt-limiter.service";
import { PasswordService } from "./password/password.service";
import { CsrfGuard } from "./csrf.guard";
import { UserAdministrationController } from "./user-administration.controller";
import { UserAdministrationRepository } from "./user-administration.repository";
import { UserAdministrationService } from "./user-administration.service";
import {
  AuthenticationGuard,
  OptionalAuthenticationGuard,
  OwnershipGuard,
  ResourceOwnershipService,
  RolesGuard,
} from "./authorization";

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
