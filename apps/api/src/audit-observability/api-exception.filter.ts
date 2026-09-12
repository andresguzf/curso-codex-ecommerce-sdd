import {
  ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";

import { sanitizeAuditChanges } from "./audit-entry";
import {
  CORRELATION_ID_HEADER,
  getRequestCorrelationId,
  resolveCorrelationId,
} from "./request-context";

const FALLBACK_ERRORS: Readonly<Record<number, readonly [string, string]>> = {
  [HttpStatus.BAD_REQUEST]: ["BAD_REQUEST", "The request is invalid"],
  [HttpStatus.UNAUTHORIZED]: ["UNAUTHORIZED", "Authentication is required"],
  [HttpStatus.FORBIDDEN]: ["FORBIDDEN", "The operation is not permitted"],
  [HttpStatus.NOT_FOUND]: ["NOT_FOUND", "The requested resource was not found"],
  [HttpStatus.CONFLICT]: ["CONFLICT", "The request conflicts with current state"],
  [HttpStatus.TOO_MANY_REQUESTS]: [
    "TOO_MANY_REQUESTS",
    "Too many requests",
  ],
};

type ErrorPayload = Readonly<{
  code: string;
  correlationId: string;
  details?: unknown;
  message: string;
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toErrorPayload(
  exception: unknown,
  correlationId: string,
): { payload: ErrorPayload; statusCode: number } {
  if (!(exception instanceof HttpException)) {
    return {
      payload: {
        code: "INTERNAL_SERVER_ERROR",
        correlationId,
        message: "An unexpected error occurred",
      },
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
    };
  }

  const statusCode = exception.getStatus();
  const response = exception.getResponse();
  const responseObject = isRecord(response) ? response : undefined;
  const fallback = FALLBACK_ERRORS[statusCode] ?? [
    `HTTP_${statusCode}`,
    "The request could not be completed",
  ];
  const code =
    typeof responseObject?.code === "string" ? responseObject.code : fallback[0];
  const message =
    statusCode < 500 && typeof responseObject?.message === "string"
      ? responseObject.message
      : statusCode < 500 && typeof response === "string"
        ? response
        : statusCode < 500
          ? fallback[1]
          : "An unexpected error occurred";
  const additionalDetails = responseObject
    ? Object.fromEntries(
        Object.entries(responseObject).filter(
          ([key]) =>
            !["code", "details", "error", "message", "statusCode"].includes(
              key,
            ),
        ),
      )
    : {};
  const explicitDetails =
    responseObject?.details ??
    (Array.isArray(responseObject?.message)
      ? { messages: responseObject.message }
      : undefined);
  const sanitized = sanitizeAuditChanges({
    ...additionalDetails,
    ...(explicitDetails === undefined ? {} : { details: explicitDetails }),
  });

  return {
    payload: {
      ...sanitized,
      code,
      correlationId,
      ...(sanitized.details === undefined
        ? {}
        : { details: sanitized.details }),
      message,
    },
    statusCode,
  };
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<FastifyRequest>();
    const reply = http.getResponse<FastifyReply>();
    const correlationId =
      getRequestCorrelationId(request) ??
      resolveCorrelationId(request.headers[CORRELATION_ID_HEADER]);
    const { payload, statusCode } = toErrorPayload(exception, correlationId);

    reply.header(CORRELATION_ID_HEADER, correlationId).status(statusCode).send(payload);
  }
}
