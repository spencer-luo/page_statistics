module.exports = {
  port: process.env.PORT || 6870,
  // 数据存储配置
  storage: {
    file: './storage/data.json',
    backup: './storage/backup.json'
  },
  // 统计配置
  stats: {
    // UV 统计的时间窗口（分钟）
    uvWindow: 30,
    // 自动保存间隔（分钟）
    saveInterval: 0.2 // TODO 12s
  },
  // 安全配置
  security: {
    // 最大请求频率（每分钟）
    maxRequestsPerMinute: 60,
    // 信任的代理头
    trustProxy: true
  }
};