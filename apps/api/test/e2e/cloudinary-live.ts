/** Explicitly authorized, single-asset smoke test; never run by normal suites. */
import { randomUUID, createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { ConfigService } from "@nestjs/config";
import { chromium } from "@playwright/test";
import { v2 } from "cloudinary";
import { parse } from "dotenv";
import sharp from "sharp";
import { z } from "zod";

import { validateEnvironment, type EnvironmentVariables } from "../../src/config/environment.js";
import { CloudinaryImageStorage } from "../../src/product-catalog/image-storage/cloudinary-image-storage.js";
import type { StoredImage } from "../../src/product-catalog/image-storage/image-storage.port.js";

async function main() {
  if (process.env.CLOUDINARY_LIVE_TEST_AUTHORIZED !== "yes" || process.env.CLOUDINARY_LIVE_TEST_NONPRODUCTION !== "yes"
    || process.env.NODE_ENV === "production") throw new Error("Explicit nonproduction authorization required");
  const envBytes = await readFile(".env");
  const privateEnv = parse(envBytes);
  if (privateEnv.NODE_ENV === "production") throw new Error("Production configuration is prohibited");
  const credentials = z.object({ cloud_name: z.string().min(1), api_key: z.string().min(1), api_secret: z.string().min(1) }).parse({
    cloud_name: privateEnv.CLOUDINARY_CLOUD_NAME, api_key: privateEnv.CLOUDINARY_API_KEY, api_secret: privateEnv.CLOUDINARY_API_SECRET,
  });
  // Read-only account setting: don't infer folder mode from the console folder.
  const account = await v2.api.config({ ...credentials, settings: true, timeout: 30_000 });
  const mode = z.enum(["fixed", "dynamic"]).parse(account.settings?.folder_mode);
  const configuredMode = privateEnv.CLOUDINARY_FOLDER_MODE?.trim();
  if (["fixed", "dynamic"].includes(configuredMode ?? "") && configuredMode !== mode) throw new Error("Configured folder mode does not match account");
  // A blank/placeholder mode with local selection is not activation. Use the
  // verified account setting only in this one smoke test, without editing .env.
  const config = new ConfigService<EnvironmentVariables, true>(validateEnvironment({
    NODE_ENV: "test", DATABASE_URL: "postgresql://unused:unused@localhost/unused",
    IMAGE_STORAGE_CATALOG_PROVIDER: "local", CLOUDINARY_FOLDER_MODE: mode,
    CLOUDINARY_CLOUD_NAME: credentials.cloud_name, CLOUDINARY_API_KEY: credentials.api_key, CLOUDINARY_API_SECRET: credentials.api_secret,
  }));
  const storage = new CloudinaryImageStorage(config);
  if (process.env.CLOUDINARY_LIVE_TEST_VERIFY_OPERATION) {
    const operationId = z.uuid().parse(process.env.CLOUDINARY_LIVE_TEST_VERIFY_OPERATION);
    const absent = (await storage.findUpload(operationId)) === undefined;
    if (!absent) throw new Error("Temporary asset is still present");
    process.stdout.write(`${JSON.stringify({ test: "cloudinary-single-asset-cleanup", operationId, mode, folder: "codex-storefront", absent, environmentUnchanged: envBytes.equals(await readFile(".env")) })}\n`);
    return;
  }
  const id = randomUUID();
  const bytes = await sharp({ create: { width: 80, height: 60, channels: 3, background: "#123456" } }).png().toBuffer();
  let asset: StoredImage | undefined;
  let attempted = false;
  let rendered = false;
  let cleaned = false;
  let failure: unknown;
  try {
    attempted = true;
    asset = await storage.upload({ data: bytes, mimeType: "image/png" }, id);
    const verified = await storage.findUpload(id);
    if (!verified || verified.storageKey !== asset.storageKey) throw new Error("Temporary identity mismatch");
    const delivered = await storage.read(asset.storageKey);
    if (!delivered.data.equals(bytes)) throw new Error("Delivery bytes mismatch");
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage();
      await page.setContent(`<img alt="Temporary Cloudinary smoke test" src="${asset.url}" />`);
      await page.getByRole("img").evaluate(async (image: HTMLImageElement) => { await image.decode(); if (image.naturalWidth !== 80 || image.naturalHeight !== 60) throw new Error("Render dimensions mismatch"); });
      await page.screenshot({ path: "../../test-results/cloudinary-live/render.png" });
      rendered = true;
    } finally { await browser.close(); }
  } catch (error) { failure = error; } finally {
    // Lost upload responses still use only this exact UUID and ownership checks.
    try {
      if (attempted) {
        asset ??= await storage.findUpload(id);
        if (asset) {
          await storage.delete(asset.storageKey);
          cleaned = (await storage.findUpload(id)) === undefined;
          if (!cleaned) failure = new Error("Temporary cleanup not confirmed");
        }
      }
    } catch (error) { failure = error; }
    const environmentUnchanged = envBytes.equals(await readFile(".env"));
    if (!environmentUnchanged) failure = new Error("Environment file changed during test");
    process.stdout.write(`${JSON.stringify({ test: "cloudinary-single-asset", operationId: id, mode, folder: "codex-storefront", rendered, cleaned, sha256: createHash("sha256").update(bytes).digest("hex"), environmentUnchanged })}\n`);
  }
  if (failure) throw failure;
}
void main().catch((error: unknown) => {
  // SDK errors may include credentials, URLs or response bodies: never print them.
  process.stderr.write(`Cloudinary live test failed (${error instanceof Error ? error.name : "provider failure"}). No automatic upload retry.\n`);
  process.exitCode = 1;
});
