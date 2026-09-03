import { scrypt, timingSafeEqual } from "node:crypto";

import {
  Algorithm,
  hash as argon2Hash,
  parseOptions,
  verify as argon2Verify,
  Version,
} from "@node-rs/argon2";

const ARGON2_OPTIONS = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19_456,
  outputLen: 32,
  parallelism: 1,
  timeCost: 2,
  version: Version.V0x13,
} as const;

const LEGACY_SCRYPT_SCHEME = "scrypt";
const LEGACY_SCRYPT_KEY_LENGTH = 64;
const LEGACY_SCRYPT_MAX_MEMORY = 256 * 1024 * 1024;

function deriveLegacyScryptKey(
  password: string,
  salt: Buffer,
  cost: number,
  blockSize: number,
  parallelization: number,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      LEGACY_SCRYPT_KEY_LENGTH,
      {
        N: cost,
        r: blockSize,
        p: parallelization,
        maxmem: LEGACY_SCRYPT_MAX_MEMORY,
      },
      (error, derivedKey) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(derivedKey);
      },
    );
  });
}

async function verifyLegacyScryptPassword(
  password: string,
  encodedHash: string,
): Promise<boolean> {
  const [scheme, costValue, blockSizeValue, parallelizationValue, salt, hash] =
    encodedHash.split("$");

  if (
    scheme !== LEGACY_SCRYPT_SCHEME ||
    !costValue ||
    !blockSizeValue ||
    !parallelizationValue ||
    !salt ||
    !hash
  ) {
    return false;
  }

  const cost = Number(costValue);
  const blockSize = Number(blockSizeValue);
  const parallelization = Number(parallelizationValue);

  if (
    !Number.isInteger(cost) ||
    !Number.isInteger(blockSize) ||
    !Number.isInteger(parallelization) ||
    cost <= 1 ||
    blockSize <= 0 ||
    parallelization <= 0
  ) {
    return false;
  }

  try {
    const expectedHash = Buffer.from(hash, "base64url");
    const actualHash = await deriveLegacyScryptKey(
      password,
      Buffer.from(salt, "base64url"),
      cost,
      blockSize,
      parallelization,
    );

    return (
      expectedHash.length === actualHash.length &&
      timingSafeEqual(expectedHash, actualHash)
    );
  } catch {
    return false;
  }
}

export async function hashPassword(password: string): Promise<string> {
  return argon2Hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(
  password: string,
  encodedHash: string,
): Promise<boolean> {
  try {
    if (encodedHash.startsWith("$argon2id$")) {
      return await argon2Verify(encodedHash, password);
    }

    return await verifyLegacyScryptPassword(password, encodedHash);
  } catch {
    return false;
  }
}

export function passwordNeedsRehash(encodedHash: string): boolean {
  if (!encodedHash.startsWith("$argon2id$")) {
    return true;
  }

  try {
    const parsed = parseOptions(encodedHash);

    return (
      parsed.algorithm !== ARGON2_OPTIONS.algorithm ||
      parsed.version !== ARGON2_OPTIONS.version ||
      parsed.memoryCost !== ARGON2_OPTIONS.memoryCost ||
      parsed.timeCost !== ARGON2_OPTIONS.timeCost ||
      parsed.parallelism !== ARGON2_OPTIONS.parallelism ||
      parsed.outputLen !== ARGON2_OPTIONS.outputLen
    );
  } catch {
    return true;
  }
}
