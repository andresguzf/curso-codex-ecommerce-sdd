import { Module } from "@nestjs/common";

import { AuthController } from "./auth.controller";
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
  exports: [AuthService, PasswordService, ...authorizationProviders],
})
export class AuthModule {}
