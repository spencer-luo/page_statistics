import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import config from '../config';
import logger from '../logger';

interface PageData {
  pv: number;
  uv: Set<string>;
  lastUpdated: number;
}

interface SiteStats {
  pv: number;
  uv: Set<string>;
  daily: Record<string, { pv: number; uv: Set<string> }>;
}

interface DomainStatsData {
  site: SiteStats;
  pages: Record<string, PageData>;
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
    };
    this.storageFile = "";
    this.backupFile = "";

    this.init();
  }

  private async init(): Promise<void> {
    try {
      this.initStorageFile();
      this.loadData();
      logger.info(`Statistics data loaded for domain: ${this.domain}`);
    } catch (error) {
      logger.info(`No existing data found for domain: ${this.domain}, starting fresh`);
    }
  }

  private async initStorageFile(): Promise<void> {
    try {
      const directory = path.resolve(__dirname, '..', config.storage.directory);
      this.storageFile =  path.resolve(directory, `${this.domain}.json`);
      const backupDirectory = path.resolve(__dirname, '..', config.storage.backupDirectory);
      this.backupFile =  path.resolve(backupDirectory, `${this.domain}.json`);

      await fs.mkdir(directory, { recursive: true });
      await fs.mkdir(backupDirectory, { recursive: true });
    } catch (error) {
      logger.error(`Failed to create storage directories: ${(error as Error).message}`);
      throw error;
    }
  }

  private async loadData(): Promise<void> {
    try {
      const fileData = await fs.readFile(this.storageFile, 'utf8');
      const parsedData = JSON.parse(fileData);
      // TODO
      // logger.info(`loadData storageFile: ${this.storageFile} data: ${fileData}`);
      
      // 重建Set对象
      parsedData.site.uv = new Set(parsedData.site.uv || []);
      // 转换daily中的Set数据
      Object.keys(parsedData.site.daily).forEach(date => {
        if (parsedData.site.daily[date].uv && Array.isArray(parsedData.site.daily[date].uv)) {
          parsedData.site.daily[date].uv = new Set(parsedData.site.daily[date].uv);
        }
      });
      // 转换pages中的Set数据
      Object.keys(parsedData.pages).forEach(path => {
        if (parsedData.pages[path].uv && Array.isArray(parsedData.pages[path].uv)) {
          parsedData.pages[path].uv = new Set(parsedData.pages[path].uv);
        }
      });

      this.data = parsedData;
    } catch (error) {
      logger.warn(`Failed to load ${this.storageFile}, save init data to file.`)
      this.saveData();
      // throw new Error(`Failed to load statistics data: ${(error as Error).message}`);
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
      
      // 保存数据
      await fs.writeFile(this.storageFile, JSON.stringify(dataToSave, null, 2));
    } catch (error) {
      logger.error(`Failed to save statistics data: ${(error as Error).message}`);
      throw error;
    }
  }

  async createBackup(): Promise<void> {
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
    const timestamp = Date.now();
    
    // 更新网站统计
    this.data.site.pv++;
    this.data.site.uv.add(clientId);
    // 更新每日统计
    const today = new Date().toISOString().split('T')[0];
    if (!this.data.site.daily[today]) {
      this.data.site.daily[today] = {
        pv: 0,
        uv: new Set()
      };
    }
    this.data.site.daily[today].pv++;
    this.data.site.daily[today].uv.add(clientId);
    
    // 更新页面统计
    if (!this.data.pages[pagePath]) {
      this.data.pages[pagePath] = {
        pv: 0,
        uv: new Set(),
        lastUpdated: timestamp
      };
    }
    this.data.pages[pagePath].pv++;
    this.data.pages[pagePath].uv.add(clientId);
    this.data.pages[pagePath].lastUpdated = timestamp;
  }

  getPageStats(pagePath: string): { pv: number; uv: number; lastUpdated: number } {
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

  getDailyStats(date?: string): { pv: number; uv: number } {
    const dateKey = date || new Date().toISOString().split('T')[0];
    const dailyData = this.data.site.daily[dateKey];
    if (!dailyData)
    {
      return { pv: 0, uv: 0 };
    }
    return {pv: dailyData.pv, uv: dailyData.uv.size};
  }

  getSiteStats() {
    const today = new Date().toDateString();
    const dailyData = this.data.site.daily[today] || { pv: 0, uv: new Set() };

    return {
      total: {
        pv: this.data.site.pv,
        uv: this.data.site.uv.size
      },
      today: {
        pv: dailyData.pv,
        uv: dailyData.uv.size
      },
      // 可以大致的表示网站的文档数(文章数量)，注意：这里不会包含新建但还未访问的页面。
      pages: Object.keys(this.data.pages).length
    };
  }

  resetDailyStats(): void {
    const today = new Date().toISOString().split('T')[0];
    this.data.site.daily[today] = { pv: 0, uv: new Set() };
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
        // 先创建备份
        await domain.createBackup();
        // 再保存
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
}

// 创建单例实例
export default new PageStatsManager();