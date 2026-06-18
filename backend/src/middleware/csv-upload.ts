import multer from 'multer';
import type { Request } from 'express';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const storage = multer.memoryStorage();

function csvFileFilter(_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) {
  const allowedMimes = [
    'text/csv',
    'application/vnd.ms-excel',
    'text/plain',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ];
  const extension = file.originalname.split('.').pop()?.toLowerCase();
  const allowedExtensions = ['csv', 'xlsx', 'xls'];

  if (allowedMimes.includes(file.mimetype) || (extension && allowedExtensions.includes(extension))) {
    cb(null, true);
  } else {
    cb(new Error('Only CSV and Excel files are accepted'));
  }
}

export const csvUpload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: csvFileFilter,
}).single('file');
