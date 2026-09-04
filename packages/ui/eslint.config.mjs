import { defineConfig, globalIgnores } from "eslint/config";

import baseConfig from "@technology-ecommerce/config-eslint/base";

export default defineConfig([
  ...baseConfig,
  globalIgnores(["dist/**"]),
]);
