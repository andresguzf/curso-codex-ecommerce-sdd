import type { INestApplication } from "@nestjs/common";
import type { FastifyInstance } from "fastify";

import {
  ApiMetricsService,
  classifyMetricDomain,
} from "./api-metrics.service";
import {
  CORRELATION_ID_HEADER,
  getRequestCorrelationId,
  resolveCorrelationId,
  setRequestCorrelationId,
} from "./request-context";
import { StructuredLoggerService } from "./structured-logger.service";

type RequestObservation = Readonly<{
  correlationId: string;
  startedAt: bigint;
}>;

export function safeHttpPath(url: string): string {
  return url.split("?", 1)[0] ?? "/";
}

export function configureObservability(app: INestApplication): void {
  const server = app.getHttpAdapter().getInstance() as FastifyInstance;
  const metrics = app.get(ApiMetricsService);
  const logger = app.get(StructuredLoggerService);
  const observations = new WeakMap<object, RequestObservation>();

  server.addHook("onRequest", async (request, reply) => {
    const correlationId = resolveCorrelationId(
      request.headers[CORRELATION_ID_HEADER],
    );
    setRequestCorrelationId(request, correlationId);
    observations.set(request, {
      correlationId,
      startedAt: process.hrtime.bigint(),
    });
    reply.header(CORRELATION_ID_HEADER, correlationId);
  });

  server.addHook("onResponse", async (request, reply) => {
    const observation = observations.get(request);
    const correlationId =
      observation?.correlationId ??
      getRequestCorrelationId(request) ??
      resolveCorrelationId(undefined);
    const durationMs = observation
      ? Number(process.hrtime.bigint() - observation.startedAt) / 1_000_000
      : 0;
    const path = safeHttpPath(request.url);
    const domain = classifyMetricDomain(path);

    metrics.record({ domain, durationMs, statusCode: reply.statusCode });
    logger.logHttpCompletion({
      correlationId,
      domain,
      durationMs: Number(durationMs.toFixed(3)),
      method: request.method,
      path,
      statusCode: reply.statusCode,
    });
  });
}
