import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { Observable, type Subscription } from "rxjs";

import {
  getRequestCorrelationId,
  resolveCorrelationId,
  runWithRequestContext,
} from "./request-context";

@Injectable()
export class RequestContextInterceptor implements NestInterceptor {
  intercept(
    executionContext: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    const request = executionContext.switchToHttp().getRequest<FastifyRequest>();
    const correlationId =
      getRequestCorrelationId(request) ??
      resolveCorrelationId(request.headers["x-correlation-id"]);

    return new Observable((subscriber) => {
      let subscription: Subscription | undefined;
      runWithRequestContext({ correlationId }, () => {
        subscription = next.handle().subscribe(subscriber);
      });
      return () => subscription?.unsubscribe();
    });
  }
}
