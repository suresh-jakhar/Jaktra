import { Request, Response, NextFunction } from 'express';
import type { AnalyticsService } from './analytics.service.js';

export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}

  getSummary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = res.locals.tenantId as string;
      const stats = await this.analyticsService.getSummary(tenantId, req.query);
      res.status(200).json(stats);
    } catch (err: unknown) {
      next(err);
    }
  };

  getAging = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = res.locals.tenantId as string;
      const stats = await this.analyticsService.getAging(tenantId, req.query);
      res.status(200).json(stats);
    } catch (err: unknown) {
      next(err);
    }
  };

  getAgentPerformance = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = res.locals.tenantId as string;
      const stats = await this.analyticsService.getAgentPerformance(tenantId, req.query);
      res.status(200).json(stats);
    } catch (err: unknown) {
      next(err);
    }
  };

  getEmailVolume = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = res.locals.tenantId as string;
      const stats = await this.analyticsService.getEmailVolume(tenantId, req.query);
      res.status(200).json(stats);
    } catch (err: unknown) {
      next(err);
    }
  };

  getChannelBreakdown = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = res.locals.tenantId as string;
      const stats = await this.analyticsService.getChannelBreakdown(tenantId, req.query);
      res.status(200).json(stats);
    } catch (err: unknown) {
      next(err);
    }
  };

  getTierEffectiveness = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = res.locals.tenantId as string;
      const stats = await this.analyticsService.getTierEffectiveness(tenantId, req.query);
      res.status(200).json(stats);
    } catch (err: unknown) {
      next(err);
    }
  };

  getCommunicationStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = res.locals.tenantId as string;
      const stats = await this.analyticsService.getCommunicationStats(tenantId, req.query);
      res.status(200).json(stats);
    } catch (err: unknown) {
      next(err);
    }
  };
}
