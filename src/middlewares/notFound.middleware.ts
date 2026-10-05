import { NextFunction, Request, Response } from 'express';

import { AppError } from '../utils/errors';

export function notFoundMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  next(
    new AppError(
      `La ruta ${req.method} ${req.originalUrl} no existe.`,
      404,
      'ROUTE_NOT_FOUND',
    ),
  );
}