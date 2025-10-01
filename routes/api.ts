import express from 'express';
import { rateLimit } from 'express-rate-limit';
import { v4 as uuidv4 } from 'uuid';
import stats from 'models/stats';
import logger from 'logger';
import config from 'config';

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

interface TopPage {
  path: string;
  pv: number;
  uv: number;
}

// 频率限制
const trackLimiter = rateLimit({
  windowMs: 60 * 1000, // 1分钟
  max: 60, // 每分钟最多60次请求
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const queryLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// 获取客户端ID
const getClientId = (req: express.Request): string => {
  // 尝试从Cookie获取
  if (req.cookies && req.cookies.client_id) {
    return req.cookies.client_id;
  }
  
  // 尝试从Header获取
  if (req.headers['x-client-id']) {
    return req.headers['x-client-id'] as string;
  }
  
  // 生成新的客户端ID
  return uuidv4();
};

// 从请求中获取域名
const getDomainFromRequest = (req: express.Request): string => {
  // 优先从请求头中获取域名
  if (req.headers['x-domain']) {
    return req.headers['x-domain'] as string;
  }
  
  // 从Host头中获取
  if (req.headers.host) {
    // 去除端口号
    return (req.headers.host as string).split(':')[0];
  }
  
  // 默认域名
  return 'localhost';
};

// 验证域名是否在白名单中
const validateDomain = (domain: string): boolean => {
  if (config.security.allowedDomains.length === 0) {
    return true; // 白名单为空时，允许所有域名
  }
  return config.security.allowedDomains.includes(domain);
};

// 跟踪页面访问
router.post('/track', trackLimiter, async (req: express.Request, res: express.Response) => {
  try {
    const domain = getDomainFromRequest(req);
    
    // 验证域名
    if (!validateDomain(domain)) {
      logger.warn(`Domain validation failed for: ${domain}`);
      return res.status(403).json({ error: 'Domain not allowed' });
    }
    
    const { path } = req.body;
    if (!path || typeof path !== 'string') {
      return res.status(400).json({ error: 'Path is required and must be a string' });
    }
    
    const clientId = getClientId(req);
    
    // 记录页面访问
    const domainStats = stats.getDomainStats(domain);
    domainStats.trackPageView(path, clientId);
    
    logger.info(`Page view tracked: ${domain}${path} by client ${clientId}`);
    
    res.json({
      success: true,
      message: 'Page view tracked successfully'
    });
  } catch (error) {
    logger.error(`Error tracking page view: ${error.message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 获取页面统计
router.get('/page-stats', queryLimiter, async (req: express.Request, res: express.Response) => {
  try {
    const domain = getDomainFromRequest(req);
    
    // 验证域名
    if (!validateDomain(domain)) {
      logger.warn(`Domain validation failed for: ${domain}`);
      return res.status(403).json({ error: 'Domain not allowed' });
    }
    
    const { path } = req.query;
    
    const domainStats = stats.getDomainStats(domain);
    const pageStats = domainStats.getPageStats(path as string | undefined);
    
    res.json({
      domain: domain,
      path: path || 'all',
      stats: pageStats
    });
  } catch (error) {
    logger.error(`Error getting page stats: ${error.message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 获取每日统计
router.get('/daily-stats', queryLimiter, async (req: express.Request, res: express.Response) => {
  try {
    const domain = getDomainFromRequest(req);
    
    // 验证域名
    if (!validateDomain(domain)) {
      logger.warn(`Domain validation failed for: ${domain}`);
      return res.status(403).json({ error: 'Domain not allowed' });
    }
    
    const { date } = req.query;
    
    const domainStats = stats.getDomainStats(domain);
    const dailyStats = domainStats.getDailyStats(date as string | undefined);
    
    res.json({
      domain: domain,
      date: date || new Date().toISOString().split('T')[0],
      stats: dailyStats
    });
  } catch (error) {
    logger.error(`Error getting daily stats: ${error.message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 获取热门页面
router.get('/top-pages', queryLimiter, async (req: express.Request, res: express.Response) => {
  try {
    const domain = getDomainFromRequest(req);
    
    // 验证域名
    if (!validateDomain(domain)) {
      logger.warn(`Domain validation failed for: ${domain}`);
      return res.status(403).json({ error: 'Domain not allowed' });
    }
    
    const limit = parseInt(req.query.limit as string) || 10;
    
    const domainStats = stats.getDomainStats(domain);
    const topPages = domainStats.getTopPages(limit);
    
    res.json({
      domain: domain,
      pages: topPages,
      count: topPages.length
    });
  } catch (error) {
    logger.error(`Error getting top pages: ${error.message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 获取所有页面统计
router.get('/all-pages', queryLimiter, async (req: express.Request, res: express.Response) => {
  try {
    const domain = getDomainFromRequest(req);
    
    // 验证域名
    if (!validateDomain(domain)) {
      logger.warn(`Domain validation failed for: ${domain}`);
      return res.status(403).json({ error: 'Domain not allowed' });
    }
    
    // 获取对应域名的统计管理器
    const domainStats = stats.getDomainStats(domain);
    
    // 获取排序方式参数，默认为pv优先
    const sortBy = req.query.sortBy as string || 'pv';
    
    const pageStats = Object.keys(domainStats.allPages || {})
      .map(path => ({
        path: path,
        pv: domainStats.allPages[path].pv,
        uv: domainStats.allPages[path].uv.size,
        lastUpdated: domainStats.allPages[path].lastUpdated
      }))
      .sort((a, b) => {
        if (sortBy === 'uv') {
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
    
    res.json({
      pages: pageStats,
      count: pageStats.length,
      sortBy: sortBy
    });
  } catch (error) {
    logger.error(`Error getting all pages: ${error.message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 获取所有域名列表
router.get('/domains', queryLimiter, async (req: express.Request, res: express.Response) => {
  try {
    const domains = stats.getAllDomains();
    res.json({
      domains: domains,
      count: domains.length
    });
  } catch (error) {
    logger.error(`Error getting domains: ${error.message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;