import fs from "fs/promises";
import path from "path";
import config from "./config";

interface LoggingConfig {
  error: string;
  info: string;
  console: boolean;
  maxDays: number;
}

class Logger {
  private logConfig: LoggingConfig;

  constructor() {
    this.logConfig = config.logging || {
      error: "./logs/error.log",
      info: "./logs/info.log",
      console: true,
      maxDays: 7,
    };
    this.initialize();
  }

  private async initialize(): Promise<void> {
    // 创建日志目录
    this.logConfig.error = path.resolve(__dirname, ".", this.logConfig.error);
    this.logConfig.info = path.resolve(__dirname, ".", this.logConfig.info);
    const errorLogDir = path.dirname(this.logConfig.error);
    const infoLogDir = path.dirname(this.logConfig.info);

    try {
      await fs.mkdir(errorLogDir, { recursive: true });
      await fs.mkdir(infoLogDir, { recursive: true });

      // 清理过期日志
      this.cleanupOldLogs();
    } catch (error) {
      console.error("Failed to initialize logger:", (error as Error).message);
    }
  }

  private async cleanupOldLogs(): Promise<void> {
    try {
      const maxDays = this.logConfig.maxDays;
      const cutoffTime = Date.now() - maxDays * 24 * 60 * 60 * 1000;

      // 清理错误日志
      const errorLogPath = this.logConfig.error;
      await this.checkAndDeleteOldLog(errorLogPath, cutoffTime);

      // 清理信息日志
      const infoLogPath = this.logConfig.info;
      await this.checkAndDeleteOldLog(infoLogPath, cutoffTime);
    } catch (error) {
      console.error("Failed to cleanup old logs:", (error as Error).message);
    }
  }

  private async checkAndDeleteOldLog(
    logPath: string,
    cutoffTime: number
  ): Promise<void> {
    try {
      const stats = await fs.stat(logPath);
      if (stats.birthtimeMs < cutoffTime) {
        await fs.unlink(logPath);
      }
    } catch (error) {
      // 文件不存在或无法访问，忽略
    }
  }

  private async writeToFile(logPath: string, message: string): Promise<void> {
    try {
      await fs.appendFile(logPath, message + "\n");
    } catch (error) {
      console.error("Failed to write to log file:", (error as Error).message);
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

    // await this.writeToFile(this.logConfig.info, formattedMessage);
  }

  async info(message: string): Promise<void> {
    const formattedMessage = this.formatMessage("I", message);

    if (this.logConfig.console) {
      console.log(formattedMessage);
    }

    await this.writeToFile(this.logConfig.info, formattedMessage);
  }

  async warn(message: string): Promise<void> {
    const formattedMessage = this.formatMessage("W", message);

    if (this.logConfig.console) {
      console.warn(formattedMessage);
    }

    await this.writeToFile(this.logConfig.info, formattedMessage);
  }

  async error(message: string): Promise<void> {
    const formattedMessage = this.formatMessage("E", message);

    if (this.logConfig.console) {
      console.error(formattedMessage);
    }

    // error等级的log会同时输出到error.log和info.log
    await this.writeToFile(this.logConfig.info, formattedMessage);
    await this.writeToFile(this.logConfig.error, formattedMessage);
  }
}

export default new Logger();
