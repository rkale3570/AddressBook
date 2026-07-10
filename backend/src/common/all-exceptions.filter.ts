import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Catches everything (Nest HttpExceptions AND raw driver/runtime errors like
 * Postgres unique-constraint violations) so the client always gets a clean,
 * predictable JSON body instead of a bare 500 with no explanation. The full
 * error is still logged server-side for debugging.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionsHandler');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      response.status(status).json(
        typeof body === 'string' ? { statusCode: status, message: body } : body,
      );
      return;
    }

    // Postgres unique-constraint violation (e.g. duplicate email/phone) --
    // this should never actually be reachable now that the indexes are
    // scoped per-contact, but if it ever is (e.g. a future schema change),
    // surface it as a clear 409 instead of an opaque 500.
    const pgError = exception as { code?: string; constraint_name?: string; message?: string };
    if (pgError?.code === '23505') {
      response.status(HttpStatus.CONFLICT).json({
        statusCode: HttpStatus.CONFLICT,
        message: 'That value conflicts with an existing record.',
      });
      this.logger.error(`Unique violation on ${request.method} ${request.url}: ${pgError.message}`);
      return;
    }

    const message = (exception as Error)?.message || 'Internal server error';
    const stack = (exception as Error)?.stack;
    this.logger.error(`Unhandled error on ${request.method} ${request.url}: ${message}`);
    if (stack) this.logger.error(stack);

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Something went wrong on our end. Please try again.',
    });
  }
}
