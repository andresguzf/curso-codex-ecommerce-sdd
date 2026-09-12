import { spawnSync } from "node:child_process";
import {
  copyFile,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

const packageDirectory = resolve(import.meta.dirname, "..");
const repositoryDirectory = resolve(packageDirectory, "../..");
const generatorPath = resolve(
  packageDirectory,
  "node_modules/.bin/openapi-typescript",
);

const temporaryDirectories: string[] = [];

function runGenerationCheck(contractPath: string, generatedPath: string) {
  return spawnSync(
    generatorPath,
    [contractPath, "-o", generatedPath, "--check"],
    { encoding: "utf8" },
  );
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { force: true, recursive: true }),
    ),
  );
});

describe("generated OpenAPI client drift detection", () => {
  it("fails when OpenAPI changes without regenerating the TypeScript client", async () => {
    const temporaryDirectory = await mkdtemp(
      resolve(tmpdir(), "technology-ecommerce-contract-"),
    );
    temporaryDirectories.push(temporaryDirectory);

    const contractPath = resolve(temporaryDirectory, "openapi.json");
    const generatedPath = resolve(temporaryDirectory, "openapi.ts");

    await Promise.all([
      copyFile(
        resolve(repositoryDirectory, "apps/api/openapi/openapi.json"),
        contractPath,
      ),
      copyFile(
        resolve(packageDirectory, "src/generated/openapi.ts"),
        generatedPath,
      ),
    ]);

    const synchronizedResult = runGenerationCheck(contractPath, generatedPath);
    expect(synchronizedResult.status, synchronizedResult.stderr).toBe(0);

    const changedContract = JSON.parse(
      await readFile(contractPath, "utf8"),
    ) as {
      components: {
        schemas: {
          HealthResponseDto: {
            properties: Record<string, unknown>;
            required: string[];
          };
        };
      };
    };
    const healthSchema = changedContract.components.schemas.HealthResponseDto;
    healthSchema.properties.contractProbe = { type: "string" };
    healthSchema.required.push("contractProbe");
    await writeFile(
      contractPath,
      `${JSON.stringify(changedContract, null, 2)}\n`,
      "utf8",
    );

    const staleResult = runGenerationCheck(contractPath, generatedPath);

    expect(staleResult.status).not.toBe(0);
    expect(`${staleResult.stdout}\n${staleResult.stderr}`).toContain(
      "Generated types are not up-to-date",
    );
  });
});
