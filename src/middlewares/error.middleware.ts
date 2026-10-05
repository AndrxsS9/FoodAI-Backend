import {
  NextFunction,
  Request,
  Response,
} from 'express';

import { ZodError } from 'zod';

import { AppError } from '../utils/errors';
import { sendError } from '../utils/apiResponse';

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

  if (error instanceof AppError) {
    return sendError(
      res,
      error.message,
      error.code,
      error.statusCode,
    );
  }

  console.error('❌ Error no controlado:', error);

  return sendError(
    res,
    'Ocurrió un error interno en el servidor.',
    'INTERNAL_ERROR',
    500,
  );
}