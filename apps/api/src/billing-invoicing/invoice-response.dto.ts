import { ApiProperty } from "@nestjs/swagger";

import { INVOICE_ORIGINS, INVOICE_STATUSES, type InvoiceOrigin, type InvoiceStatus } from "./invoice.aggregate";

export class InvoiceLineResponseDto {
  @ApiProperty({ type: String, format: "uuid", nullable: true }) productId!: string | null;
  @ApiProperty({ minimum: 1 }) position!: number;
  @ApiProperty({ type: String, nullable: true }) skuSnapshot!: string | null;
  @ApiProperty() nameSnapshot!: string;
  @ApiProperty() descriptionSnapshot!: string;
  @ApiProperty({ minimum: 1 }) quantity!: number;
  @ApiProperty() unitPrice!: string;
  @ApiProperty() taxRate!: string;
  @ApiProperty() taxAmount!: string;
  @ApiProperty() lineSubtotal!: string;
  @ApiProperty() lineTotal!: string;
  @ApiProperty({ enum: ["USD"] }) currency!: string;
}

export class InvoiceResponseDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty() number!: string;
  @ApiProperty({ enum: INVOICE_ORIGINS }) origin!: InvoiceOrigin;
  @ApiProperty({ enum: INVOICE_STATUSES }) status!: InvoiceStatus;
  @ApiProperty({ format: "uuid" }) orderId!: string;
  @ApiProperty({ format: "uuid" }) customerId!: string;
  @ApiProperty({ type: String, format: "uuid", nullable: true }) createdByUserId!: string | null;
  @ApiProperty({ enum: ["USD"] }) currency!: string;
  @ApiProperty() subtotal!: string;
  @ApiProperty() shippingTotal!: string;
  @ApiProperty() taxTotal!: string;
  @ApiProperty() total!: string;
  @ApiProperty({ type: Object, additionalProperties: true }) issuerSnapshot!: Record<string, unknown>;
  @ApiProperty({ type: Object, additionalProperties: true }) customerSnapshot!: Record<string, unknown>;
  @ApiProperty({ type: [InvoiceLineResponseDto] }) lines!: InvoiceLineResponseDto[];
  @ApiProperty({ type: String, format: "date-time" }) createdAt!: string;
  @ApiProperty({ type: String, format: "date-time" }) updatedAt!: string;
  @ApiProperty({ type: String, format: "date-time" }) issuedAt!: string;
  @ApiProperty({ type: String, format: "date-time", nullable: true }) dueAt!: string | null;
  @ApiProperty({ type: String, format: "date-time", nullable: true }) paidAt!: string | null;
  @ApiProperty({ type: String, format: "date-time", nullable: true }) voidedAt!: string | null;
}
