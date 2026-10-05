import { Global, Module } from "@nestjs/common";
import { APP_FILTER, APP_INTERCEPTOR } from "@nestjs/core";

import { ApiExceptionFilter } from "./api-exception.filter.js";
import { ApiMetricsService } from "./api-metrics.service.js";
import { RequestContextInterceptor } from "./request-context.interceptor.js";
import { StructuredLoggerService } from "./structured-logger.service.js";

@Global()
@Module({
  providers: [
    ApiMetricsService,
    StructuredLoggerService,
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: RequestContextInterceptor },
  ],
  exports: [ApiMetricsService, StructuredLoggerService],
})
export class AuditObservabilityModule {}
