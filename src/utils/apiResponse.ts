import { Response } from 'express';

export function sendSuccess<T>(
  res: Response,
  data: T,
  statusCode = 200,
) {
  return res.status(statusCode).json({
    success: true,
    data,
  });
}

export function sendError(
  res: Response,
  message: string,
  code: string,
  statusCode: number,
) {
  return res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
    },
  });
}