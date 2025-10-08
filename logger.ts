import fs from "fs/promises";
import path from "path";
import config from "./config";

interface LoggingConfig {
  saveDir: string;
  console: boolean;
  maxDays: number;
}

class Logger {
  private logConfig: LoggingConfig;
  private currentDate: string;
  private logDir: string;
  private infoLogPath: string;
  private errorLogPath: string;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private dateCheckInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.logConfig = config.logging || {
      saveDir: "./logs",
      console: true,
      maxDays: 7,
    };
    this.currentDate = this.getCurrentDate();
    // 解析日志目录路径(获取绝对路径)
    this.logDir = path.resolve(__dirname, ".", this.logConfig.saveDir);
    // 设置当前日志文件路径
    this.infoLogPath = path.join(this.logDir, this.getLogFilename('info', this.currentDate, true));
    this.errorLogPath = path.join(this.logDir, this.getLogFilename('error', this.currentDate, true));
    this.initialize();
  }

  private getCurrentDate(): string {
    return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  }

  private getLogFilename(baseName: string, date: string, isLogging: boolean = false): string {
    const ext = isLogging ? '.logging' : '.log';
    return `${baseName}_${date}${ext}`;
  }

  private async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.logDir, { recursive: true });

      // 启动定时任务
      this.startScheduledTasks();

      // 清理过期日志
      this.cleanupOldLogs();
    } catch (error) {
      console.error("Failed to initialize logger:", (error as Error).message);
    }
  }

  // 每日日志滚动
  private async rolloverLogs(): Promise<void> {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    // 处理info日志
    const yesterdayInfoLogging = path.join(this.logDir, this.getLogFilename('info', yesterdayStr, true));
    const yesterdayInfoLog = path.join(this.logDir, this.getLogFilename('info', yesterdayStr, false));

    try {
      await fs.access(yesterdayInfoLogging);
      await fs.rename(yesterdayInfoLogging, yesterdayInfoLog);
    } catch (error) {
      // 文件不存在，忽略
      console.error(`Failed to rename ${yesterdayInfoLogging}, error:`, (error as Error).message);
    }

    // 处理error日志
    const yesterdayErrorLogging = path.join(this.logDir, this.getLogFilename('error', yesterdayStr, true));
    const yesterdayErrorLog = path.join(this.logDir, this.getLogFilename('error', yesterdayStr, false));

    try {
      await fs.access(yesterdayErrorLogging);
      await fs.rename(yesterdayErrorLogging, yesterdayErrorLog);
    } catch (error) {
      // 文件不存在，忽略
      console.error(`Failed to rename ${yesterdayErrorLogging}, error:`, (error as Error).message);
    }

    // 更新当前日志文件路径
    this.infoLogPath = path.join(this.logDir, this.getLogFilename('info', this.currentDate, true));
    this.errorLogPath = path.join(this.logDir, this.getLogFilename('error', this.currentDate, true));
  }

  private startScheduledTasks(): void {
    // 每天检查一次日期变化
    this.dateCheckInterval = setInterval(() => {
      const newDate = this.getCurrentDate();
      if (newDate !== this.currentDate) {
        this.currentDate = newDate;
        this.handleDateChange();
      }
    }, 10 * 60000); // 每10分钟检查一次
  }

  private async handleDateChange(): Promise<void> {
    try {
      // 滚动日志文件
      await this.rolloverLogs();

      // 清理过期日志
      this.cleanupOldLogs();
    } catch (error) {
      console.error("Failed to handle date change:", (error as Error).message);
    }
  }

  private async cleanupOldLogs(): Promise<void> {
    try {
      const maxDays = this.logConfig.maxDays;
      // 截止时间
      const cutoffTime = Date.now() - maxDays * 24 * 60 * 60 * 1000;

      // 清理info和error日志
      await this.cleanupLogsInDirectory(this.logDir, cutoffTime);
    } catch (error) {
      console.error("Failed to cleanup old logs:", (error as Error).message);
    }
  }

  private async cleanupLogsInDirectory(directory: string, cutoffTime: number): Promise<void> {
    try {
      const files = await fs.readdir(directory);
      
      for (const file of files) {
        if (!file.match(/_(info|error)_\d{4}-\d{2}-\d{2}\.(log)$/)) {
          continue;
        }

        const filePath = path.join(directory, file);
        
        try {
          const stats = await fs.stat(filePath);
          if (stats.mtimeMs < cutoffTime) {
            await fs.unlink(filePath);
          }
        } catch (error) {
          // 文件不存在或无法访问，忽略
          console.error(`Failed to unlink to filePath: ${filePath} error:`, (error as Error).message);
        }
      }
    } catch (error) {
      // 目录不存在或无法访问，忽略
    }
  }

  private async writeToFile(logPath: string, message: string): Promise<void> {
    try {
      await fs.appendFile(logPath, message + "\n");
    } catch (error) {
      console.error(`Failed to write to logPath: ${logPath} error:`, (error as Error).message);
    }
  }

  private formatMessage(level: string, message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  }

  async debug(message: string): Promise<void> {
    const formattedMessage = this.formatMessage("D", message);

    if (this.logConfig.console) {
      console.log(formattedMessage);
    }

    // await this.writeToFile(this.infoLogPath, formattedMessage);
  }

  async info(message: string): Promise<void> {
    const formattedMessage = this.formatMessage("I", message);

    if (this.logConfig.console) {
      console.log(formattedMessage);
    }

    await this.writeToFile(this.infoLogPath, formattedMessage);
  }

  async warn(message: string): Promise<void> {
    const formattedMessage = this.formatMessage("W", message);

    if (this.logConfig.console) {
      console.warn(formattedMessage);
    }

    await this.writeToFile(this.infoLogPath, formattedMessage);
  }

  async error(message: string): Promise<void> {
    const formattedMessage = this.formatMessage("E", message);

    if (this.logConfig.console) {
      console.error(formattedMessage);
    }

    // error等级的log会同时输出到error.logging和info.logging
    await this.writeToFile(this.infoLogPath, formattedMessage);
    await this.writeToFile(this.errorLogPath, formattedMessage);
  }

  // 清理资源
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    if (this.dateCheckInterval) {
      clearInterval(this.dateCheckInterval);
      this.dateCheckInterval = null;
    }
  }
}

export default new Logger();