import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import config from '../config';
import logger from '../logger';

// 定义数据结构接口
interface Session {
  startTime: number;
  lastActive: number;
  pageViews: string[];
}

interface PageData {
  pv: number;
  uv: Set<string>;
  lastUpdated: number;
}

interface SiteStats {
  pv: number;
  uv: Set<string>;
  daily: Record<string, { pv: number; uv: number }>;
}

interface DomainStatsData {
  site: SiteStats;
  pages: Record<string, PageData>;
  sessions: Record<string, Session>;
}

class DomainStats {
  private domain: string;
  private data: DomainStatsData;
  private storageFile: string;
  private backupFile: string;

  constructor(domain: string) {
    this.domain = domain;
    this.data = {
      site: {
        pv: 0,
        uv: new Set(),
        daily: {}
      },
      pages: {},
      sessions: {}
    };
    this.storageFile = this.getStorageFilePath();
    this.backupFile = this.getBackupFilePath();
    this.init();
  }

  private getStorageFilePath(): string {
    return path.resolve(__dirname, '..', config.storage.directory, `${this.domain}.json`);
  }

  private getBackupFilePath(): string {
    return path.resolve(__dirname, '..', config.storage.backupDirectory, `${this.domain}-${Date.now()}.json`);
  }

  private async init(): Promise<void> {
    try {
      await this.ensureDirectories();
      await this.loadData();
      logger.info(`Statistics data loaded for domain: ${this.domain}`);
    } catch (error) {
      logger.info(`No existing data found for domain: ${this.domain}, starting fresh`);
    }
  }

  private async ensureDirectories(): Promise<void> {
    try {
      await fs.mkdir(config.storage.directory, { recursive: true });
      await fs.mkdir(config.storage.backupDirectory, { recursive: true });
    } catch (error) {
      logger.error(`Failed to create storage directories: ${(error as Error).message}`);
      throw error;
    }
  }

  private async loadData(): Promise<void> {
    try {
      const data = await fs.readFile(this.storageFile, 'utf8');
      const parsedData = JSON.parse(data);
      
      // 重建Set对象
      if (parsedData.site && parsedData.site.uv) {
        parsedData.site.uv = new Set(parsedData.site.uv);
      }
      
      if (parsedData.pages) {
        Object.keys(parsedData.pages).forEach(pagePath => {
          if (parsedData.pages[pagePath].uv) {
            parsedData.pages[pagePath].uv = new Set(parsedData.pages[pagePath].uv);
          }
        });
      }
      
      this.data = parsedData;
    } catch (error) {
      throw new Error(`Failed to load statistics data: ${(error as Error).message}`);
    }
  }

  async saveData(): Promise<void> {
    try {
      // 转换Set为数组以便序列化
      const dataToSave = JSON.parse(JSON.stringify(this.data, (key, value) => {
        if (value instanceof Set) {
          return Array.from(value);
        }
        return value;
      }));
      
      // 先创建备份
      await this.createBackup();
      
      // 保存数据
      await fs.writeFile(this.storageFile, JSON.stringify(dataToSave, null, 2));
    } catch (error) {
      logger.error(`Failed to save statistics data: ${(error as Error).message}`);
      throw error;
    }
  }

  private async createBackup(): Promise<void> {
    try {
      // 检查是否存在现有文件
      await fs.stat(this.storageFile);
      // 如果存在，创建备份
      await fs.copyFile(this.storageFile, this.backupFile);
    } catch (error) {
      // 文件不存在，不需要创建备份
    }
  }

  trackPageView(pagePath: string, clientId: string): void {
    const now = Date.now();
    
    // 更新网站统计
    this.data.site.pv++;
    this.data.site.uv.add(clientId);
    
    // 更新页面统计
    if (!this.data.pages[pagePath]) {
      this.data.pages[pagePath] = {
        pv: 0,
        uv: new Set(),
        lastUpdated: now
      };
    }
    
    this.data.pages[pagePath].pv++;
    this.data.pages[pagePath].uv.add(clientId);
    this.data.pages[pagePath].lastUpdated = now;
    
    // 更新会话
    if (!this.data.sessions[clientId]) {
      this.data.sessions[clientId] = {
        startTime: now,
        lastActive: now,
        pageViews: []
      };
    }
    
    this.data.sessions[clientId].lastActive = now;
    this.data.sessions[clientId].pageViews.push(pagePath);
    
    // 更新每日统计
    const dateKey = new Date().toISOString().split('T')[0];
    if (!this.data.site.daily[dateKey]) {
      this.data.site.daily[dateKey] = { pv: 0, uv: 0 };
    }
    
    this.data.site.daily[dateKey].pv++;
    
    // 检查该客户端是否已经在今天被统计过
    const todaySessions = Object.keys(this.data.sessions)
      .filter(sessionId => {
        const session = this.data.sessions[sessionId];
        return session.startTime >= new Date(dateKey).getTime();
      });
    
    this.data.site.daily[dateKey].uv = todaySessions.length;
  }

  getPageStats(pagePath?: string): { pv: number; uv: number; lastUpdated: number } {
    if (pagePath) {
      const page = this.data.pages[pagePath];
      if (!page) {
        return { pv: 0, uv: 0, lastUpdated: 0 };
      }
      return {
        pv: page.pv,
        uv: page.uv.size,
        lastUpdated: page.lastUpdated
      };
    }
    
    // 返回所有页面的统计
    return {
      pv: this.data.site.pv,
      uv: this.data.site.uv.size,
      lastUpdated: Date.now()
    };
  }

  getDailyStats(date?: string): { pv: number; uv: number } {
    const dateKey = date || new Date().toISOString().split('T')[0];
    return this.data.site.daily[dateKey] || { pv: 0, uv: 0 };
  }

  getTopPages(limit: number = 10): Array<{ path: string; pv: number; uv: number }> {
    return Object.keys(this.data.pages)
      .map(path => ({
        path: path,
        pv: this.data.pages[path].pv,
        uv: this.data.pages[path].uv.size
      }))
      .sort((a, b) => b.pv - a.pv)
      .slice(0, limit);
  }

  cleanupExpiredSessions(): void {
    const now = Date.now();
    const sessionTimeout = config.stats.uvWindow * 60 * 1000;
    
    Object.keys(this.data.sessions).forEach(sessionId => {
      const session = this.data.sessions[sessionId];
      if (now - session.lastActive > sessionTimeout) {
        delete this.data.sessions[sessionId];
      }
    });
  }

  resetDailyStats(): void {
    const today = new Date().toISOString().split('T')[0];
    this.data.site.daily[today] = { pv: 0, uv: 0 };
  }

  get domainName(): string {
    return this.domain;
  }

  get allPages(): Record<string, PageData> {
    return this.data.pages;
  }
}

class PageStatsManager {
  private domains: Record<string, DomainStats> = {};
  private saveInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.initAutoSave();
    this.initDailyReset();
  }

  private initAutoSave(): void {
    const intervalMs = config.stats.saveInterval * 60 * 1000;
    this.saveInterval = setInterval(() => {
      this.saveAllData();
    }, intervalMs);
  }

  private initDailyReset(): void {
    // 设置每天凌晨重置统计
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const msUntilReset = tomorrow.getTime() - now.getTime();
    
    setTimeout(() => {
      this.resetAllDailyStats();
      // 设置为每天执行
      setInterval(() => {
        this.resetAllDailyStats();
      }, 24 * 60 * 60 * 1000);
    }, msUntilReset);
  }

  getDomainStats(domain: string): DomainStats {
    // 检查域名是否在白名单中
    if (config.security.allowedDomains.length > 0 && 
        !config.security.allowedDomains.includes(domain)) {
      logger.warn(`Domain ${domain} is not in allowed list`);
    }
    
    if (!this.domains[domain]) {
      this.domains[domain] = new DomainStats(domain);
    }
    return this.domains[domain];
  }

  async saveAllData(): Promise<void> {
    try {
      for (const domain of Object.values(this.domains)) {
        domain.cleanupExpiredSessions();
        await domain.saveData();
      }
      logger.info('All statistics data saved successfully');
    } catch (error) {
      logger.error(`Failed to save all statistics data: ${(error as Error).message}`);
    }
  }

  private resetAllDailyStats(): void {
    try {
      for (const domain of Object.values(this.domains)) {
        domain.resetDailyStats();
      }
      logger.info('Daily statistics reset successfully');
    } catch (error) {
      logger.error(`Failed to reset daily statistics: ${(error as Error).message}`);
    }
  }

  // 清理过期会话
  cleanupAllSessions(): void {
    for (const domain of Object.values(this.domains)) {
      domain.cleanupExpiredSessions();
    }
  }

  // 获取所有域名
  getAllDomains(): string[] {
    return Object.keys(this.domains);
  }
}

// 创建单例实例
export default new PageStatsManager();