import multer from 'multer';

import { AppError } from '../utils/errors';

export const MAX_IMAGE_FILE_SIZE_BYTES = 8 * 1024 * 1024;

const allowedMimeTypes = [
  'image/jpeg',
  'image/png',
  'image/webp',
];

export const imageUpload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: MAX_IMAGE_FILE_SIZE_BYTES,
    files: 1,
    fields: 5,
    fieldSize: 16 * 1024,
    parts: 6,
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
