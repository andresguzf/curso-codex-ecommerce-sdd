import "reflect-metadata";
import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../../app.module.js";
import { CatalogImageRecoveryService } from "./catalog-image-recovery.service.js";
import { UPLOAD_ID_PATTERN } from "./catalog-asset-key.js";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const id = args[0]?.startsWith("--requeue=") ? args[0].slice(10) : undefined;
  if (args.length && (args.length !== 1 || !id || !UPLOAD_ID_PATTERN.test(id))) throw new Error("Invalid recovery arguments");
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  try {
    const recovery = app.get(CatalogImageRecoveryService);
    if (!recovery.cloud) throw new Error("Recovery requires private Cloudinary configuration");
    if (id && !await recovery.requeue(id)) throw new Error("Operation is not eligible for requeue");
    await recovery.reconcile();
    process.stdout.write("Catalog image reconciliation completed\n");
  } finally { await app.close(); }
}

void main().catch(() => {
  process.stderr.write("Catalog image reconciliation failed; check migrations, private configuration and operation eligibility\n");
  process.exitCode = 1;
});
