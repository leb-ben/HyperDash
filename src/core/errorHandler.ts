/**
 * Enterprise Error Handler
 * 
 * Centralized error handling with:
 * - Error categorization
 * - Retry logic with exponential backoff
 * - Circuit breaker pattern
 * - Error reporting and metrics
 * - Graceful degradation
 */

import { logger } from '../utils/logger.js';

export enum ErrorCategory {
  NETWORK = 'NETWORK',
  API_RATE_LIMIT = 'API_RATE_LIMIT',
  AUTHENTICATION = 'AUTHENTICATION',
  VALIDATION = 'VALIDATION',
  EXCHANGE = 'EXCHANGE',
  AI_SERVICE = 'AI_SERVICE',
  DATABASE = 'DATABASE',
  CONFIGURATION = 'CONFIGURATION',
  UNKNOWN = 'UNKNOWN'
}

export enum ErrorSeverity {
  LOW = 'LOW',       // Log and continue
  MEDIUM = 'MEDIUM', // Retry with backoff
  HIGH = 'HIGH',     // Alert and pause
  CRITICAL = 'CRITICAL' // Emergency stop
}

export interface ErrorContext {
  operation: string;
  component: string;
  metadata?: Record<string, any>;
  retryCount?: number;
  maxRetries?: number;
}

export interface ProcessedError {
  id: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  message: string;
  originalError: Error;
  context: ErrorContext;
  timestamp: number;
  recoverable: boolean;
  retryAfterMs?: number;
}

interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
  isOpen: boolean;
  openedAt?: number;
}

const CIRCUIT_BREAKER_THRESHOLD = 5;
const CIRCUIT_BREAKER_RESET_MS = 60000; // 1 minute
const MAX_ERROR_HISTORY = 100;

class ErrorHandler {
  private errorHistory: ProcessedError[] = [];
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();
  private errorCallbacks: ((error: ProcessedError) => void)[] = [];

  /**
   * Process and categorize an error
   */
  processError(error: Error | unknown, context: ErrorContext): ProcessedError {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    const category = this.categorizeError(errorObj);
    const severity = this.determineSeverity(category, context);

    const processed: ProcessedError = {
      id: `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      category,
      severity,
      message: errorObj.message,
      originalError: errorObj,
      context,
      timestamp: Date.now(),
      recoverable: this.isRecoverable(category, severity),
      retryAfterMs: this.calculateRetryDelay(context.retryCount || 0, category)
    };

    this.recordError(processed);
    this.notifyCallbacks(processed);
    this.logError(processed);

    return processed;
  }

  /**
   * Categorize error based on message and type
   */
  private categorizeError(error: Error): ErrorCategory {
    const msg = error.message.toLowerCase();

    if (msg.includes('network') || msg.includes('econnrefused') || msg.includes('timeout') || msg.includes('socket')) {
      return ErrorCategory.NETWORK;
    }
    if (msg.includes('rate limit') || msg.includes('429') || msg.includes('too many requests')) {
      return ErrorCategory.API_RATE_LIMIT;
    }
    if (msg.includes('unauthorized') || msg.includes('authentication') || msg.includes('invalid api key') || msg.includes('401')) {
      return ErrorCategory.AUTHENTICATION;
    }
    if (msg.includes('validation') || msg.includes('invalid') || msg.includes('required')) {
      return ErrorCategory.VALIDATION;
    }
    if (msg.includes('exchange') || msg.includes('order') || msg.includes('position') || msg.includes('insufficient')) {
      return ErrorCategory.EXCHANGE;
    }
    if (msg.includes('openai') || msg.includes('cerebras') || msg.includes('anthropic') || msg.includes('ai') || msg.includes('model')) {
      return ErrorCategory.AI_SERVICE;
    }
    if (msg.includes('sqlite') || msg.includes('database') || msg.includes('query')) {
      return ErrorCategory.DATABASE;
    }
    if (msg.includes('config') || msg.includes('environment') || msg.includes('missing')) {
      return ErrorCategory.CONFIGURATION;
    }

    return ErrorCategory.UNKNOWN;
  }

  /**
   * Determine severity based on category and context
   */
  private determineSeverity(category: ErrorCategory, context: ErrorContext): ErrorSeverity {
    // Critical operations
    if (context.operation.includes('execute') || context.operation.includes('order')) {
      if (category === ErrorCategory.EXCHANGE) return ErrorSeverity.HIGH;
    }

    // Severity by category
    switch (category) {
      case ErrorCategory.AUTHENTICATION:
        return ErrorSeverity.CRITICAL;
      case ErrorCategory.CONFIGURATION:
        return ErrorSeverity.CRITICAL;
      case ErrorCategory.API_RATE_LIMIT:
        return ErrorSeverity.MEDIUM;
      case ErrorCategory.NETWORK:
        return context.retryCount && context.retryCount > 2 ? ErrorSeverity.HIGH : ErrorSeverity.MEDIUM;
      case ErrorCategory.EXCHANGE:
        return ErrorSeverity.HIGH;
      case ErrorCategory.AI_SERVICE:
        return ErrorSeverity.MEDIUM;
      case ErrorCategory.DATABASE:
        return ErrorSeverity.HIGH;
      case ErrorCategory.VALIDATION:
        return ErrorSeverity.LOW;
      default:
        return ErrorSeverity.MEDIUM;
    }
  }

  /**
   * Check if error is recoverable
   */
  private isRecoverable(category: ErrorCategory, severity: ErrorSeverity): boolean {
    if (severity === ErrorSeverity.CRITICAL) return false;
    if (category === ErrorCategory.AUTHENTICATION) return false;
    if (category === ErrorCategory.CONFIGURATION) return false;
    return true;
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(retryCount: number, category: ErrorCategory): number {
    const baseDelay = category === ErrorCategory.API_RATE_LIMIT ? 10000 : 1000;
    const maxDelay = 60000;
    const delay = Math.min(baseDelay * Math.pow(2, retryCount), maxDelay);
    // Add jitter
    return delay + Math.random() * 1000;
  }

  /**
   * Log error appropriately
   */
  private logError(error: ProcessedError): void {
    const logMsg = `[${error.category}] ${error.context.component}::${error.context.operation} - ${error.message}`;

    switch (error.severity) {
      case ErrorSeverity.CRITICAL:
        logger.error(`CRITICAL: ${logMsg}`);
        console.error('\n' + '='.repeat(60));
        console.error('CRITICAL ERROR - IMMEDIATE ATTENTION REQUIRED');
        console.error('='.repeat(60));
        console.error(logMsg);
        console.error('='.repeat(60) + '\n');
        break;
      case ErrorSeverity.HIGH:
        logger.error(`❌ HIGH: ${logMsg}`);
        break;
      case ErrorSeverity.MEDIUM:
        logger.warn(`MEDIUM: ${logMsg}`);
        break;
      case ErrorSeverity.LOW:
        logger.debug(`ℹ️ LOW: ${logMsg}`);
        break;
    }
  }

  /**
   * Record error to history
   */
  private recordError(error: ProcessedError): void {
    this.errorHistory.unshift(error);
    if (this.errorHistory.length > MAX_ERROR_HISTORY) {
      this.errorHistory.pop();
    }
  }

  /**
   * Execute with retry logic
   */
  async withRetry<T>(
    operation: () => Promise<T>,
    context: ErrorContext,
    maxRetries: number = 3
  ): Promise<T> {
    let lastError: ProcessedError | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      // Check circuit breaker
      if (this.isCircuitOpen(context.component)) {
        throw new Error(`Circuit breaker open for ${context.component}`);
      }

      try {
        const result = await operation();
        // Reset circuit breaker on success
        this.resetCircuitBreaker(context.component);
        return result;
      } catch (error) {
        lastError = this.processError(error, { 
          ...context, 
          retryCount: attempt, 
          maxRetries 
        });

        if (!lastError.recoverable || attempt >= maxRetries) {
          this.recordCircuitFailure(context.component);
          throw error;
        }

        // Wait before retry
        if (lastError.retryAfterMs) {
          logger.debug(`Retrying ${context.operation} in ${lastError.retryAfterMs}ms (attempt ${attempt + 1}/${maxRetries})`);
          await this.sleep(lastError.retryAfterMs);
        }
      }
    }

    throw lastError?.originalError || new Error('Max retries exceeded');
  }

  /**
   * Circuit breaker: check if open
   */
  private isCircuitOpen(component: string): boolean {
    const state = this.circuitBreakers.get(component);
    if (!state?.isOpen) return false;

    // Check if should reset
    if (state.openedAt && Date.now() - state.openedAt > CIRCUIT_BREAKER_RESET_MS) {
      this.resetCircuitBreaker(component);
      return false;
    }

    return true;
  }

  /**
   * Circuit breaker: record failure
   */
  private recordCircuitFailure(component: string): void {
    const state = this.circuitBreakers.get(component) || { 
      failures: 0, 
      lastFailure: 0, 
      isOpen: false 
    };

    state.failures++;
    state.lastFailure = Date.now();

    if (state.failures >= CIRCUIT_BREAKER_THRESHOLD) {
      state.isOpen = true;
      state.openedAt = Date.now();
      logger.warn(`🔌 Circuit breaker OPENED for ${component}`);
    }

    this.circuitBreakers.set(component, state);
  }

  /**
   * Circuit breaker: reset
   */
  private resetCircuitBreaker(component: string): void {
    this.circuitBreakers.set(component, { 
      failures: 0, 
      lastFailure: 0, 
      isOpen: false 
    });
  }

  /**
   * Register error callback
   */
  onError(callback: (error: ProcessedError) => void): void {
    this.errorCallbacks.push(callback);
  }

  /**
   * Notify all callbacks
   */
  private notifyCallbacks(error: ProcessedError): void {
    for (const callback of this.errorCallbacks) {
      try {
        callback(error);
      } catch (e) {
        // Don't let callback errors break the handler
      }
    }
  }

  /**
   * Get recent errors
   */
  getRecentErrors(limit: number = 20): ProcessedError[] {
    return this.errorHistory.slice(0, limit);
  }

  /**
   * Get error statistics
   */
  getStats(): { byCategory: Record<string, number>; bySeverity: Record<string, number>; total: number } {
    const byCategory: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};

    for (const error of this.errorHistory) {
      byCategory[error.category] = (byCategory[error.category] || 0) + 1;
      bySeverity[error.severity] = (bySeverity[error.severity] || 0) + 1;
    }

    return { byCategory, bySeverity, total: this.errorHistory.length };
  }

  /**
   * Check system health
   */
  getHealthStatus(): { healthy: boolean; issues: string[] } {
    const issues: string[] = [];
    const recentErrors = this.errorHistory.filter(e => Date.now() - e.timestamp < 300000); // Last 5 min

    // Check for critical errors
    const criticalErrors = recentErrors.filter(e => e.severity === ErrorSeverity.CRITICAL);
    if (criticalErrors.length > 0) {
      issues.push(`${criticalErrors.length} critical error(s) in last 5 minutes`);
    }

    // Check for open circuit breakers
    for (const [component, state] of this.circuitBreakers) {
      if (state.isOpen) {
        issues.push(`Circuit breaker open: ${component}`);
      }
    }

    // Check for high error rate
    if (recentErrors.length > 20) {
      issues.push(`High error rate: ${recentErrors.length} errors in 5 minutes`);
    }

    return { healthy: issues.length === 0, issues };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const errorHandler = new ErrorHandler();
