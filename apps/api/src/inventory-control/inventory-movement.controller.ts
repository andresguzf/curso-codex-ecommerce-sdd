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
} from "../identity-access/authorization/index.js";
import { InventoryMovementService } from "./inventory-movement.service.js";
import {
  INVENTORY_MOVEMENT_TYPES,
  type InventoryMovementPage,
} from "./inventory-movement.types.js";

const uuidSchema = z.string().uuid();
const querySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(1_000_000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().min(1).max(200).optional(),
    type: z.enum(INVENTORY_MOVEMENT_TYPES).optional(),
    createdFrom: z.iso.datetime({ offset: true }).optional(),
    createdTo: z.iso.datetime({ offset: true }).optional(),
    sortBy: z.enum(["createdAt", "type", "quantityDelta", "balanceAfter"]).default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
  })
  .strict()
  .refine((query) => !query.createdFrom || !query.createdTo || Date.parse(query.createdFrom) <= Date.parse(query.createdTo), {
    message: "createdFrom must not be after createdTo",
  });

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
  @ApiQuery({ name: "page", required: false, type: Number, minimum: 1, maximum: 1_000_000 })
  @ApiQuery({ name: "pageSize", required: false, type: Number })
  @ApiQuery({ name: "search", required: false, type: String, description: "Literal match on movement reason, reference, or actor" })
  @ApiQuery({ name: "type", required: false, enum: INVENTORY_MOVEMENT_TYPES })
  @ApiQuery({ name: "createdFrom", required: false, type: String, format: "date-time" })
  @ApiQuery({ name: "createdTo", required: false, type: String, format: "date-time" })
  @ApiQuery({ name: "sortBy", required: false, enum: ["createdAt", "type", "quantityDelta", "balanceAfter"] })
  @ApiQuery({ name: "sortOrder", required: false, enum: ["asc", "desc"] })
  @ApiOkResponse({ type: InventoryMovementPageDto })
  @ApiBadRequestResponse({ description: "Invalid product identifier or pagination" })
  @ApiNotFoundResponse({ description: "Product not found" })
  list(
    @Param("productId") productId: string,
    @Query() query: Record<string, unknown>,
  ): Promise<InventoryMovementPage> {
    const parsedId = uuidSchema.safeParse(productId);
    const parsedQuery = querySchema.safeParse(query);
    if (!parsedId.success || !parsedQuery.success) {
      throw new BadRequestException({
        code: "REQUEST_VALIDATION_FAILED",
        message: "The request is invalid",
      });
    }
    return this.inventory.listByProduct(
      parsedId.data,
      parsedQuery.data,
    );
  }
}
