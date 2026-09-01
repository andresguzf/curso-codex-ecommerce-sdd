import { defineConfig, globalIgnores } from "eslint/config";

import nextjsConfig from "@technology-ecommerce/config-eslint/nextjs";

export default defineConfig([
  ...nextjsConfig,
  globalIgnores([".next/**", "out/**", "dist/**", "next-env.d.ts"]),
]);
