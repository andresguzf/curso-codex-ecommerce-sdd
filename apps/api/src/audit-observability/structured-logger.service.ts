import { Injectable, Logger } from "@nestjs/common";

import { sanitizeAuditChanges } from "./audit-entry";
import type { ApiMetricDomain } from "./api-metrics.service";

export type HttpCompletionLog = Readonly<{
  correlationId: string;
  domain: ApiMetricDomain;
  durationMs: number;
  method: string;
  path: string;
  statusCode: number;
}>;

export function serializeHttpCompletionLog(input: HttpCompletionLog): string {
  return JSON.stringify(
    sanitizeAuditChanges({
      ...input,
      event: "http.request.completed",
      level: input.statusCode >= 500 ? "error" : "info",
      outcome: input.statusCode >= 400 ? "failure" : "success",
      timestamp: new Date().toISOString(),
    }),
  );
}

@Injectable()
export class StructuredLoggerService {
  private errors = 0;
  private readonly logger = new Logger("HttpRequest");
  private records = 0;

  logHttpCompletion(input: HttpCompletionLog): void {
    const serialized = serializeHttpCompletionLog(input);
    this.records += 1;

    if (input.statusCode >= 500) {
      this.errors += 1;
      this.logger.error(serialized);
      return;
    }
    this.logger.log(serialized);
  }

  snapshot(): Readonly<{ errors: number; records: number }> {
    return { errors: this.errors, records: this.records };
  }
}
