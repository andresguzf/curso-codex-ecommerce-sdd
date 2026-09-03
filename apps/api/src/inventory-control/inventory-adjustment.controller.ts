import {
  BadRequestException,
  Body,
  Controller,
  Inject,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiProperty,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { z } from "zod";

import type { AuthenticatedUser } from "../identity-access/auth.types";
import {
  AuthenticationGuard,
  CurrentUser,
  Roles,
  RolesGuard,
} from "../identity-access/authorization";
import { InventoryAdjustmentService } from "./inventory-adjustment.service";
import type { InventoryAdjustmentResult } from "./inventory-adjustment.types";

const uuidSchema = z.string().uuid();
const inventoryAdjustmentSchema = z
  .object({
    quantityDelta: z
      .number()
      .int()
      .min(-2_147_483_647)
      .max(2_147_483_647)
      .refine((quantity) => quantity !== 0),
    reason: z.string().trim().min(1).max(500),
  })
  .strict();

class InventoryAdjustmentRequestDto {
  @ApiProperty({
    description: "Signed quantity to add to or remove from available inventory",
    example: -2,
    maximum: 2_147_483_647,
    minimum: -2_147_483_647,
    type: Number,
  })
  quantityDelta!: number;

  @ApiProperty({ example: "Damaged units removed during stock count", maxLength: 500 })
  reason!: string;
}

class InventoryAdjustmentMovementDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty({ format: "uuid" }) productId!: string;
  @ApiProperty({ enum: ["ADJUSTMENT"] }) type!: "ADJUSTMENT";
  @ApiProperty({ type: Number }) quantityDelta!: number;
  @ApiProperty({ minimum: 0, type: Number }) balanceAfter!: number;
  @ApiProperty() reason!: string;
  @ApiProperty({ format: "uuid" }) actorUserId!: string;
  @ApiProperty({ format: "date-time" }) createdAt!: string;
}

class InventoryAdjustmentResponseDto {
  @ApiProperty({ format: "uuid" }) productId!: string;
  @ApiProperty({ minimum: 0, type: Number }) availableQuantity!: number;
  @ApiProperty({ minimum: 0, type: Number }) version!: number;
  @ApiProperty({ format: "date-time" }) updatedAt!: string;
  @ApiProperty({ type: InventoryAdjustmentMovementDto })
  movement!: InventoryAdjustmentMovementDto;
}

@ApiTags("inventory")
@ApiBearerAuth("access-token")
@ApiUnauthorizedResponse({ description: "Invalid or expired session" })
@ApiForbiddenResponse({ description: "ADMIN role required" })
@Controller("inventory")
@UseGuards(AuthenticationGuard, RolesGuard)
@Roles("ADMIN")
export class InventoryAdjustmentController {
  constructor(
    @Inject(InventoryAdjustmentService)
    private readonly inventory: InventoryAdjustmentService,
  ) {}

  @Post(":productId/adjustments")
  @ApiOperation({
    operationId: "adjustProductInventory",
    summary: "Adjust available product inventory",
  })
  @ApiParam({ format: "uuid", name: "productId" })
  @ApiCreatedResponse({ type: InventoryAdjustmentResponseDto })
  @ApiBadRequestResponse({ description: "Invalid quantity or missing reason" })
  @ApiConflictResponse({
    description: "The adjustment would produce an invalid balance",
  })
  @ApiNotFoundResponse({ description: "Product not found" })
  adjust(
    @Param("productId") productId: string,
    @Body() body: InventoryAdjustmentRequestDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<InventoryAdjustmentResult> {
    const parsedId = uuidSchema.safeParse(productId);
    const parsedBody = inventoryAdjustmentSchema.safeParse(body);
    if (!parsedId.success || !parsedBody.success) {
      throw new BadRequestException({
        code: "REQUEST_VALIDATION_FAILED",
        message: "The request is invalid",
      });
    }

    return this.inventory.adjust(parsedId.data, parsedBody.data, actor.id);
  }
}
