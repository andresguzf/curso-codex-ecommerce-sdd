import { BadRequestException, Body, Controller, Get, Headers, Inject, Patch, Post, UseGuards } from "@nestjs/common";
import {
  ApiBadRequestResponse, ApiBearerAuth, ApiBody, ApiConsumes, ApiCreatedResponse, ApiForbiddenResponse, ApiNotFoundResponse,
  ApiOkResponse, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";

import type { AuthenticatedUser } from "../identity-access/auth.types";
import { AuthenticationGuard, CurrentUser, Roles, RolesGuard } from "../identity-access/authorization";
import { storeProfilePatchSchema } from "./store-profile.domain";
import { StoreProfileService, type StoreProfileResponse } from "./store-profile.service";
import { StoreLogoService } from "./store-logo.service";

class StoreAddressDto {
  @ApiProperty({ maxLength: 250 }) line1!: string;
  @ApiProperty({ type: String, nullable: true, maxLength: 250 }) line2!: string | null;
  @ApiProperty({ maxLength: 120 }) city!: string;
  @ApiProperty({ type: String, nullable: true, maxLength: 120 }) region!: string | null;
  @ApiProperty({ type: String, nullable: true, maxLength: 32 }) postalCode!: string | null;
  @ApiProperty({ pattern: "^[A-Z]{2}$" }) countryCode!: string;
}
class StoreContactDto {
  @ApiProperty({ type: String, nullable: true, format: "email" }) email!: string | null;
  @ApiProperty({ type: String, nullable: true, maxLength: 40 }) phone!: string | null;
}
class StoreLogoDto {
  @ApiProperty({ maxLength: 512 }) storageKey!: string;
  @ApiProperty({ format: "uri", maxLength: 2048 }) url!: string;
  @ApiProperty({ pattern: "^[0-9a-f]{64}$" }) sha256!: string;
}
class UploadedStoreLogoDto extends StoreLogoDto {
  @ApiProperty({ enum: ["image/png", "image/jpeg", "image/webp"] }) mimeType!: string;
  @ApiProperty({ minimum: 1 }) size!: number;
}
class StoreLogoReferenceDto {
  @ApiProperty({ maxLength: 512 }) storageKey!: string;
}
class StoreProfileDto {
  @ApiProperty({ enum: [1] }) id!: 1;
  @ApiProperty({ maxLength: 200 }) tradeName!: string;
  @ApiProperty({ maxLength: 200 }) legalName!: string;
  @ApiProperty({ maxLength: 80 }) taxIdentifier!: string;
  @ApiProperty({ type: StoreAddressDto }) address!: StoreAddressDto;
  @ApiProperty({ type: StoreContactDto }) contact!: StoreContactDto;
  @ApiProperty({ type: StoreLogoDto, nullable: true }) logo!: StoreLogoDto | null;
  @ApiProperty({ format: "date-time" }) createdAt!: string;
  @ApiProperty({ format: "date-time" }) updatedAt!: string;
}
class PatchStoreAddressDto {
  @ApiPropertyOptional({ maxLength: 250 }) line1?: string;
  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 250 }) line2?: string | null;
  @ApiPropertyOptional({ maxLength: 120 }) city?: string;
  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 120 }) region?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 32 }) postalCode?: string | null;
  @ApiPropertyOptional({ pattern: "^[A-Z]{2}$" }) countryCode?: string;
}
class PatchStoreContactDto {
  @ApiPropertyOptional({ type: String, nullable: true, format: "email" }) email?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 40 }) phone?: string | null;
}
class PatchStoreProfileDto {
  @ApiPropertyOptional({ maxLength: 200 }) tradeName?: string;
  @ApiPropertyOptional({ maxLength: 200 }) legalName?: string;
  @ApiPropertyOptional({ maxLength: 80 }) taxIdentifier?: string;
  @ApiPropertyOptional({ type: PatchStoreAddressDto }) address?: PatchStoreAddressDto;
  @ApiPropertyOptional({ type: PatchStoreContactDto }) contact?: PatchStoreContactDto;
  @ApiPropertyOptional({ type: StoreLogoReferenceDto, nullable: true }) logo?: StoreLogoReferenceDto | null;
}

@ApiTags("store-profile")
@ApiBearerAuth("access-token")
@ApiUnauthorizedResponse({ description: "Authentication required" })
@ApiForbiddenResponse({ description: "Role is not permitted" })
@UseGuards(AuthenticationGuard, RolesGuard)
@Controller("store-profile")
export class StoreProfileController {
  constructor(
    @Inject(StoreProfileService) private readonly profile: StoreProfileService,
    @Inject(StoreLogoService) private readonly logos: StoreLogoService,
  ) {}

  @Post("logo")
  @Roles("ADMIN")
  @ApiOperation({ operationId: "uploadStoreLogo", summary: "Upload an immutable store logo version" })
  @ApiConsumes("image/png", "image/jpeg", "image/webp")
  @ApiBody({ schema: { type: "string", format: "binary" } })
  @ApiCreatedResponse({ type: UploadedStoreLogoDto })
  @ApiBadRequestResponse({ description: "Invalid image type, signature or size" })
  upload(@CurrentUser() actor: AuthenticatedUser, @Body() data: unknown, @Headers("content-type") mimeType?: string) {
    return this.logos.upload(actor, data, mimeType);
  }

  @Get()
  @Roles("ADMIN", "BILLING")
  @ApiOperation({ operationId: "getStoreProfile", summary: "Read the current store issuer profile" })
  @ApiOkResponse({ type: StoreProfileDto })
  @ApiNotFoundResponse({ description: "Store profile has not yet been configured" })
  get(@CurrentUser() actor: AuthenticatedUser): Promise<StoreProfileResponse> {
    return this.profile.get(actor);
  }

  @Patch()
  @Roles("ADMIN")
  @ApiOperation({ operationId: "updateStoreProfile", summary: "Create or partially update the store issuer profile" })
  @ApiOkResponse({ type: StoreProfileDto })
  @ApiBadRequestResponse({ description: "Invalid profile or missing required fields on first save" })
  update(@CurrentUser() actor: AuthenticatedUser, @Body() body: PatchStoreProfileDto): Promise<StoreProfileResponse> {
    const parsed = storeProfilePatchSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException({
      code: "REQUEST_VALIDATION_FAILED",
      message: "The store profile update is invalid",
      details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), message: issue.message })),
    });
    return this.profile.update(actor, parsed.data);
  }
}
