import { runDevelopmentSeed } from "./development-seed.js";
import { parseSeedEnvironment } from "./seed-config.js";

type SeedLogger = Pick<Console, "info" | "error">;

/** Allowlisted logs only: never serialize environment, accounts or error details. */
export async function executeDevelopmentSeed(
  environment: Record<string, string | undefined>,
  logger: SeedLogger = console,
  run = runDevelopmentSeed,
): Promise<0 | 1> {
  try {
    const result = await run(parseSeedEnvironment(environment));
    logger.info(JSON.stringify({
      event: "database.seed.completed", level: "info",
      products: result.products, productImages: result.productImages,
      roleAssignments: result.roleAssignments, storeProfiles: result.storeProfiles, users: result.users,
    }));
    return 0;
  } catch (error: unknown) {
    logger.error(JSON.stringify({
      event: "database.seed.failed", level: "error",
      errorType: error instanceof Error ? error.name : "UnknownError",
    }));
    return 1;
  }
}
