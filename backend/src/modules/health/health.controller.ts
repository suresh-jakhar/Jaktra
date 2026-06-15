import { Request, Response } from 'express';
import { sql } from 'drizzle-orm';
import type { DatabaseClient } from '../../db/index.js';
import type { AimlService } from '../agent/aiml.service.js';

export interface HealthResponse {
  status: 'ok' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  environment: string;
  checks: {
    database: 'ok' | 'down';
    aiml_service: 'ok' | 'down' | 'not_configured';
  };
}

export class HealthController {
  constructor(
    private db?: DatabaseClient,
    private aimlService?: AimlService
  ) {}

  getHealth = async (_req: Request, res: Response): Promise<void> => {
    const dbHealthy = await this.checkDatabase();
    const aimlHealthy = await this.checkAiml();

    const status = dbHealthy ? (aimlHealthy ? 'ok' : 'degraded') : 'unhealthy';
    const httpStatus = dbHealthy ? 200 : 503;

    const response: HealthResponse = {
      status,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env['NODE_ENV'] ?? 'development',
      checks: {
        database: dbHealthy ? 'ok' : 'down',
        aiml_service: !this.aimlService
          ? 'not_configured'
          : aimlHealthy
            ? 'ok'
            : 'down',
      },
    };

    res.status(httpStatus).json(response);
  };

  private async checkDatabase(): Promise<boolean> {
    try {
      if (!this.db) return false;
      await this.db.execute(sql`SELECT 1`);
      return true;
    } catch {
      return false;
    }
  }

  private async checkAiml(): Promise<boolean> {
    try {
      if (!this.aimlService) return true; // not configured = not a failure
      const status = await this.aimlService.getAgentStatus();
      return status.status !== 'down';
    } catch {
      return false;
    }
  }
}
