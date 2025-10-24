import express from "express";
import { rateLimit } from "express-rate-limit";
import stats from "../models/stats";
import logger from "../logger";
import config from "../config";
import clientFinger from "./clientFinger";

// 日期格式化函数
function formatDate(timestamp: number): string {
  return new Date(timestamp).toISOString().split("T")[0];
}

const router = express.Router();

// 类型定义
interface PageStats {
  path: string;
  pv: number;
  uv: number;
  lastUpdated: number;
}

interface DailyStats {
  pv: number;
  uv: number;
}

// 频率限制
const trackLimiter = rateLimit({
  windowMs: 60 * 1000, // 1分钟
  max: config.security.maxTrackRequests,
  message: { error: "Too many requests, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

const queryLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: config.security.maxQueryRequests, // 每分钟最多120次请求
  message: { error: "Too many requests, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

const queryAllLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: config.security.maxQueryAllRequests, // 每分钟最多10次请求
  message: { error: "Too many requests, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

// 从请求中获取域名
const getDomainFromRequest = (req: express.Request): string => {
  // 优先从请求头中获取域名
  if (req.headers["x-domain"]) {
    return req.headers["x-domain"] as string;
  }

  // 从Host头中获取
  if (req.headers.host) {
    // 去除端口号
    return (req.headers.host as string).split(":")[0];
  }

  // 默认域名
  return "localhost";
};

// 验证域名是否在白名单中
const validateDomain = (domain: string): boolean => {
  if (config.security.allowedDomains.length === 0) {
    return true; // 白名单为空时，允许所有域名
  }
  return config.security.allowedDomains.includes(domain);
};

// 页面访问触发接口
router.post(
  "/page-track",
  trackLimiter,
  async (req: express.Request, res: express.Response) => {
    try {
      const domain = getDomainFromRequest(req);

      // 验证域名
      if (!validateDomain(domain)) {
        logger.warn(`Domain validation failed for: ${domain}`);
        return res.status(403).json({ error: "Domain not allowed" });
      }

      const { path } = req.body;
      if (!path || typeof path !== "string") {
        return res
          .status(400)
          .json({ error: "Param path is required and must be a string" });
      }

      const clientId = clientFinger.generate(req);
      const clientIp = clientFinger.getClientIP(req);

      // 记录页面访问
      const domainStats = stats.getDomainStats(domain);
      domainStats.trackPageView(path, clientId);

      logger.info(
        `[${domain}] Page view tracked: ${path} by client ${clientId}_${clientIp}`
      );

      res.json({
        success: true,
        message: "Page view tracked successfully",
      });
    } catch (error) {
      logger.error(`Error tracking page view: ${(error as Error).message}`);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// 页面访问查询接口
router.get(
  "/page-stats",
  queryLimiter,
  async (req: express.Request, res: express.Response) => {
    try {
      const domain = getDomainFromRequest(req);

      // 验证域名
      if (!validateDomain(domain)) {
        logger.warn(`Domain validation failed for: ${domain}`);
        return res.status(403).json({ error: "Domain not allowed" });
      }

      const { path } = req.query;
      if (!path || typeof path !== "string") {
        return res
          .status(400)
          .json({ error: "Param path is required and must be a string" });
      }

      const domainStats = stats.getDomainStats(domain);
      const pageStats = domainStats.getPageStats(path as string);

      res.json({
        domain,
        path: path,
        lastUpdated: formatDate(pageStats.lastUpdated),
        stats: {
          pv: pageStats.pv,
          uv: pageStats.uv,
        },
      });
    } catch (error) {
      logger.error(`Error getting page stats: ${(error as Error).message}`);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// 获取所有页面统计
router.get(
  "/all-pages",
  queryAllLimiter,
  async (req: express.Request, res: express.Response) => {
    try {
      const domain = getDomainFromRequest(req);

      // 验证域名
      if (!validateDomain(domain)) {
        logger.warn(`Domain validation failed for: ${domain}`);
        return res.status(403).json({ error: "Domain not allowed" });
      }

      // 获取对应域名的统计管理器
      const domainStats = stats.getDomainStats(domain);
      // 获取排序方式参数，默认为pv优先
      const sortBy = (req.query.sortBy as string) || "pv";
      const pageStats = domainStats.getAllPages(sortBy);

      res.json({
        domain,
        count: pageStats.length,
        sortBy: sortBy,
        pages: pageStats,
      });
    } catch (error) {
      logger.error(`Error getting all pages: ${(error as Error).message}`);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// 获取每日统计，参数date为空时表示获取当天的统计数据
router.get(
  "/daily-stats",
  queryLimiter,
  async (req: express.Request, res: express.Response) => {
    try {
      const domain = getDomainFromRequest(req);

      // 验证域名
      if (!validateDomain(domain)) {
        logger.warn(`Domain validation failed for: ${domain}`);
        return res.status(403).json({ error: "Domain not allowed" });
      }

      const { date } = req.query;
      const dateKey =
        (date as string) || new Date().toISOString().split("T")[0];

      const domainStats = stats.getDomainStats(domain);
      const dailyStats = domainStats.getDailyStats(dateKey);

      res.json({
        domain: domain,
        date: date || new Date().toISOString().split("T")[0],
        stats: dailyStats,
      });
    } catch (error) {
      logger.error(`Error getting daily stats: ${(error as Error).message}`);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// 获取所有按天统计的数据
router.get(
  "/all-dailies",
  queryAllLimiter,
  async (req: express.Request, res: express.Response) => {
    try {
      const domain = getDomainFromRequest(req);

      // 验证域名
      if (!validateDomain(domain)) {
        logger.warn(`Domain validation failed for: ${domain}`);
        return res.status(403).json({ error: "Domain not allowed" });
      }

      const sortBy = (req.query.sortBy as string) || "pv";

      const domainStats = stats.getDomainStats(domain);
      const dailyStats = domainStats.getAllDailyStats(sortBy);

      res.json({
        domain: domain,
        count: dailyStats.length,
        dailies: dailyStats,
      });
    } catch (error) {
      logger.error(`Error getting daily stats: ${(error as Error).message}`);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// 网站访问量查询接口
router.get(
  "/site-stats",
  queryLimiter,
  async (req: express.Request, res: express.Response) => {
    try {
      const domain = getDomainFromRequest(req);

      // 验证域名
      if (!validateDomain(domain)) {
        logger.warn(`Domain validation failed for: ${domain}`);
        return res.status(403).json({ error: "Domain not allowed" });
      }

      // 获取对应域名的统计管理器
      const domainStats = stats.getDomainStats(domain);
      const siteStats = domainStats.getSiteStats();

      res.json({
        domain,
        total: siteStats.total,
        today: siteStats.today,
        totalPages: siteStats.pages,
      });
    } catch (error) {
      logger.error(`Error getting top pages: ${(error as Error).message}`);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

export default router;
