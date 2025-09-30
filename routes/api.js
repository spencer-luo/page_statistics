const express = require('express');
const { rateLimit } = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');
const stats = require('../models/stats');

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

    const clientId = getClientId(req);
    const userAgent = req.get('User-Agent') || 'unknown';
    
    const result = stats.trackPageView(path, clientId, userAgent);
    
    res.json({
      success: true,
      clientId: clientId,
      stats: result
    });
  } catch (error) {
    console.error('Track pageview error:', error);
    res.status(500).json({ error: 'Failed to track page view' });
  }
});

// 页面访问查询接口
router.get('/page-view', queryLimiter, (req, res) => {
  try {
    const { path } = req.query;
    
    if (!path) {
      return res.status(400).json({ error: 'path parameter is required' });
    }

    const pageStats = stats.getPageStats(path);
    
    res.json({
      path: path,
      pv: pageStats.pv,
      uv: pageStats.uv,
      lastUpdated: pageStats.lastUpdated
    });
  } catch (error) {
    console.error('Get page stats error:', error);
    res.status(500).json({ error: 'Failed to get page statistics' });
  }
});

// 网站访问量查询接口
router.get('/site-view', queryLimiter, (req, res) => {
  try {
    const siteStats = stats.getSiteStats();
    
    res.json({
      total: siteStats.total,
      today: siteStats.today,
      totalPages: siteStats.pages
    });
  } catch (error) {
    console.error('Get site stats error:', error);
    res.status(500).json({ error: 'Failed to get site statistics' });
  }
});

// 获取所有页面统计
router.get('/all-pages', queryLimiter, (req, res) => {
  try {
    const pageStats = Object.keys(stats.data.pages || {}).map(path => ({
      path: path,
      pv: stats.data.pages[path].pv,
      uv: stats.data.pages[path].uv.size,
      lastUpdated: stats.data.pages[path].lastUpdated
    }));
    
    res.json({
      pages: pageStats,
      count: pageStats.length
    });
  } catch (error) {
    console.error('Get all pages error:', error);
    res.status(500).json({ error: 'Failed to get all pages statistics' });
  }
});

module.exports = router;