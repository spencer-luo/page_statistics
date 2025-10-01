const fs = require('fs').promises;
const path = require('path');
const config = require('./config');

class Logger {
  constructor() {
    this.logConfig = config.logging || {
      error: './logs/error.log',
      info: './logs/info.log',
      console: true,
      maxDays: 7
    };
    this.initialize();
  }

  async initialize() {
    // 创建日志目录
    const errorLogDir = path.dirname(this.logConfig.error);
    const infoLogDir = path.dirname(this.logConfig.info);
    
    try {
      await fs.mkdir(errorLogDir, { recursive: true });
      await fs.mkdir(infoLogDir, { recursive: true });
      
      // 清理过期日志
      this.cleanupOldLogs();
    } catch (error) {
      console.error('Failed to initialize logger:', error);
    }
  }

  async cleanupOldLogs() {
    try {
      const maxDays = this.logConfig.maxDays;
      const cutoffTime = Date.now() - (maxDays * 24 * 60 * 60 * 1000);
      
      // 清理错误日志
      const errorLogPath = this.logConfig.error;
      await this.checkAndDeleteOldLog(errorLogPath, cutoffTime);
      
      // 清理信息日志
      const infoLogPath = this.logConfig.info;
      await this.checkAndDeleteOldLog(infoLogPath, cutoffTime);
    } catch (error) {
      console.error('Failed to cleanup old logs:', error);
    }
  }

  async checkAndDeleteOldLog(logPath, cutoffTime) {
    try {
      const stats = await fs.stat(logPath);
      if (stats.birthtimeMs < cutoffTime) {
        await fs.unlink(logPath);
      }
    } catch (error) {
      // 文件不存在或无法访问，忽略
    }
  }

  async writeToFile(logPath, message) {
    try {
      await fs.appendFile(logPath, message + '\n');
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  formatMessage(level, message) {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  }

  async info(message) {
    const formattedMessage = this.formatMessage('info', message);
    
    if (this.logConfig.console) {
      console.log(formattedMessage);
    }
    
    await this.writeToFile(this.logConfig.info, formattedMessage);
  }

  async error(message) {
    const formattedMessage = this.formatMessage('error', message);
    
    if (this.logConfig.console) {
      console.error(formattedMessage);
    }
    
    await this.writeToFile(this.logConfig.error, formattedMessage);
  }

  async warn(message) {
    const formattedMessage = this.formatMessage('warn', message);
    
    if (this.logConfig.console) {
      console.warn(formattedMessage);
    }
    
    await this.writeToFile(this.logConfig.info, formattedMessage);
  }
}

module.exports = new Logger();