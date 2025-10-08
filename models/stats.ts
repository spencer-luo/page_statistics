import fs from "fs/promises";
import path from "path";
import config from "../config";
import logger from "../logger";
import UvCounter from "../counter/uvcounter";

interface PageData {
  pv: number;
  uv: UvCounter;
  lastUpdated: number;
}

interface SiteStats {
  pv: number;
  uv: UvCounter;
  daily: Record<string, { pv: number; uv: UvCounter }>;
}

interface DomainStatsData {
  site: SiteStats;
  pages: Record<string, PageData>;
}

// 日期格式化函数
function formatDate(timestamp: number): string {
  return new Date(timestamp).toISOString().split("T")[0];
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
        uv: new UvCounter(),
        daily: {},
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
      logger.info(
        `No existing data found for domain: ${this.domain}, starting fresh`
      );
    }
  }

  private async initStorageFile(): Promise<void> {
    try {
      const directory = path.resolve(__dirname, "..", config.storage.directory);
      this.storageFile = path.resolve(directory, `${this.domain}.json`);
      const backupDirectory = path.resolve(
        __dirname,
        "..",
        config.storage.backupDirectory
      );
      this.backupFile = path.resolve(backupDirectory, `${this.domain}.json`);

      await fs.mkdir(directory, { recursive: true });
      await fs.mkdir(backupDirectory, { recursive: true });
    } catch (error) {
      logger.error(
        `Failed to create storage directories: ${(error as Error).message}`
      );
      throw error;
    }
  }

  private async loadData(): Promise<void> {
    try {
      const fileData = await fs.readFile(this.storageFile, "utf8");
      const parsedData = JSON.parse(fileData);
      // logger.info(`loadData storageFile: ${this.storageFile} data: ${fileData}`);

      // 重建Set对象
      parsedData.site.uv = UvCounter.fromJSON(parsedData.site.uv);
      // 转换daily中的Set数据
      Object.keys(parsedData.site.daily).forEach((date) => {
        if (parsedData.site.daily[date].uv) {
          parsedData.site.daily[date].uv = UvCounter.fromJSON(
            parsedData.site.daily[date].uv
          );
        }
      });
      // 转换pages中的Set数据
      Object.keys(parsedData.pages).forEach((path) => {
        if (parsedData.pages[path].uv) {
          parsedData.pages[path].uv = UvCounter.fromJSON(
            parsedData.pages[path].uv
          );
        }
      });

      this.data = parsedData;
    } catch (error) {
      logger.warn(
        `Failed to load ${this.storageFile}, save init data to file.`
      );
      this.saveData();
      // throw new Error(`Failed to load statistics data: ${(error as Error).message}`);
    }
  }

  async saveData(): Promise<void> {
    try {
      // 保存数据
      await fs.writeFile(this.storageFile, JSON.stringify(this.data, null, 2));
    } catch (error) {
      logger.error(
        `Failed to save statistics data: ${(error as Error).message}`
      );
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

  /**
   * 保留最近N天的daily数据记录
   * 使用类似队列的数据结构，当数据量超过限制时，自动移除最早的记录
   */
  private keepRecentDaysOnly(): void {
    const historyDays = config.stats.historyDays || 90;
    const dates = Object.keys(this.data.site.daily);

    if (dates.length > historyDays) {
      // 按日期排序
      dates.sort();

      // 删除最早的记录，直到数量符合要求
      const recordsToRemove = dates.length - historyDays;
      for (let i = 0; i < recordsToRemove; i++) {
        delete this.data.site.daily[dates[i]];
      }
    }
  }

  resetDailyStats(): void {
    const today = new Date().toISOString().split("T")[0];
    this.data.site.daily[today] = { pv: 0, uv: new UvCounter() };
  }

  trackPageView(pagePath: string, clientId: string): void {
    const timestamp = Date.now();

    // 更新网站统计
    this.data.site.pv++;
    this.data.site.uv.add(clientId);
    // 更新每日统计
    const today = new Date().toISOString().split("T")[0];
    if (!this.data.site.daily[today]) {
      this.data.site.daily[today] = {
        pv: 0,
        uv: new UvCounter(),
      };
      // 保留最近N天的记录
      this.keepRecentDaysOnly();
    }
    this.data.site.daily[today].pv++;
    this.data.site.daily[today].uv.add(clientId);

    // 更新页面统计
    if (!this.data.pages[pagePath]) {
      this.data.pages[pagePath] = {
        pv: 0,
        uv: new UvCounter(),
        lastUpdated: timestamp,
      };
    }
    this.data.pages[pagePath].pv++;
    this.data.pages[pagePath].uv.add(clientId);
    this.data.pages[pagePath].lastUpdated = timestamp;
  }

  getPageStats(pagePath: string): {
    pv: number;
    uv: number;
    lastUpdated: number;
  } {
    const page = this.data.pages[pagePath];
    if (!page) {
      return { pv: 0, uv: 0, lastUpdated: 0 };
    }

    return {
      pv: page.pv,
      uv: page.uv.count(),
      lastUpdated: page.lastUpdated,
    };
  }

  getAllPages(
    sortBy: string
  ): Array<{ path: string; pv: number; uv: number; lastUpdated: string }> {
    // return this.data.pages;
    const pageStats = Object.keys(this.data.pages || {})
      .map((path) => ({
        path: path,
        pv: this.data.pages[path].pv,
        uv: this.data.pages[path].uv.count(),
        lastUpdated: formatDate(this.data.pages[path].lastUpdated),
      }))
      .sort((a, b) => {
        if (sortBy === "uv") {
          // 按UV优先降序排序
          if (a.uv !== b.uv) {
            return b.uv - a.uv;
          }
          // UV相同时，按PV降序排序
          return b.pv - a.pv;
        } else {
          // 默认为PV优先降序排序
          if (a.pv !== b.pv) {
            return b.pv - a.pv;
          }
          // PV相同时，按UV降序排序
          return b.uv - a.uv;
        }
      });

    return pageStats;
  }

  getDailyStats(date: string): { pv: number; uv: number } {
    const dateKey = date;
    const dailyData = this.data.site.daily[dateKey];
    if (!dailyData) {
      return { pv: 0, uv: 0 };
    }
    return { pv: dailyData.pv, uv: dailyData.uv.count() };
  }

  getAllDailyStats(
    sortBy: string
  ): Array<{ date: string; pv: number; uv: number }> {
    const pageStats = Object.keys(this.data.site.daily || {})
      .map((dateKey) => ({
        date: dateKey,
        pv: this.data.site.daily[dateKey].pv,
        uv: this.data.site.daily[dateKey].uv.count(),
      }))
      .sort((a, b) => {
        if (sortBy === "uv") {
          // 按UV优先降序排序
          if (a.uv !== b.uv) {
            return b.uv - a.uv;
          }
          // UV相同时，按PV降序排序
          return b.pv - a.pv;
        } else {
          // 默认为PV优先降序排序
          if (a.pv !== b.pv) {
            return b.pv - a.pv;
          }
          // PV相同时，按UV降序排序
          return b.uv - a.uv;
        }
      });
    return pageStats;
  }

  getSiteStats() {
    const today = new Date().toISOString().split("T")[0];
    const dailyData = this.data.site.daily[today] || {
      pv: 0,
      uv: new UvCounter(),
    };
    logger.debug(`today: ${today}, dailyData: ${dailyData}`);

    return {
      total: {
        pv: this.data.site.pv,
        uv: this.data.site.uv.count(),
      },
      today: {
        pv: dailyData.pv,
        uv: dailyData.uv.count(),
      },
      // 可以大致的表示网站的文档数(文章数量)，注意：这里不会包含新建但还未访问的页面。
      pages: Object.keys(this.data.pages).length,
    };
  }
}

class PageStatsManager {
  private domains: Record<string, DomainStats> = {};
  private saveInterval: NodeJS.Timeout | null = null;

  constructor() {
    // 初始化domains
    for (const domain of config.security.allowedDomains) {
      this.domains[domain] = new DomainStats(domain);
    }

    // 设置自动保存和重置的定时器
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
    if (
      config.security.allowedDomains.length > 0 &&
      !config.security.allowedDomains.includes(domain)
    ) {
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
      logger.info("All statistics data saved successfully");
    } catch (error) {
      logger.error(
        `Failed to save all statistics data: ${(error as Error).message}`
      );
    }
  }

  private resetAllDailyStats(): void {
    try {
      for (const domain of Object.values(this.domains)) {
        domain.resetDailyStats();
      }
      logger.info("Daily statistics reset successfully");
    } catch (error) {
      logger.error(
        `Failed to reset daily statistics: ${(error as Error).message}`
      );
    }
  }
}

// 创建单例实例
export default new PageStatsManager();
