// Hyperliquid Proxy Wrapper - Required for US IP restrictions
// All Hyperliquid API calls must go through this proxy

import { HttpsProxyAgent } from 'https-proxy-agent';
import { logger } from './logger.js';
import { getEnvOptional } from '../config/settings.js';

interface ProxyConfig {
  host: string;
  port: number;
  username?: string;
  password?: string;
}

// Proxy configuration
const PROXY_CONFIG = {
  // Default proxy for US access - only use if properly configured
  host: getEnvOptional('PROXY_HOST', ''),
  port: parseInt(getEnvOptional('PROXY_PORT', '8080')),
  username: getEnvOptional('PROXY_USERNAME', ''),
  password: getEnvOptional('PROXY_PASSWORD', ''),
  // Fallback proxies if primary fails
  fallbacks: [
    { host: 'proxy1.example.com', port: 8080 },
    { host: 'proxy2.example.com', port: 8080 },
  ]
};

// Check if proxy is properly configured
const isProxyEnabled = PROXY_CONFIG.host && PROXY_CONFIG.host !== 'us-east.proxysite.com';

export class HyperliquidProxy {
  private agent: HttpsProxyAgent<string> | null = null;
  private currentProxyIndex = 0;
  
  // Bandwidth tracking (all proxies share 1GB limit)
  private bytesSent = 0;
  private bytesReceived = 0;
  private requestCount = 0;
  private readonly BANDWIDTH_LIMIT = 1024 * 1024 * 1024; // 1GB in bytes
  private startTime = Date.now();

  constructor() {
    this.initializeProxy();
  }

  private initializeProxy(): void {
    try {
      // Skip proxy initialization if not properly configured
      if (!isProxyEnabled) {
        logger.info('Proxy not configured - using direct connection');
        this.agent = null;
        return;
      }

      const proxy = this.getCurrentProxy();
      
      // Construct proxy URL string as required by HttpsProxyAgent
      const proxyUrl = proxy.username && proxy.password 
        ? `http://${proxy.username}:${proxy.password}@${proxy.host}:${proxy.port}`
        : `http://${proxy.host}:${proxy.port}`;
      
      this.agent = new HttpsProxyAgent(proxyUrl);
      
      logger.info(`Initialized Hyperliquid proxy: ${proxy.host}:${proxy.port}`);
    } catch (error) {
      logger.error('Failed to initialize proxy:', error);
      this.tryNextProxy();
    }
  }

  private getCurrentProxy(): ProxyConfig {
    if (this.currentProxyIndex === 0) {
      return PROXY_CONFIG;
    }
    return PROXY_CONFIG.fallbacks[this.currentProxyIndex - 1] || PROXY_CONFIG;
  }

  private tryNextProxy(): void {
    this.currentProxyIndex++;
    if (this.currentProxyIndex <= PROXY_CONFIG.fallbacks.length) {
      logger.info(`Trying fallback proxy ${this.currentProxyIndex}`);
      this.initializeProxy();
    } else {
      logger.error('All proxies failed, proceeding without proxy (may fail for US IPs)');
      this.agent = null;
    }
  }

  public async makeRequest(url: string, body?: any): Promise<any> {
    const maxRetries = 3;
    let lastError: Error | null = null;

    // Track request body size
    const bodyString = body ? JSON.stringify(body) : '';
    const requestBytes = new TextEncoder().encode(bodyString).length + url.length + 200; // +200 for headers
    this.bytesSent += requestBytes;
    this.requestCount++;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Use node-fetch with agent support
        const fetch = (await import('node-fetch')).default;
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
          body: body ? JSON.stringify(body) : undefined,
          agent: this.agent || undefined,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const responseText = await response.text();
        const responseBytes = new TextEncoder().encode(responseText).length + 200; // +200 for headers
        this.bytesReceived += responseBytes;
        
        // Warn if approaching bandwidth limit
        const totalUsed = this.bytesSent + this.bytesReceived;
        const usagePercent = (totalUsed / this.BANDWIDTH_LIMIT) * 100;
        if (usagePercent > 80 && usagePercent < 81) {
          logger.warn(`[Proxy] Bandwidth usage at ${usagePercent.toFixed(1)}% - approaching 1GB limit!`);
        }

        return JSON.parse(responseText);
      } catch (error) {
        lastError = error as Error;
        logger.warn(`Proxy request attempt ${attempt} failed:`, error);
        
        if (attempt === maxRetries) {
          // Try next proxy for next request
          this.tryNextProxy();
        }
        
        // Brief delay before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }

    throw lastError;
  }

  public getProxyStatus() {
    return {
      active: this.agent !== null,
      currentProxy: this.getCurrentProxy(),
      proxyIndex: this.currentProxyIndex,
      totalProxies: PROXY_CONFIG.fallbacks.length + 1,
    };
  }

  public getBandwidthStats() {
    const totalBytes = this.bytesSent + this.bytesReceived;
    const usagePercent = (totalBytes / this.BANDWIDTH_LIMIT) * 100;
    const remainingBytes = Math.max(0, this.BANDWIDTH_LIMIT - totalBytes);
    const uptimeMs = Date.now() - this.startTime;
    const bytesPerHour = uptimeMs > 0 ? (totalBytes / uptimeMs) * 3600000 : 0;
    const hoursRemaining = bytesPerHour > 0 ? remainingBytes / bytesPerHour : Infinity;

    return {
      bytesSent: this.bytesSent,
      bytesReceived: this.bytesReceived,
      totalBytes,
      limitBytes: this.BANDWIDTH_LIMIT,
      usagePercent: Math.min(100, usagePercent),
      remainingBytes,
      requestCount: this.requestCount,
      // Human readable
      totalMB: (totalBytes / (1024 * 1024)).toFixed(2),
      remainingMB: (remainingBytes / (1024 * 1024)).toFixed(2),
      limitMB: (this.BANDWIDTH_LIMIT / (1024 * 1024)).toFixed(0),
      // Projection
      bytesPerHour: Math.round(bytesPerHour),
      hoursRemaining: hoursRemaining === Infinity ? 'N/A' : hoursRemaining.toFixed(1),
      uptimeMinutes: Math.round(uptimeMs / 60000),
    };
  }

  public resetBandwidthStats() {
    this.bytesSent = 0;
    this.bytesReceived = 0;
    this.requestCount = 0;
    this.startTime = Date.now();
    logger.info('[Proxy] Bandwidth stats reset');
  }
}

// Singleton instance
export const hyperliquidProxy = new HyperliquidProxy();
