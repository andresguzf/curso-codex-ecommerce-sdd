import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  Param,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProperty,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { z } from "zod";

import {
  AuthenticationGuard,
  Roles,
  RolesGuard,
} from "../identity-access/authorization";
import { InventoryMovementService } from "./inventory-movement.service";
import {
  INVENTORY_MOVEMENT_TYPES,
  type InventoryMovementPage,
} from "./inventory-movement.types";

const uuidSchema = z.string().uuid();
const paginationSchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

class InventoryMovementActorDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty() displayName!: string;
  @ApiProperty({ format: "email" }) email!: string;
}

class InventoryMovementItemDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty({ format: "uuid" }) productId!: string;
  @ApiProperty({ enum: INVENTORY_MOVEMENT_TYPES }) type!: (typeof INVENTORY_MOVEMENT_TYPES)[number];
  @ApiProperty({ type: Number }) quantityDelta!: number;
  @ApiProperty({ minimum: 0, type: Number }) balanceAfter!: number;
  @ApiProperty() reason!: string;
  @ApiProperty({ nullable: true, type: String }) referenceType!: string | null;
  @ApiProperty({ nullable: true, type: String }) referenceId!: string | null;
  @ApiProperty({ nullable: true, type: InventoryMovementActorDto }) actor!: InventoryMovementActorDto | null;
  @ApiProperty({ format: "date-time" }) createdAt!: string;
}

class InventoryMovementPageDto {
  @ApiProperty({ type: [InventoryMovementItemDto] }) items!: InventoryMovementItemDto[];
  @ApiProperty({ minimum: 1 }) page!: number;
  @ApiProperty({ maximum: 100, minimum: 1 }) pageSize!: number;
  @ApiProperty({ minimum: 0 }) totalItems!: number;
  @ApiProperty({ minimum: 0 }) totalPages!: number;
}

@ApiTags("inventory")
@ApiBearerAuth("access-token")
@ApiUnauthorizedResponse({ description: "Invalid or expired session" })
@ApiForbiddenResponse({ description: "ADMIN role required" })
@Controller("inventory")
@UseGuards(AuthenticationGuard, RolesGuard)
@Roles("ADMIN")
export class InventoryMovementController {
  constructor(
    @Inject(InventoryMovementService)
    private readonly inventory: InventoryMovementService,
  ) {}

  @Get(":productId/movements")
  @ApiOperation({
    operationId: "listProductInventoryMovements",
    summary: "List a product's auditable inventory movements",
  })
  @ApiParam({ format: "uuid", name: "productId" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "pageSize", required: false, type: Number })
  @ApiOkResponse({ type: InventoryMovementPageDto })
  @ApiBadRequestResponse({ description: "Invalid product identifier or pagination" })
  @ApiNotFoundResponse({ description: "Product not found" })
  list(
    @Param("productId") productId: string,
    @Query() query: Record<string, unknown>,
  ): Promise<InventoryMovementPage> {
    const parsedId = uuidSchema.safeParse(productId);
    const parsedQuery = paginationSchema.safeParse(query);
    if (!parsedId.success || !parsedQuery.success) {
      throw new BadRequestException({
        code: "REQUEST_VALIDATION_FAILED",
        message: "The request is invalid",
      });
    }
    return this.inventory.listByProduct(
      parsedId.data,
      parsedQuery.data.page,
      parsedQuery.data.pageSize,
    );
  }
}
