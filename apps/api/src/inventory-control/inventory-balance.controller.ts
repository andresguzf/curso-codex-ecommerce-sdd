import { BadRequestException, Controller, Get, Inject, Query, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { z } from "zod";

import { AuthenticationGuard, Roles, RolesGuard } from "../identity-access/authorization/index.js";
import { InventoryBalanceService } from "./inventory-balance.service.js";
import type { InventoryBalancePage } from "./inventory-balance.types.js";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).max(1_000_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).max(200).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  availability: z.enum(["IN_STOCK", "OUT_OF_STOCK"]).optional(),
  sortBy: z.enum(["name", "sku", "status", "availableQuantity", "updatedAt"]).default("name"),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
}).strict();

class InventoryBalanceItemDto {
  @ApiProperty({ format: "uuid" }) productId!: string;
  @ApiProperty() sku!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: ["ACTIVE", "INACTIVE"] }) status!: "ACTIVE" | "INACTIVE";
  @ApiProperty({ minimum: 0 }) availableQuantity!: number;
  @ApiProperty({ minimum: 0 }) version!: number;
  @ApiProperty({ format: "date-time" }) updatedAt!: Date;
}

class InventoryBalancePageDto {
  @ApiProperty({ type: [InventoryBalanceItemDto] }) items!: InventoryBalanceItemDto[];
  @ApiProperty({ minimum: 1 }) page!: number;
  @ApiProperty({ minimum: 1, maximum: 100 }) pageSize!: number;
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
export class InventoryBalanceController {
  constructor(
    @Inject(InventoryBalanceService)
    private readonly inventory: InventoryBalanceService,
  ) {}

  @Get()
  @ApiOperation({ operationId: "listInventoryBalances", summary: "List paginated inventory balances" })
  @ApiQuery({ name: "page", required: false, type: Number, minimum: 1, maximum: 1_000_000 })
  @ApiQuery({ name: "pageSize", required: false, type: Number, minimum: 1, maximum: 100 })
  @ApiQuery({ name: "search", required: false, type: String, description: "Literal match on product name or SKU" })
  @ApiQuery({ name: "status", required: false, enum: ["ACTIVE", "INACTIVE"] })
  @ApiQuery({ name: "availability", required: false, enum: ["IN_STOCK", "OUT_OF_STOCK"] })
  @ApiQuery({ name: "sortBy", required: false, enum: ["name", "sku", "status", "availableQuantity", "updatedAt"] })
  @ApiQuery({ name: "sortOrder", required: false, enum: ["asc", "desc"] })
  @ApiOkResponse({ type: InventoryBalancePageDto })
  list(@Query() query: Record<string, unknown>): Promise<InventoryBalancePage> {
    const parsed = querySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException({
        code: "REQUEST_VALIDATION_FAILED",
        message: "Invalid inventory pagination",
      });
    }
    return this.inventory.list(parsed.data);
  }
}
