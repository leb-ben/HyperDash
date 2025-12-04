import { logger } from '../utils/logger.js';

export interface SecurityConfig {
  maxPositionSize: number;
  allowedSymbols: string[];
  rateLimitWindow: number;
  rateLimitMax: number;
}

const SECURITY_CONFIG: SecurityConfig = {
  maxPositionSize: 50000, // $50,000 max per position
  allowedSymbols: ['BTC', 'ETH', 'SOL', 'HYPE', 'JUP'],
  rateLimitWindow: 60000, // 1 minute
  rateLimitMax: 100 // 100 requests per minute
};

// Rate limiting in-memory store
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export class SecurityValidator {
  static validateSymbol(symbol: string): { valid: boolean; error?: string } {
    const upperSymbol = symbol.toUpperCase();
    
    if (!SECURITY_CONFIG.allowedSymbols.includes(upperSymbol)) {
      return { 
        valid: false, 
        error: `Symbol ${symbol} not allowed. Allowed symbols: ${SECURITY_CONFIG.allowedSymbols.join(', ')}` 
      };
    }
    
    return { valid: true };
  }

  static validatePositionSize(size: number): { valid: boolean; error?: string } {
    if (size <= 0) {
      return { valid: false, error: 'Position size must be greater than 0' };
    }
    
    if (size > SECURITY_CONFIG.maxPositionSize) {
      return { 
        valid: false, 
        error: `Position size $${size} exceeds maximum of $${SECURITY_CONFIG.maxPositionSize}` 
      };
    }
    
    return { valid: true };
  }

  static validateLeverage(leverage: number): { valid: boolean; error?: string } {
    if (leverage < 1 || leverage > 10) {
      return { valid: false, error: 'Leverage must be between 1x and 10x' };
    }
    
    return { valid: true };
  }

  static sanitizeCommand(command: string): string {
    // Remove potentially dangerous characters
    return command.replace(/[;&|`$(){}[\]]/g, '').trim();
  }

  static checkRateLimit(clientId: string): { allowed: boolean; error?: string } {
    const now = Date.now();
    const client = rateLimitStore.get(clientId);
    
    if (!client || now > client.resetTime) {
      // Reset or create new rate limit entry
      rateLimitStore.set(clientId, {
        count: 1,
        resetTime: now + SECURITY_CONFIG.rateLimitWindow
      });
      return { allowed: true };
    }
    
    if (client.count >= SECURITY_CONFIG.rateLimitMax) {
      return { 
        allowed: false, 
        error: `Rate limit exceeded. Max ${SECURITY_CONFIG.rateLimitMax} requests per ${SECURITY_CONFIG.rateLimitWindow / 1000} seconds` 
      };
    }
    
    client.count++;
    return { allowed: true };
  }

  static logSecurityEvent(event: string, details: any, clientId?: string): void {
    logger.warn('SECURITY', {
      event,
      details,
      clientId,
      timestamp: new Date().toISOString()
    });
  }
}

export class AuditLogger {
  static logAction(action: string, details: any, userId?: string): void {
    const auditEntry = {
      timestamp: new Date().toISOString(),
      action,
      details,
      userId: userId || 'anonymous',
      ip: details.ip || 'unknown'
    };
    
    logger.info('AUDIT', auditEntry);
    
    // In production, write to secure audit log storage
    // For now, just log to console
    console.log(`[AUDIT] ${auditEntry.timestamp} - ${auditEntry.action} by ${auditEntry.userId}`);
  }

  static logPositionAction(action: string, symbol: string, details: any, userId?: string): void {
    this.logAction(`POSITION_${action}`, {
      symbol,
      ...details
    }, userId);
  }

  static logConfigAction(action: string, configType: string, details: any, userId?: string): void {
    this.logAction(`CONFIG_${action}`, {
      configType,
      ...details
    }, userId);
  }
}
