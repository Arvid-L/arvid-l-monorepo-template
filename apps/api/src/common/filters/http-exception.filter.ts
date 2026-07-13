import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { ErrorCode } from '@arvid-l-monorepo-template/shared';

export interface ErrorResponse {
  statusCode: number;
  message: string | string[];
  error: string;
  errorCode: ErrorCode;
  timestamp: string;
  path: string;
}

const ERROR_CODE_BY_STATUS: Partial<Record<number, ErrorCode>> = {
  [HttpStatus.BAD_REQUEST]: ErrorCode.VALIDATION_ERROR,
  [HttpStatus.UNAUTHORIZED]: ErrorCode.UNAUTHORIZED,
  [HttpStatus.FORBIDDEN]: ErrorCode.FORBIDDEN,
  [HttpStatus.NOT_FOUND]: ErrorCode.NOT_FOUND,
  [HttpStatus.CONFLICT]: ErrorCode.CONFLICT,
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    // HttpException responses carry details (e.g. ValidationPipe field errors)
    // in getResponse().message — surface those instead of the generic message.
    // A custom errorCode in the exception response (e.g. EMAIL_NOT_VERIFIED)
    // overrides the generic per-status mapping.
    let message: string | string[] = 'Internal server error';
    let customErrorCode: ErrorCode | undefined;
    if (exception instanceof HttpException) {
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null
      ) {
        message =
          (exceptionResponse as { message?: string | string[] }).message ??
          exception.message;
        customErrorCode = (exceptionResponse as { errorCode?: ErrorCode })
          .errorCode;
      } else {
        message = exception.message;
      }
    }

    const errorResponse: ErrorResponse = {
      statusCode: status,
      message,
      error: HttpStatus[status],
      errorCode:
        customErrorCode ??
        ERROR_CODE_BY_STATUS[status] ??
        ErrorCode.INTERNAL_ERROR,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    response.status(status).json(errorResponse);
  }
}
