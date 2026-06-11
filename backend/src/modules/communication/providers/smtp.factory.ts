import * as dns from 'dns/promises';
import net from 'net';
import nodemailer from 'nodemailer';
import { z } from 'zod';

export const SmtpConfigSchema = z.object({
  payloadVersion: z.literal(1),
  host: z.string().min(1).max(253),
  port: z.union([z.literal(465), z.literal(587), z.literal(2525)]),
  securityMode: z.enum(['implicit_tls', 'starttls']),
  username: z.string().min(1).max(255),
  password: z.string().min(1).max(1024),
}).strict();

export type SmtpConfig = z.infer<typeof SmtpConfigSchema>;

// https://en.wikipedia.org/wiki/Reserved_IP_addresses
function isProhibitedIP(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    if (parts[0] === 0) return true; // Current network
    if (parts[0] === 10) return true; // Private
    if (parts[0] === 127) return true; // Loopback
    if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true; // Shared address space
    if (parts[0] === 169 && parts[1] === 254) return true; // Link-local
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true; // Private
    if (parts[0] === 192 && parts[1] === 0 && parts[2] === 0) return true; // IETF Protocol Assignments
    if (parts[0] === 192 && parts[1] === 0 && parts[2] === 2) return true; // TEST-NET-1
    if (parts[0] === 192 && parts[1] === 88 && parts[2] === 99) return true; // 6to4 Relay
    if (parts[0] === 192 && parts[1] === 168) return true; // Private
    if (parts[0] === 198 && parts[1] >= 18 && parts[1] <= 19) return true; // Network benchmark tests
    if (parts[0] === 198 && parts[1] === 51 && parts[2] === 100) return true; // TEST-NET-2
    if (parts[0] === 203 && parts[1] === 0 && parts[2] === 113) return true; // TEST-NET-3
    if (parts[0] >= 224 && parts[0] <= 239) return true; // Multicast
    if (parts[0] >= 240 && parts[0] <= 255) return true; // Reserved
    return false;
  }
  
  if (net.isIPv6(ip)) {
    const ipLower = ip.toLowerCase();
    if (ipLower === '::1') return true; // Loopback
    if (ipLower === '::') return true; // Unspecified
    if (ipLower.startsWith('fe80:')) return true; // Link-local
    if (ipLower.startsWith('fc') || ipLower.startsWith('fd')) return true; // Unique local
    if (ipLower.startsWith('ff')) return true; // Multicast
    // IPv4-mapped IPv6
    if (ipLower.startsWith('::ffff:')) {
      const ipv4Part = ipLower.substring(7);
      return isProhibitedIP(ipv4Part);
    }
    return false;
  }
  
  return true; // Not IPv4 or IPv6, reject
}

export class SmtpConnectionFactory {
  static async validatePayload(payload: unknown): Promise<SmtpConfig> {
    const result = SmtpConfigSchema.safeParse(payload);
    if (!result.success) {
      throw new Error(`Invalid SMTP configuration payload: ${result.error.message}`);
    }
    return result.data;
  }

  static async resolveAndValidateHost(host: string): Promise<string> {
    if (net.isIP(host)) {
      throw new Error('IP literals are not allowed. Please provide a valid hostname.');
    }

    let records4: string[] = [];
    let records6: string[] = [];

    try {
      records4 = await dns.resolve4(host);
    } catch (e: any) {
      if (e.code !== 'ENODATA' && e.code !== 'ENOTFOUND') {
        throw new Error(`DNS resolution failed for ${host}: ${e.message}`);
      }
    }

    try {
      records6 = await dns.resolve6(host);
    } catch (e: any) {
      if (e.code !== 'ENODATA' && e.code !== 'ENOTFOUND') {
        throw new Error(`DNS resolution failed for ${host}: ${e.message}`);
      }
    }

    const allRecords = [...records4, ...records6];

    if (allRecords.length === 0) {
      throw new Error(`No DNS records found for host ${host}`);
    }

    let hasSafe = false;
    for (const ip of allRecords) {
      if (isProhibitedIP(ip)) {
        throw new Error(`Host ${host} resolved to a prohibited IP address: ${ip}`);
      }
      hasSafe = true;
    }

    if (!hasSafe) {
      throw new Error(`No safe public IP addresses found for host ${host}`);
    }

    // Prefer IPv4 for compatibility, return the first one
    return records4.length > 0 ? records4[0] : records6[0];
  }

  static async createTransporter(config: SmtpConfig): Promise<nodemailer.Transporter> {
    const validConfig = await this.validatePayload(config);
    
    // Strict port and TLS mode validation
    if (validConfig.port === 465 && validConfig.securityMode !== 'implicit_tls') {
      throw new Error('Port 465 requires implicit_tls securityMode');
    }
    if ((validConfig.port === 587 || validConfig.port === 2525) && validConfig.securityMode !== 'starttls') {
      throw new Error(`Port ${validConfig.port} requires starttls securityMode`);
    }

    const pinnedIp = await this.resolveAndValidateHost(validConfig.host);

    const transportOptions = {
      host: pinnedIp,
      port: validConfig.port,
      secure: validConfig.securityMode === 'implicit_tls',
      requireTLS: validConfig.securityMode === 'starttls',
      auth: {
        user: validConfig.username,
        pass: validConfig.password,
      },
      tls: {
        servername: validConfig.host,
        rejectUnauthorized: true,
      },
      connectionTimeout: 10000,
      greetingTimeout: 5000,
      socketTimeout: 15000,
      name: validConfig.host // Set greeting name to host instead of OS hostname
    };

    return nodemailer.createTransport(transportOptions);
  }

  static async executeWithTimeout<T>(
    transporter: nodemailer.Transporter,
    operation: () => Promise<T>,
    timeoutMs: number = 30000
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        transporter.close();
        reject(new Error(`SMTP operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      operation()
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }
}
