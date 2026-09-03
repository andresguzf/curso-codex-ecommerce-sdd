import { scrypt } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  hashPassword,
  passwordNeedsRehash,
  verifyPassword,
} from "../../src/identity-access/password/password";

function createLegacyScryptHash(password: string): Promise<string> {
  const salt = Buffer.from("legacy-test-salt", "utf8");
  const cost = 32_768;
  const blockSize = 8;
  const parallelization = 1;

  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      64,
      {
        N: cost,
        r: blockSize,
        p: parallelization,
        maxmem: 64 * 1024 * 1024,
      },
      (error, derivedKey) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(
          [
            "scrypt",
            cost,
            blockSize,
            parallelization,
            salt.toString("base64url"),
            derivedKey.toString("base64url"),
          ].join("$"),
        );
      },
    );
  });
}

describe("password hashing policy", () => {
  it("creates and verifies Argon2id hashes with the current policy", async () => {
    const hash = await hashPassword("CurrentPassword123!");

    expect(hash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    expect(await verifyPassword("CurrentPassword123!", hash)).toBe(true);
    expect(await verifyPassword("incorrect-password", hash)).toBe(false);
    expect(passwordNeedsRehash(hash)).toBe(false);
  });

  it("verifies legacy scrypt hashes and marks them for migration", async () => {
    const hash = await createLegacyScryptHash("LegacyPassword123!");

    expect(await verifyPassword("LegacyPassword123!", hash)).toBe(true);
    expect(await verifyPassword("incorrect-password", hash)).toBe(false);
    expect(passwordNeedsRehash(hash)).toBe(true);
  });
});
