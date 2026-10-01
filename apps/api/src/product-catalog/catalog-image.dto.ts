import { ApiProperty } from "@nestjs/swagger";

/** Public projection: rendering metadata, without persistence timestamps. */
export class CatalogImageDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty() storageKey!: string;
  @ApiProperty() url!: string;
  @ApiProperty({ minLength: 1 }) altText!: string;
  @ApiProperty() isPrimary!: boolean;
  @ApiProperty({ type: "integer", minimum: 0 }) sortOrder!: number;
  @ApiProperty({ type: "integer", nullable: true, minimum: 1 }) width!: number | null;
  @ApiProperty({ type: "integer", nullable: true, minimum: 1 }) height!: number | null;
  @ApiProperty({ type: String, nullable: true }) mimeType!: string | null;
}
