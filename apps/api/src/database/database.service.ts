import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { sql } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import type { EnvironmentVariables } from "../config/environment";
import * as schema from "./schema";

export type DatabaseTransaction = Parameters<
  Parameters<NodePgDatabase<typeof schema>["transaction"]>[0]
>[0];

type DatabaseNameRow = Readonly<{
  databaseName: string;
}>;

@Injectable()
export class DatabaseService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(DatabaseService.name);
  private readonly pool: Pool;
  readonly client: NodePgDatabase<typeof schema>;

  constructor(
    @Inject(ConfigService) config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.pool = new Pool({
      application_name: "technology-ecommerce-api",
      connectionString: config.get("DATABASE_URL", { infer: true }),
      connectionTimeoutMillis: 5_000,
      idleTimeoutMillis: 30_000,
      max: 5,
    });
    this.client = drizzle({ client: this.pool, schema });

    this.pool.on("error", () => {
      this.logger.error(
        JSON.stringify({
          event: "database.pool.connection_lost",
          level: "error",
          message:
            "An idle PostgreSQL connection ended unexpectedly; the pool will reconnect on the next query",
          timestamp: new Date().toISOString(),
        }),
      );
    });
  }

  async onApplicationBootstrap(): Promise<void> {
    const databaseName = await this.getDatabaseName();
    this.logger.log(
      JSON.stringify({
        databaseName,
        event: "database.connection.verified",
        level: "info",
        timestamp: new Date().toISOString(),
      }),
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }

  async getDatabaseName(): Promise<string> {
    const result = await this.client.execute<DatabaseNameRow>(
      sql`select current_database() as "databaseName"`,
    );
    const databaseName = result.rows[0]?.databaseName;

    if (!databaseName) {
      throw new Error("PostgreSQL did not return the current database name");
    }

    return databaseName;
  }
}
