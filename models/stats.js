const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const logger = require('../logger');

class DomainStats {
  constructor(domain) {
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

  getStorageFilePath() {
    return path.resolve(__dirname, '..', config.storage.directory, `${this.domain}.json`);
  }

  getBackupFilePath() {
    return path.resolve(__dirname, '..', config.storage.backupDirectory, `${this.domain}-${Date.now()}.json`);
  }

  async init() {
    try {
      await this.ensureDirectories();
      await this.loadData();
      logger.info(`Statistics data loaded for domain: ${this.domain}`);
    } catch (error) {
      logger.info(`No existing data found for domain: ${this.domain}, starting fresh`);
    }
  }

  async ensureDirectories() {
    try {
      await fs.mkdir(config.storage.directory, { recursive: true });
      await fs.mkdir(config.storage.backupDirectory, { recursive: true });
    } catch (error) {
      logger.error(`Failed to create storage directories: ${error.message}`);
      throw error;
    }
  }

  async loadData() {
    try {
      const fileData = await fs.readFile(this.storageFile, 'utf8');
      const parsed = JSON.parse(fileData);
      
      // 转换 Set 数据
      this.data.site.uv = new Set(parsed.site.uv || []);
      this.data.site.pv = parsed.site.pv || 0;
      this.data.site.daily = parsed.site.daily || {};
      this.data.pages = parsed.pages || {};
      this.data.sessions = parsed.sessions || {};
      
      // 转换daily中的Set数据
      Object.keys(this.data.site.daily).forEach(date => {
        if (this.data.site.daily[date].uv && Array.isArray(this.data.site.daily[date].uv)) {
          this.data.site.daily[date].uv = new Set(this.data.site.daily[date].uv);
        }
      });
    } catch (error) {
      logger.info(`Creating new data file for domain: ${this.domain}`);
      await this.saveData();
    }
  }

  async saveData() {
    try {
      const backup = JSON.parse(JSON.stringify(this.data));
      // 转换 Set 为 Array 以便存储
      backup.site.uv = Array.from(this.data.site.uv);
      
      // 转换daily中的Set数据
      Object.keys(backup.site.daily).forEach(date => {
        if (backup.site.daily[date].uv instanceof Set) {
          backup.site.daily[date].uv = Array.from(backup.site.daily[date].uv);
        }
      });
      
      await fs.writeFile(this.storageFile, JSON.stringify(backup, null, 2));
      logger.info(`Data saved successfully for domain: ${this.domain}`);
    } catch (error) {
      logger.error(`Failed to save data for domain ${this.domain}: ${error.message}`);
    }
  }

  trackPageView(pagePath, clientId, userAgent) {
    const timestamp = Date.now();
    const today = new Date().toDateString();
    
    // 初始化页面数据
    if (!this.data.pages[pagePath]) {
      this.data.pages[pagePath] = {
        pv: 0,
        uv: new Set(),
        lastUpdated: timestamp
      };
    }

    // 初始化今日数据
    if (!this.data.site.daily[today]) {
      this.data.site.daily[today] = {
        pv: 0,
        uv: new Set()
      };
    }

    // 更新 PV
    this.data.site.pv++;
    this.data.pages[pagePath].pv++;
    this.data.site.daily[today].pv++;

    // 更新 UV
    this.data.site.uv.add(clientId);
    this.data.pages[pagePath].uv.add(clientId);
    this.data.site.daily[today].uv.add(clientId);

    // 更新最后更新时间
    this.data.pages[pagePath].lastUpdated = timestamp;

    // 记录会话
    const sessionKey = `${clientId}_${pagePath}`;
    this.data.sessions[sessionKey] = timestamp;

    return {
      pagePV: this.data.pages[pagePath].pv,
      pageUV: this.data.pages[pagePath].uv.size,
      sitePV: this.data.site.pv,
      siteUV: this.data.site.uv.size
    };
  }

  getPageStats(pagePath) {
    const page = this.data.pages[pagePath];
    if (!page) {
      return { pv: 0, uv: 0 };
    }

    return {
      pv: page.pv,
      uv: page.uv.size,
      lastUpdated: page.lastUpdated
    };
  }

  getSiteStats() {
    const today = new Date().toDateString();
    const daily = this.data.site.daily[today] || { pv: 0, uv: new Set() };

    return {
      total: {
        pv: this.data.site.pv,
        uv: this.data.site.uv.size
      },
      today: {
        pv: daily.pv,
        uv: daily.uv.size
      },
      // 可以大致的表示网站的文档数(文章数量)，注意：这里不会包含新建但还未访问的页面。
      pages: Object.keys(this.data.pages).length
    };
  }

  // 清理过期会话（30分钟）
  cleanupSessions() {
    const now = Date.now();
    const expiryTime = 30 * 60 * 1000; // 30分钟
    
    Object.keys(this.data.sessions).forEach(key => {
      if (now - this.data.sessions[key] > expiryTime) {
        delete this.data.sessions[key];
      }
    });
  }
}

class PageStatsManager {
  constructor() {
    this.domains = new Map();
    this.init();
  }

  async init() {
    // 设置定时保存
    setInterval(() => this.saveAllData(), config.stats.saveInterval * 60 * 1000);
    
    // 每日 UV 重置
    this.scheduleDailyReset();
  }

  getDomainStats(domain) {
    if (!this.domains.has(domain)) {
      this.domains.set(domain, new DomainStats(domain));
    }
    return this.domains.get(domain);
  }

  async saveAllData() {
    const savePromises = Array.from(this.domains.values()).map(domainStats => 
      domainStats.saveData()
    );
    
    try {
      await Promise.all(savePromises);
      logger.info('All domains data saved');
    } catch (error) {
      logger.error(`Failed to save all domains data: ${error.message}`);
    }
  }

  scheduleDailyReset() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const timeUntilReset = tomorrow - now;
    
    setTimeout(() => {
      this.resetDailyUVForAllDomains();
      // 设置下一次重置
      this.scheduleDailyReset();
    }, timeUntilReset);
  }

  resetDailyUVForAllDomains() {
    const today = new Date().toDateString();
    
    this.domains.forEach(domainStats => {
      domainStats.data.site.daily[today] = {
        pv: 0,
        uv: new Set()
      };
    });
    
    logger.info(`Daily stats reset for all domains on ${today}`);
  }

  // 检查域名是否在白名单中
  isDomainAllowed(domain) {
    return config.security.allowedDomains.includes(domain);
  }

  // 清理所有域名的过期会话
  cleanupAllSessions() {
    this.domains.forEach(domainStats => {
      domainStats.cleanupSessions();
    });
  }
}

module.exports = new PageStatsManager();