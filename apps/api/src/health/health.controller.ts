import { Controller, Get } from "@nestjs/common";

import { DatabaseService } from "../database/database.service";

type HealthResponse = Readonly<{
  status: "ok";
  service: "api";
  database: Readonly<{
    status: "up";
    name: string;
  }>;
}>;

@Controller("health")
export class HealthController {
  constructor(private readonly database: DatabaseService) {}

  @Get()
  async getHealth(): Promise<HealthResponse> {
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
