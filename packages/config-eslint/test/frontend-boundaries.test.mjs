import assert from "node:assert/strict";
import test from "node:test";

import { Linter } from "eslint";

import { frontendDependencyBoundaries } from "../frontend-boundaries.mjs";

const linter = new Linter({ configType: "flat" });
const testConfig = [
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
    },
  },
  frontendDependencyBoundaries,
];

function lintImport(source) {
  return linter.verify(source, testConfig, {
    filename: "apps/storefront/src/features/catalog/example.js",
  });
}

test("rechaza imports del API interno y de persistencia desde un frontend", () => {
  const forbiddenImports = [
    'import "@technology-ecommerce/api";',
    'import "@technology-ecommerce/api/src/database/schema";',
    'import "../../../../api/src/database/schema";',
    'import "drizzle-orm/pg-core";',
    'import "@prisma/client";',
    'import "pg";',
  ];

  for (const source of forbiddenImports) {
    const messages = lintImport(source);

    assert.equal(messages.length, 1, `Se esperaba rechazar: ${source}`);
    assert.equal(messages[0].ruleId, "no-restricted-imports");
    assert.equal(messages[0].severity, 2);
  }
});

test("permite los contratos públicos compartidos del frontend", () => {
  const messages = lintImport(`
    import { createApiClient } from "@technology-ecommerce/api-client";
    import { healthResponseSchema } from "@technology-ecommerce/api-schemas";
    import { Button } from "@technology-ecommerce/ui";

    void createApiClient;
    void healthResponseSchema;
    void Button;
  `);

  assert.deepEqual(messages, []);
});
