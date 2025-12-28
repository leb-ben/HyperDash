/**
 * Get optimal strategies API endpoint
 * Retrieves saved most profitable strategies per symbol
 */

import { getStrategyPersistence } from '../persistence/strategyPersistence.js'
import { logger } from '../utils/logger.js'
import type { IncomingMessage, ServerResponse } from 'http'

export async function getOptimalStrategies(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    const persistence = getStrategyPersistence()
    const strategies = persistence.getLatestOptimalStrategies()

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ 
      success: true, 
      data: strategies,
      count: strategies.length
    }))
  } catch (error) {
    logger.error('Failed to get optimal strategies:', error)
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Failed to fetch optimal strategies' }))
  }
}
