import { defineConfig, globalIgnores } from "eslint/config";

import nextjsConfig from "@technology-ecommerce/config-eslint/nextjs";

export default defineConfig([
  ...nextjsConfig,
  globalIgnores([".next/**", ".next-invoice-e2e/**", ".next-image-delivery-e2e/**", "out/**", "dist/**", "next-env.d.ts"]),
]);
