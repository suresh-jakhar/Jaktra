import sgClient from '@sendgrid/client';
import type { IntegrationRepository } from './integration.repository.js';
import { encrypt, decrypt } from '../../shared/encryption.js';
import { IntegrationErrors, IntegrationError } from './integration.errors.js';
import { logger } from '../../shared/logger.js';
import type { TenantIntegration } from '../../db/index.js';
import { SmtpConnectionFactory, SmtpConfig } from '../communication/providers/smtp.factory.js';

export class IntegrationService {
  constructor(private readonly repo: IntegrationRepository) {}

  private getAadContext(tenantId: string, provider: string, version: number): string {
    return `${tenantId}:${provider}:v${version}`;
  }

  async getIntegrationStatus(tenantId: string, provider: 'sendgrid' | 'smtp') {
    const integration = await this.repo.getIntegration(tenantId, provider);
    
    if (!integration) {
      return {
        provider,
        isConfigured: false,
        lastValidatedAt: null,
        lastValidationResult: 'unknown',
      };
    }

    let extraConfig = {};
    if (provider === 'smtp') {
      try {
        const config = await this.getDecryptedSmtpConfig(tenantId);
        extraConfig = {
          displayHost: config.host,
          maskedUsername: '*'.repeat(Math.max(config.username.length - 4, 0)) + config.username.slice(-4),
          port: config.port,
          securityMode: config.securityMode,
        };
      } catch (e) {
      }
    }

    return {
      provider,
      isConfigured: true,
      lastValidatedAt: integration.lastValidatedAt,
      lastValidationResult: integration.lastValidationResult,
      ...extraConfig,
    };
  }

  async validateAndSaveSendgridKey(tenantId: string, apiKey: string): Promise<void> {
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
      throw IntegrationErrors.CREDENTIAL_INVALID;
    }

    sgClient.setApiKey(apiKey);
    const request = {
      method: 'GET' as const,
      url: '/v3/scopes',
    };

    let validationResult: TenantIntegration['lastValidationResult'] = 'unknown';
    let errorCode: string | undefined;

    try {
      await sgClient.request(request);
      validationResult = 'valid';
    } catch (error: any) {
      const status = error.code || error.response?.statusCode;
      errorCode = String(status);

      logger.warn(`SendGrid validation failed for tenant ${tenantId}. Status: ${status}`);

      if (status === 400 || status === 401 || status === 403) {
        throw IntegrationErrors.CREDENTIAL_INVALID;
      } else if (status === 429) {
        throw IntegrationErrors.RATE_LIMITED;
      } else {
        throw IntegrationErrors.PROVIDER_UNAVAILABLE;
      }
    }

    const version = 1;
    const encrypted = encrypt(apiKey, this.getAadContext(tenantId, 'sendgrid', version));

    await this.repo.upsertIntegration({
      tenantId,
      provider: 'sendgrid',
      ciphertext: encrypted.ciphertext,
      iv: encrypted.iv,
      authTag: encrypted.authTag,
      keyVersion: version,
      lastValidatedAt: new Date(),
      lastValidationResult: validationResult,
      lastOperationalErrorCode: errorCode,
    });
  }

  async deleteSendgridIntegration(tenantId: string): Promise<void> {
    await this.repo.deleteIntegration(tenantId, 'sendgrid');
  }

  async getDecryptedSendgridKey(tenantId: string): Promise<string> {
    const integration = await this.repo.getIntegration(tenantId, 'sendgrid');
    if (!integration) {
      throw IntegrationErrors.NOT_CONFIGURED;
    }

    try {
      const aadContext = this.getAadContext(tenantId, 'sendgrid', integration.keyVersion);
      return decrypt({
        ciphertext: integration.ciphertext,
        iv: integration.iv,
        authTag: integration.authTag,
        keyVersion: integration.keyVersion,
      }, aadContext);
    } catch (e) {
      logger.error(`Decryption failed for tenant ${tenantId} SendGrid integration.`);
      throw IntegrationErrors.CREDENTIAL_INVALID;
    }
  }

  async getDecryptedSmtpConfig(tenantId: string): Promise<SmtpConfig> {
    const integration = await this.repo.getIntegration(tenantId, 'smtp');
    if (!integration) {
      throw IntegrationErrors.NOT_CONFIGURED;
    }

    try {
      const aadContext = this.getAadContext(tenantId, 'smtp', integration.keyVersion);
      const decryptedString = decrypt({
        ciphertext: integration.ciphertext,
        iv: integration.iv,
        authTag: integration.authTag,
        keyVersion: integration.keyVersion,
      }, aadContext);
      
      const payload = JSON.parse(decryptedString);
      return await SmtpConnectionFactory.validatePayload(payload);
    } catch (e) {
      logger.error(`Decryption failed for tenant ${tenantId} SMTP integration.`);
      throw IntegrationErrors.CREDENTIAL_INVALID;
    }
  }

  async validateAndSaveSmtpConfig(tenantId: string, updateData: Partial<SmtpConfig>): Promise<void> {
    const existingIntegration = await this.repo.getIntegration(tenantId, 'smtp');
    let candidateConfig: any = { payloadVersion: 1, ...updateData };

    if (!existingIntegration) {
      if (!updateData.password) {
        throw new IntegrationError('Password is required for initial SMTP setup', 'INTEGRATION_BAD_REQUEST', 400);
      }
    } else {
      // Merge with existing
      try {
        const existingConfig = await this.getDecryptedSmtpConfig(tenantId);
        candidateConfig = { ...existingConfig, ...updateData };
      } catch (e) {
        if (!updateData.password) {
          throw new IntegrationError('Existing configuration could not be read, password must be provided', 'INTEGRATION_BAD_REQUEST', 400);
        }
      }
    }

    const validatedConfig = await SmtpConnectionFactory.validatePayload(candidateConfig);

    // Run Verification
    let transporter;
    try {
      transporter = await SmtpConnectionFactory.createTransporter(validatedConfig);
      await SmtpConnectionFactory.executeWithTimeout(transporter, () => transporter!.verify(), 15000);
    } catch (error: any) {
      logger.warn(`SMTP validation failed for tenant ${tenantId}: ${error.message}`);
      // Return 400 to the user, preserving the existing integration intact.
      throw new IntegrationError(`SMTP Validation failed: ${error.message}`, 'INTEGRATION_VALIDATION_FAILED', 400);
    } finally {
      if (transporter) transporter.close();
    }

    // Save
    const version = 1;
    const encrypted = encrypt(JSON.stringify(validatedConfig), this.getAadContext(tenantId, 'smtp', version));
    
    if (existingIntegration) {
      const updated = await this.repo.optimisticUpdateIntegration(tenantId, 'smtp', {
        ciphertext: encrypted.ciphertext,
        iv: encrypted.iv,
        authTag: encrypted.authTag,
        keyVersion: version,
        lastValidatedAt: new Date(),
        lastValidationResult: 'valid',
        lastOperationalErrorCode: null,
      }, existingIntegration.updatedAt);
      
      if (!updated) {
        throw new IntegrationError('SMTP settings were changed by another administrator. Current values have been reloaded.', 'INTEGRATION_CONFLICT', 409);
      }
    } else {
      try {
        await this.repo.insertIntegration({
          tenantId,
          provider: 'smtp',
          ciphertext: encrypted.ciphertext,
          iv: encrypted.iv,
          authTag: encrypted.authTag,
          keyVersion: version,
          lastValidatedAt: new Date(),
          lastValidationResult: 'valid',
          lastOperationalErrorCode: null,
        });
      } catch (e: any) {
        // Unique constraint violation map to 409
        if (e.code === '23505') {
          throw new IntegrationError('SMTP settings were changed by another administrator. Current values have been reloaded.', 'INTEGRATION_CONFLICT', 409);
        }
        throw e;
      }
    }
  }

  async deleteSmtpIntegration(tenantId: string): Promise<void> {
    await this.repo.deleteIntegration(tenantId, 'smtp');
  }

  async handleDeliveryError(tenantId: string, provider: 'sendgrid' | 'smtp', error: any): Promise<void> {
    if (provider === 'sendgrid') {
      const status = error.response?.statusCode;
      if (status === 401) {
        await this.repo.updateValidationStatus(tenantId, provider, 'revoked', String(status));
      } else if (status === 403) {
        const bodyStr = JSON.stringify(error.response?.body || {});
        if (bodyStr.includes('sender') || bodyStr.includes('identity')) {
          await this.repo.updateValidationStatus(tenantId, provider, 'unverified_sender', String(status));
        } else {
          await this.repo.updateValidationStatus(tenantId, provider, 'insufficient_scope', String(status));
        }
      }
    } else if (provider === 'smtp') {
      const status = error.responseCode || error.code;
      if (status === 535) {
         await this.repo.updateValidationStatus(tenantId, provider, 'revoked', 'auth_failed');
      } else {
         await this.repo.updateOperationalErrorCode(tenantId, provider, String(status));
      }
    }
  }
}
