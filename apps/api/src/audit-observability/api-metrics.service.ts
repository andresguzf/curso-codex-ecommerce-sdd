import { Injectable } from "@nestjs/common";

export const API_METRIC_DOMAINS = [
  "authentication",
  "checkout",
  "inventory",
  "orders",
  "billing",
  "other",
] as const;

export type ApiMetricDomain = (typeof API_METRIC_DOMAINS)[number];

type DomainMetrics = {
  durationMsTotal: number;
  errors: number;
  requests: number;
};

export type ApiMetricsSnapshot = Readonly<{
  durationMsTotal: number;
  errors: number;
  requests: number;
  byDomain: Readonly<Record<ApiMetricDomain, Readonly<DomainMetrics>>>;
  byStatus: Readonly<Record<string, number>>;
}>;

function emptyDomainMetrics(): Record<ApiMetricDomain, DomainMetrics> {
  return Object.fromEntries(
    API_METRIC_DOMAINS.map((domain) => [
      domain,
      { durationMsTotal: 0, errors: 0, requests: 0 },
    ]),
  ) as Record<ApiMetricDomain, DomainMetrics>;
}

export function classifyMetricDomain(path: string): ApiMetricDomain {
  if (path.includes("/auth/")) return "authentication";
  if (path.includes("/checkout") || path.includes("/cart")) return "checkout";
  if (path.includes("/inventory")) return "inventory";
  if (path.includes("/orders")) return "orders";
  if (path.includes("/invoices")) return "billing";
  return "other";
}

@Injectable()
export class ApiMetricsService {
  private durationMsTotal = 0;
  private errors = 0;
  private requests = 0;
  private readonly byDomain = emptyDomainMetrics();
  private readonly byStatus: Record<string, number> = {};

  record(input: {
    domain: ApiMetricDomain;
    durationMs: number;
    statusCode: number;
  }): void {
    const durationMs = Math.max(0, input.durationMs);
    const isError = input.statusCode >= 400;
    const domain = this.byDomain[input.domain];

    this.requests += 1;
    this.durationMsTotal += durationMs;
    this.errors += isError ? 1 : 0;
    domain.requests += 1;
    domain.durationMsTotal += durationMs;
    domain.errors += isError ? 1 : 0;
    const status = String(input.statusCode);
    this.byStatus[status] = (this.byStatus[status] ?? 0) + 1;
  }

  snapshot(): ApiMetricsSnapshot {
    return {
      byDomain: structuredClone(this.byDomain),
      byStatus: { ...this.byStatus },
      durationMsTotal: this.durationMsTotal,
      errors: this.errors,
      requests: this.requests,
    };
  }
}
