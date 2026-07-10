import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { MulterError } from 'multer';

/**
 * Multer throws its own error type (outside Nest's HttpException hierarchy)
 * when an upload violates limits configured on the interceptor, e.g. file
 * too large. Without this filter such errors surface as raw 500s.
 */
@Catch(MulterError)
export class MulterExceptionFilter implements ExceptionFilter {
  catch(exception: MulterError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const messages: Record<string, string> = {
      LIMIT_FILE_SIZE: 'That image is too large. Please upload a photo under 10MB.',
      LIMIT_UNEXPECTED_FILE: 'Unexpected file field. Please upload a single image.',
    };

    response.status(HttpStatus.BAD_REQUEST).json({
      error: 'upload_failed',
      detail: messages[exception.code] || `Upload failed: ${exception.message}`,
    });
  }
}
