import {
  NextFunction,
  Request,
  Response,
} from 'express';
import multer from 'multer';
import { ZodError } from 'zod';

import { env } from '../config/env';
import { AppError } from '../utils/errors';
import { sendError } from '../utils/apiResponse';
import { formatSafeErrorForLog } from '../utils/safeLogger';

export function errorMiddleware(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (error instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Los datos enviados no son válidos.',
        details: error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      },
    });
  }

  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return sendError(
        res,
        'La imagen supera el tamaño máximo permitido de 8 MB.',
        'IMAGE_TOO_LARGE',
        413,
      );
    }

    return sendError(
      res,
      'La carga del archivo no cumple los límites permitidos.',
      'INVALID_UPLOAD_PAYLOAD',
      400,
    );
  }

  if (error instanceof AppError) {
    return sendError(
      res,
      error.message,
      error.code,
      error.statusCode,
    );
  }

  if (typeof error === 'object' && error !== null) {
    const parserError = error as {
      type?: unknown;
      status?: unknown;
      statusCode?: unknown;
      body?: unknown;
    };

    if (
      parserError.type === 'entity.too.large' ||
      parserError.status === 413 ||
      parserError.statusCode === 413
    ) {
      return sendError(
        res,
        'El tamaño de la solicitud excede el límite permitido.',
        'PAYLOAD_TOO_LARGE',
        413,
      );
    }

    if (
      error instanceof SyntaxError &&
      'body' in parserError &&
      (parserError.status === 400 || parserError.statusCode === 400)
    ) {
      return sendError(
        res,
        'El cuerpo JSON de la solicitud tiene un formato inválido.',
        'INVALID_JSON',
        400,
      );
    }
  }

  console.error(
    '❌ Error no controlado:',
    formatSafeErrorForLog(error, {
      includeStack: env.NODE_ENV !== 'production',
    }),
  );

  return sendError(
    res,
    'Ocurrió un error interno en el servidor.',
    'INTERNAL_ERROR',
    500,
  );
}
