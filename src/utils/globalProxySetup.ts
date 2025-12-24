import { HttpsProxyAgent } from 'https-proxy-agent';
import nodeFetch from 'node-fetch';
import { getEnvOptional } from '../config/settings.js';
import { bandwidthTracker } from '../core/bandwidthTracker.js';

const proxyHost = getEnvOptional('PROXY_HOST', '');
const proxyPort = getEnvOptional('PROXY_PORT', '');
const proxyUser = getEnvOptional('PROXY_USERNAME', '');
const proxyPass = getEnvOptional('PROXY_PASSWORD', '');

if (proxyHost && proxyPort) {
  const proxyUrl = proxyUser && proxyPass
    ? `http://${proxyUser}:${proxyPass}@${proxyHost}:${proxyPort}`
    : `http://${proxyHost}:${proxyPort}`;

  const proxyAgent = new HttpsProxyAgent(proxyUrl);

  // Patch global fetch to use proxy and track bandwidth
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url: any, options: any = {}) => {
    // Estimate request size
    const requestSize = options?.body ? 
      (typeof options.body === 'string' ? options.body.length : JSON.stringify(options.body).length) : 
      0;
    
    const startTime = Date.now();
    
    try {
      const response = await originalFetch(url, {
        ...options,
        agent: proxyAgent
      });
      
      // Track response size
      const responseText = await response.clone().text();
      const responseSize = responseText.length;
      
      // Record bandwidth usage
      bandwidthTracker.recordUsage(
        typeof url === 'string' ? url.split('?')[0] : 'unknown',
        requestSize,
        responseSize
      );
      
      return response;
    } catch (error) {
      console.error(`[Proxy] Request failed: ${url}`, error);
      throw error;
    }
  };

  console.log(`[Proxy] Global fetch patched: ${proxyHost}:${proxyPort}`);
} else {
  console.log('[Proxy] Not configured - using direct connection');
}
