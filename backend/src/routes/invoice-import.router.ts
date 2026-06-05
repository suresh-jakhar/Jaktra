import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import type { InvoiceImportService, DuplicateStrategy } from '../services/invoice-import.service.js';
import { csvUpload } from '../middleware/csv-upload.js';
import { logger } from '../utils/logger.js';

export function createInvoiceImportRouter(
  importService: InvoiceImportService,
  authMiddleware: RequestHandler,
  tenantScoped: RequestHandler,
): Router {
  const router = Router();

  router.post(
    '/import',
    authMiddleware,
    tenantScoped,
    (req: Request, res: Response, next: NextFunction) => {
      csvUpload(req, res, (err: unknown) => {
        if (err instanceof Error) {
          res.status(400).json({ error: err.message });
          return;
        }
        next();
      });
    },
    async (req: Request, res: Response) => {
      if (!req.file) {
        res.status(400).json({ error: 'No CSV file provided. Use field name "file".' });
        return;
      }

      const tenantId = res.locals.tenantId as string;
      const duplicateStrategy = (req.query.on_duplicate as DuplicateStrategy) || 'skip';

      if (!['skip', 'update'].includes(duplicateStrategy)) {
        res.status(400).json({ error: 'on_duplicate must be "skip" or "update"' });
        return;
      }

      logger.info(`CSV import started for tenant ${tenantId} (${req.file.originalname}, ${req.file.size} bytes)`);

      const result = await importService.importFromCsv(
        req.file.buffer,
        tenantId,
        duplicateStrategy,
      );

      logger.info(`CSV import complete: ${result.imported} imported, ${result.updated} updated, ${result.skipped} skipped, ${result.errors.length} errors`);

      res.status(200).json(result);
    },
  );

  return router;
}
