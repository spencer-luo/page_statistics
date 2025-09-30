const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');

class PageStats {
  constructor() {
    this.data = {
      site: {
        pv: 0,
        uv: new Set(),
        daily: {}
      },
      pages: {},
      sessions: {}
    };
    this.storageFile = path.resolve(__dirname, '..', config.storage.file);
    this.init();
  }

  async init() {
    try {
      await this.loadData();
      console.log('Statistics data loaded');
      
      // 设置定时保存
      setInterval(() => this.saveData(), config.stats.saveInterval * 60 * 1000);
      
      // 每日 UV 重置
      this.scheduleDailyReset();
    } catch (error) {
      console.log('No existing data found, starting fresh');
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
    } catch (error) {
      console.log('Creating new data file');
      await this.saveData();
    }
  }

  async saveData() {
    try {
      const backup = JSON.parse(JSON.stringify(this.data));
      // 转换 Set 为 Array 以便存储
      backup.site.uv = Array.from(this.data.site.uv);
      
      await fs.writeFile(this.storageFile, JSON.stringify(backup, null, 2));
      console.log('Data saved successfully');
    } catch (error) {
      console.error('Failed to save data:', error);
    }
  }

  scheduleDailyReset() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const timeUntilReset = tomorrow - now;
    
    setTimeout(() => {
      this.resetDailyUV();
      // 设置下一次重置
      this.scheduleDailyReset();
    }, timeUntilReset);
  }

  resetDailyUV() {
    const today = new Date().toDateString();
    this.data.site.daily[today] = {
      pv: 0,
      uv: new Set()
    };
    console.log(`Daily stats reset for ${today}`);
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

module.exports = new PageStats();