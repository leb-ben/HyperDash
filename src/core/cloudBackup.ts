/**
 * Cloud Backup for Trading State
 * Syncs state to cloud storage for disaster recovery
 * Supports local file backup and optional cloud sync
 */

import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger.js';
import crypto from 'crypto';

export interface BackupConfig {
  enabled: boolean;
  localCopies: number;
  cloudProvider?: 'dropbox' | 'google-drive' | 'aws-s3';
  cloudCredentials?: {
    accessToken?: string;
    bucket?: string;
    region?: string;
  };
  backupInterval: number; // minutes
}

export class CloudBackup {
  private config: BackupConfig;
  private backupDir: string;
  private backupInterval: NodeJS.Timeout | null = null;

  constructor(config: Partial<BackupConfig> = {}) {
    this.config = {
      enabled: true,
      localCopies: 5,
      backupInterval: 10, // Every 10 minutes
      ...config
    };
    
    this.backupDir = path.join(process.cwd(), 'backups');
    this.ensureBackupDir();
    
    if (this.config.enabled) {
      this.startBackup();
    }
  }

  private ensureBackupDir(): void {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
      logger.info('📁 Created backup directory');
    }
  }

  /**
   * Backup state to local storage and optionally cloud
   */
  async backupState(stateData: any): Promise<void> {
    try {
      const timestamp = Date.now();
      const hash = this.calculateHash(JSON.stringify(stateData));
      
      // Create backup filename
      const backupFile = path.join(this.backupDir, `trading-state-${timestamp}.json`);
      
      // Add metadata
      const backupData = {
        timestamp,
        hash,
        version: '1.0',
        data: stateData
      };
      
      // Save local backup
      fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2));
      logger.info(`State backed up locally: ${path.basename(backupFile)}`);
      
      // Clean old local backups
      this.cleanOldBackups();
      
      // Cloud backup (if configured)
      if (this.config.cloudProvider) {
        await this.cloudBackup(backupFile, backupData);
      }
      
    } catch (error: any) {
      logger.error('Backup failed:', error);
    }
  }

  /**
   * Restore state from the most recent backup
   */
  async restoreState(): Promise<any | null> {
    try {
      // Try local backups first
      const localBackup = this.getLatestLocalBackup();
      if (localBackup) {
        const isValid = this.validateBackup(localBackup);
        if (isValid) {
          logger.info('State restored from local backup');
          return localBackup.data;
        }
      }
      
      // Try cloud backup (if configured)
      if (this.config.cloudProvider) {
        const cloudBackup = await this.getLatestCloudBackup();
        if (cloudBackup) {
          const isValid = this.validateBackup(cloudBackup);
          if (isValid) {
            logger.info('State restored from cloud backup');
            return cloudBackup.data;
          }
        }
      }
      
      logger.warn('No valid backup found');
      return null;
      
    } catch (error: any) {
      logger.error('Restore failed:', error);
      return null;
    }
  }

  private calculateHash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  private cleanOldBackups(): void {
    try {
      const files = fs.readdirSync(this.backupDir)
        .filter(f => f.startsWith('trading-state-') && f.endsWith('.json'))
        .map(f => ({
          name: f,
          path: path.join(this.backupDir, f),
          time: fs.statSync(path.join(this.backupDir, f)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time);
      
      // Keep only the most recent backups
      const filesToDelete = files.slice(this.config.localCopies);
      
      for (const file of filesToDelete) {
        fs.unlinkSync(file.path);
        logger.debug(`Deleted old backup: ${file.name}`);
      }
      
    } catch (error) {
      logger.error('Failed to clean old backups:', error);
    }
  }

  private getLatestLocalBackup(): any | null {
    try {
      const files = fs.readdirSync(this.backupDir)
        .filter(f => f.startsWith('trading-state-') && f.endsWith('.json'))
        .map(f => ({
          name: f,
          path: path.join(this.backupDir, f),
          time: fs.statSync(path.join(this.backupDir, f)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time);
      
      if (files.length === 0) return null;
      
      const latestFile = files[0];
      if (!latestFile) return null;
      const data = fs.readFileSync(latestFile.path, 'utf8');
      return JSON.parse(data);
      
    } catch (error) {
      logger.error('Failed to get latest local backup:', error);
      return null;
    }
  }

  private validateBackup(backup: any): boolean {
    try {
      // Check required fields
      if (!backup.timestamp || !backup.hash || !backup.data) {
        return false;
      }
      
      // Verify hash
      const calculatedHash = this.calculateHash(JSON.stringify(backup.data));
      if (calculatedHash !== backup.hash) {
        logger.error('Backup hash validation failed - data may be corrupted');
        return false;
      }
      
      return true;
      
    } catch (error) {
      logger.error('Backup validation failed:', error);
      return false;
    }
  }

  private async cloudBackup(localFile: string, backupData: any): Promise<void> {
    // Placeholder for cloud backup implementation
    // You would implement specific cloud provider logic here
    logger.info(`☁️  Cloud backup to ${this.config.cloudProvider} not implemented yet`);
  }

  private async getLatestCloudBackup(): Promise<any | null> {
    // Placeholder for cloud restore implementation
    logger.info(`☁️  Cloud restore from ${this.config.cloudProvider} not implemented yet`);
    return null;
  }

  private startBackup(): void {
    const intervalMs = this.config.backupInterval * 60 * 1000;
    
    this.backupInterval = setInterval(() => {
      // This would be called by state persistence
      logger.debug(`Backup interval triggered (${this.config.backupInterval} minutes)`);
    }, intervalMs);
    
    logger.info(`Cloud backup started (every ${this.config.backupInterval} minutes)`);
  }

  stopBackup(): void {
    if (this.backupInterval) {
      clearInterval(this.backupInterval);
      this.backupInterval = null;
      logger.info('⏹️ Cloud backup stopped');
    }
  }

  getBackupInfo(): {
    localBackups: number;
    totalBackupSize: number;
    latestBackup?: string;
    cloudEnabled: boolean;
  } {
    try {
      const files = fs.readdirSync(this.backupDir)
        .filter(f => f.startsWith('trading-state-') && f.endsWith('.json'));
      
      let totalBackupSize = 0;
      let latestBackup: string | undefined;
      
      for (const file of files) {
        const filePath = path.join(this.backupDir, file);
        const stats = fs.statSync(filePath);
        totalBackupSize += stats.size;
        
        if (!latestBackup || stats.mtime > fs.statSync(path.join(this.backupDir, latestBackup)).mtime) {
          latestBackup = file;
        }
      }
      
      return {
        localBackups: files.length,
        totalBackupSize,
        latestBackup,
        cloudEnabled: !!this.config.cloudProvider
      };
      
    } catch (error) {
      logger.error('Failed to get backup info:', error);
      return {
        localBackups: 0,
        totalBackupSize: 0,
        cloudEnabled: !!this.config.cloudProvider
      };
    }
  }
}

export const cloudBackup = new CloudBackup();
