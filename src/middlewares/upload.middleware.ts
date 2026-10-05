import multer from 'multer';

import { AppError } from '../utils/errors';

const allowedMimeTypes = [
  'image/jpeg',
  'image/png',
  'image/webp',
];

export const imageUpload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 8 * 1024 * 1024,
  },

  fileFilter: (_req, file, callback) => {
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return callback(
        new AppError(
          'Formato de imagen no permitido. Usa JPG, PNG o WEBP.',
          400,
          'INVALID_IMAGE_FORMAT',
        ),
      );
    }

    callback(null, true);
  },
});