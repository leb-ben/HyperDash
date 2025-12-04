import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger.js';

export interface AuditEntry {
  timestamp: string;
  action: string;
  details: any;
  userId: string;
  ip: string;
  userAgent?: string;
}

export class AuditLogger {
  private static auditLogPath: string;
  private static maxFileSize: number = 10 * 1024 * 1024; // 10MB
  private static maxFiles: number = 10;

  static {
    // Ensure logs directory exists
    const logsDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    this.auditLogPath = path.join(logsDir, 'audit.log');
  }

  static logAction(action: string, details: any, userId?: string, ip?: string, userAgent?: string): void {
    const auditEntry: AuditEntry = {
      timestamp: new Date().toISOString(),
      action,
      details,
      userId: userId || 'anonymous',
      ip: ip || 'unknown',
      userAgent
    };

    // Write to console for immediate visibility
    console.log(`[AUDIT] ${auditEntry.timestamp} - ${auditEntry.action} by ${auditEntry.userId} from ${auditEntry.ip}`);

    // Write to persistent audit log
    this.writeToAuditLog(auditEntry);

    // Log to application logger
    logger.info('AUDIT', auditEntry);
  }

  private static writeToAuditLog(entry: AuditEntry): void {
    try {
      // Check if log rotation is needed
      if (fs.existsSync(this.auditLogPath)) {
        const stats = fs.statSync(this.auditLogPath);
        if (stats.size > this.maxFileSize) {
          this.rotateAuditLog();
        }
      }

      // Append entry to audit log
      const logLine = JSON.stringify(entry) + '\n';
      fs.appendFileSync(this.auditLogPath, logLine, { encoding: 'utf8' });
    } catch (error: any) {
      logger.error('Failed to write to audit log:', error);
      console.error('AUDIT LOG ERROR:', error.message);
    }
  }

  private static rotateAuditLog(): void {
    try {
      const logsDir = path.dirname(this.auditLogPath);
      const baseName = path.basename(this.auditLogPath, '.log');
      
      // Remove oldest log if we have too many
      for (let i = this.maxFiles - 1; i >= 1; i--) {
        const oldFile = path.join(logsDir, `${baseName}.${i}.log`);
        if (i === this.maxFiles - 1 && fs.existsSync(oldFile)) {
          fs.unlinkSync(oldFile);
        } else if (fs.existsSync(oldFile)) {
          const newFile = path.join(logsDir, `${baseName}.${i + 1}.log`);
          fs.renameSync(oldFile, newFile);
        }
      }
      
      // Move current log to .1.log
      if (fs.existsSync(this.auditLogPath)) {
        const rotatedFile = path.join(logsDir, `${baseName}.1.log`);
        fs.renameSync(this.auditLogPath, rotatedFile);
      }
    } catch (error: any) {
      logger.error('Failed to rotate audit log:', error);
    }
  }

  static logPositionAction(action: string, symbol: string, details: any, userId?: string, ip?: string): void {
    this.logAction(`POSITION_${action}`, {
      symbol,
      ...details
    }, userId, ip);
  }

  static logConfigAction(action: string, configType: string, details: any, userId?: string, ip?: string): void {
    this.logAction(`CONFIG_${action}`, {
      configType,
      ...details
    }, userId, ip);
  }

  static logSecurityEvent(event: string, details: any, userId?: string, ip?: string): void {
    this.logAction(`SECURITY_${event}`, details, userId, ip);
  }

  static logAIAction(action: string, details: any, userId?: string, ip?: string): void {
    this.logAction(`AI_${action}`, details, userId, ip);
  }

  // Method to read audit logs for compliance
  static getAuditLogs(lines: number = 100): AuditEntry[] {
    try {
      if (!fs.existsSync(this.auditLogPath)) {
        return [];
      }

      const content = fs.readFileSync(this.auditLogPath, 'utf8');
      const logLines = content.trim().split('\n').filter(line => line.length > 0);
      const recentLines = logLines.slice(-lines);
      
      return recentLines.map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      }).filter(entry => entry !== null);
    } catch (error: any) {
      logger.error('Failed to read audit logs:', error);
      return [];
    }
  }
}
