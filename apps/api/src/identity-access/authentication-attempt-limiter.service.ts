import { createHash } from "node:crypto";

import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { EnvironmentVariables } from "../config/environment";

type AttemptBucket = {
  attempts: number;
  resetAt: number;
};

const MAXIMUM_BUCKETS = 10_000;

export class AuthenticationRateLimitError extends HttpException {
  constructor(readonly retryAfterSeconds: number) {
    super(
      {
        code: "AUTH_RATE_LIMITED",
        message: "Too many authentication attempts. Try again later",
        retryAfterSeconds,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

@Injectable()
export class AuthenticationAttemptLimiter {
  private readonly buckets = new Map<string, AttemptBucket>();
  private readonly maximumAttempts: number;
  private readonly windowMilliseconds: number;

  constructor(
    @Inject(ConfigService)
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.maximumAttempts = config.get("AUTH_LOGIN_MAX_ATTEMPTS", {
      infer: true,
    });
    this.windowMilliseconds =
      config.get("AUTH_LOGIN_WINDOW_SECONDS", { infer: true }) * 1_000;
  }

  assertAllowed(ipAddress: string | undefined, email: string): void {
    const now = Date.now();

    for (const [key, limit] of this.keys(ipAddress, email)) {
      const bucket = this.readActiveBucket(key, now);

      if (bucket && bucket.attempts >= limit) {
        const retryAfterSeconds = Math.max(
          1,
          Math.ceil((bucket.resetAt - now) / 1_000),
        );

        throw new AuthenticationRateLimitError(retryAfterSeconds);
      }
    }
  }

  recordFailure(ipAddress: string | undefined, email: string): void {
    const now = Date.now();

    this.keepBucketCountBounded(now);

    for (const [key] of this.keys(ipAddress, email)) {
      const current = this.readActiveBucket(key, now);
      this.buckets.set(key, {
        attempts: (current?.attempts ?? 0) + 1,
        resetAt: current?.resetAt ?? now + this.windowMilliseconds,
      });
    }
  }

  recordSuccess(ipAddress: string | undefined, email: string): void {
    for (const [key] of this.keys(ipAddress, email)) {
      this.buckets.delete(key);
    }
  }

  private keys(
    ipAddress: string | undefined,
    email: string,
  ): readonly (readonly [string, number])[] {
    const ip = ipAddress ?? "unknown";
    const identity = createHash("sha256")
      .update(`${ip}\0${email}`)
      .digest("base64url");
    const ipKey = createHash("sha256").update(ip).digest("base64url");

    return [
      [`identity:${identity}`, this.maximumAttempts],
      [`ip:${ipKey}`, this.maximumAttempts * 10],
    ];
  }

  private readActiveBucket(
    key: string,
    now: number,
  ): AttemptBucket | undefined {
    const bucket = this.buckets.get(key);

    if (bucket && bucket.resetAt <= now) {
      this.buckets.delete(key);
      return undefined;
    }

    return bucket;
  }

  private keepBucketCountBounded(now: number): void {
    if (this.buckets.size < MAXIMUM_BUCKETS) {
      return;
    }

    for (const [key] of this.buckets) {
      this.readActiveBucket(key, now);
    }

    while (this.buckets.size >= MAXIMUM_BUCKETS) {
      const oldestKey = this.buckets.keys().next().value as string | undefined;

      if (!oldestKey) {
        return;
      }

      this.buckets.delete(oldestKey);
    }
  }
}
