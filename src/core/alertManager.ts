import { logger } from '../utils/logger.js';

interface Alert {
  id: string;
  type: 'success' | 'warning' | 'error' | 'info';
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
}

class AlertManager {
  private alerts: Alert[] = [];
  private readonly MAX_ALERTS = 100;

  addAlert(type: Alert['type'], title: string, message: string): void {
    const alert: Alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      type,
      title,
      message,
      timestamp: Date.now(),
      read: false
    };

    this.alerts.unshift(alert);
    
    if (this.alerts.length > this.MAX_ALERTS) {
      this.alerts.pop();
    }

    logger.info(`[AlertManager] ${type.toUpperCase()}: ${title} - ${message}`);
  }

  success(title: string, message: string): void {
    this.addAlert('success', title, message);
  }

  warning(title: string, message: string): void {
    this.addAlert('warning', title, message);
  }

  error(title: string, message: string): void {
    this.addAlert('error', title, message);
  }

  info(title: string, message: string): void {
    this.addAlert('info', title, message);
  }

  getAlerts(): Alert[] {
    return this.alerts;
  }

  getUnreadCount(): number {
    return this.alerts.filter(a => !a.read).length;
  }

  markAsRead(id: string): void {
    const alert = this.alerts.find(a => a.id === id);
    if (alert) {
      alert.read = true;
    }
  }

  markAllAsRead(): void {
    this.alerts.forEach(a => a.read = true);
  }

  clear(): void {
    this.alerts = [];
  }
}

export const alertManager = new AlertManager();
