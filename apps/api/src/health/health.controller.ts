import { Controller, Get, Inject } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiProperty, ApiTags } from "@nestjs/swagger";

import { DatabaseService } from "../database/database.service";

class HealthDatabaseResponseDto {
  @ApiProperty({ enum: ["up"], example: "up" })
  status!: "up";

  @ApiProperty({ example: "ecommerce_backend_sdd" })
  name!: string;
}

export class HealthResponseDto {
  @ApiProperty({ enum: ["ok"], example: "ok" })
  status!: "ok";

  @ApiProperty({ enum: ["api"], example: "api" })
  service!: "api";

  @ApiProperty({ type: HealthDatabaseResponseDto })
  database!: HealthDatabaseResponseDto;
}

@ApiTags("health")
@Controller("health")
export class HealthController {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  @Get()
  @ApiOperation({
    operationId: "getHealth",
    summary: "Check API and PostgreSQL readiness",
  })
  @ApiOkResponse({ type: HealthResponseDto })
  async getHealth(): Promise<HealthResponseDto> {
    const databaseName = await this.database.getDatabaseName();

    return {
      status: "ok",
      service: "api",
      database: {
        status: "up",
        name: databaseName,
      },
    };
  }
}
