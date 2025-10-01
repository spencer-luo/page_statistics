export default {
  port: process.env.PORT || 6880,
  // 数据存储配置
  storage: {
    directory: './storage',
    backupDirectory: './storage/backup'
  },
  // API接口配置
  api: {
    prefix: 'api-pagestats'
  },
  // 统计配置
  stats: {
    // UV 统计的时间窗口（分钟）
    uvWindow: 30,
    // 自动保存间隔（分钟）
    saveInterval: 0.3 // TODO 12s
  },
  // 安全配置
  security: {
    // 最大请求频率（每分钟）
    maxRequestsPerMinute: 60,
    // 信任的代理头
    trustProxy: true,
    // 域名白名单，只有在白名单中的域名才有效。注意：白名单为空时，允许所有域名
    allowedDomains: ['localhost', 'example.com', 'test.com']
  },
  // 日志配置
  logging: {
    // error等级的日志文件路径
    error: './logs/error.log',
    // info等级的日志文件路径
    info: './logs/info.log',
    // 是否打印到控制台
    console: true,
    // 日志文件最多存储的天数
    maxDays: 7
  }
};