const express = require('express');
const { rateLimit } = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');
const stats = require('../models/stats');
const logger = require('../logger');

const router = express.Router();

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
const getClientId = (req) => {
  // 尝试从Cookie获取
  if (req.cookies && req.cookies.client_id) {
    return req.cookies.client_id;
  }
  
  // 尝试从Header获取
  if (req.headers['x-client-id']) {
    return req.headers['x-client-id'];
  }
  
  // 生成新的客户端ID
  return uuidv4();
};

// 从请求中获取域名
const getDomainFromRequest = (req) => {
  // 优先从请求头中获取域名
  if (req.headers['x-domain']) {
    return req.headers['x-domain'];
  }
  
  // 从Host头中获取
  if (req.headers.host) {
    // 去除端口号
    const host = req.headers.host;
    const domainMatch = host.match(/^([^:]+)(?::\d+)?$/);
    return domainMatch ? domainMatch[1] : host;
  }
  
  // 默认返回localhost
  return 'localhost';
};

// 页面访问触发接口
router.post('/track-pageview', trackLimiter, (req, res) => {
  try {
    const { path } = req.body;
    
    if (!path) {
      return res.status(400).json({ error: 'Path parameter is required' });
    }

    // 验证路径格式
    if (typeof path !== 'string' || path.length > 500) {
      return res.status(400).json({ error: 'Invalid path format' });
    }

    // 获取域名
    const domain = getDomainFromRequest(req);
    
    // 检查域名是否在白名单中
    if (!stats.isDomainAllowed(domain)) {
      logger.warn(`Domain not allowed: ${domain}`);
      return res.status(403).json({ error: 'Domain not allowed' });
    }

    const clientId = getClientId(req);
    const userAgent = req.get('User-Agent') || 'unknown';
    
    // 获取对应域名的统计管理器
    const domainStats = stats.getDomainStats(domain);
    const result = domainStats.trackPageView(path, clientId, userAgent);
    
    res.json({
      success: true,
      clientId: clientId,
      stats: result
    });
  } catch (error) {
    logger.error(`Track pageview error: ${error.message}`);
    res.status(500).json({ error: 'Failed to track page view' });
  }
});

// 页面访问查询接口
router.get('/page-view', queryLimiter, (req, res) => {
  try {
    const { path, domain: reqDomain } = req.query;
    
    if (!path) {
      return res.status(400).json({ error: 'path parameter is required' });
    }

    // 获取域名
    const domain = reqDomain || getDomainFromRequest(req);
    
    // 检查域名是否在白名单中
    if (!stats.isDomainAllowed(domain)) {
      logger.warn(`Domain not allowed: ${domain}`);
      return res.status(403).json({ error: 'Domain not allowed' });
    }

    // 获取对应域名的统计管理器
    const domainStats = stats.getDomainStats(domain);
    const pageStats = domainStats.getPageStats(path);
    
    res.json({
      path: path,
      pv: pageStats.pv,
      uv: pageStats.uv,
      lastUpdated: pageStats.lastUpdated
    });
  } catch (error) {
    logger.error(`Get page stats error: ${error.message}`);
    res.status(500).json({ error: 'Failed to get page statistics' });
  }
});

// 网站访问量查询接口
router.get('/site-view', queryLimiter, (req, res) => {
  try {
    const { domain: reqDomain } = req.query;
    
    // 获取域名
    const domain = reqDomain || getDomainFromRequest(req);
    
    // 检查域名是否在白名单中
    if (!stats.isDomainAllowed(domain)) {
      logger.warn(`Domain not allowed: ${domain}`);
      return res.status(403).json({ error: 'Domain not allowed' });
    }

    // 获取对应域名的统计管理器
    const domainStats = stats.getDomainStats(domain);
    const siteStats = domainStats.getSiteStats();
    
    res.json({
      total: siteStats.total,
      today: siteStats.today,
      totalPages: siteStats.pages
    });
  } catch (error) {
    logger.error(`Get site stats error: ${error.message}`);
    res.status(500).json({ error: 'Failed to get site statistics' });
  }
});

// 获取所有页面统计
router.get('/all-pages', queryLimiter, (req, res) => {
  try {
    const { domain: reqDomain } = req.query;
    
    // 获取域名
    const domain = reqDomain || getDomainFromRequest(req);
    
    // 检查域名是否在白名单中
    if (!stats.isDomainAllowed(domain)) {
      logger.warn(`Domain not allowed: ${domain}`);
      return res.status(403).json({ error: 'Domain not allowed' });
    }

    // 获取对应域名的统计管理器
    const domainStats = stats.getDomainStats(domain);
    
    // 获取排序方式参数，默认为pv优先
    const sortBy = req.query.sortBy || 'pv';
    
    const pageStats = Object.keys(domainStats.data.pages || {})
      .map(path => ({
        path: path,
        pv: domainStats.data.pages[path].pv,
        uv: domainStats.data.pages[path].uv.size,
        lastUpdated: domainStats.data.pages[path].lastUpdated
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
    logger.error(`Get all pages error: ${error.message}`);
    res.status(500).json({ error: 'Failed to get all pages statistics' });
  }
});

module.exports = router;