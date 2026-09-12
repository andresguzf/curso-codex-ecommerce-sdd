import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

export const CORRELATION_ID_HEADER = "x-correlation-id";

const CORRELATION_ID_SYMBOL = Symbol("correlationId");
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RequestContext = Readonly<{ correlationId: string }>;
type CorrelatedRequest = Record<typeof CORRELATION_ID_SYMBOL, string>;

const requestContext = new AsyncLocalStorage<RequestContext>();

export function resolveCorrelationId(value: unknown): string {
  if (typeof value === "string") {
    const candidate = value.trim();
    if (UUID_PATTERN.test(candidate)) return candidate.toLowerCase();
  }

  return randomUUID();
}

export function setRequestCorrelationId(
  request: object,
  correlationId: string,
): void {
  (request as CorrelatedRequest)[CORRELATION_ID_SYMBOL] = correlationId;
}

export function getRequestCorrelationId(request: object): string | undefined {
  return (request as Partial<CorrelatedRequest>)[CORRELATION_ID_SYMBOL];
}

export function runWithRequestContext<Result>(
  context: RequestContext,
  callback: () => Result,
): Result {
  return requestContext.run(context, callback);
}

export function getCorrelationId(): string | undefined {
  return requestContext.getStore()?.correlationId;
}
