export default {
  port: process.env.PORT || 6880,
  // 数据存储配置
  storage: {
    directory: './storage',
    backupDirectory: './storage/backup'
  },
  // API接口配置
  api: {
    prefix: 'api'
  },
  // 统计配置
  stats: {
    // 自动保存间隔（分钟）
    saveInterval: 30,
    // 保留的历史天数
    historyDays: 90
  },
  // 安全配置
  security: {
    // 最大请求频率（每分钟的次数）
    maxTrackRequests: 120, // 页面访问触发接口
    maxQueryRequests: 60,  // 单个数据的查询请求接口
    maxQueryAllRequests: 10,  // 批量数据的查询请求接口(all-pages/all-dailies)
    // 信任的代理头
    trustProxy: true,
    // 域名白名单，只有在白名单中的域名才有效。注意：白名单为空时，允许所有域名
    allowedDomains: ['example.com', 'test.com']
  },
  // 日志配置
  logging: {
    // error等级的日志文件路径
    saveDir: './logs',
    // 是否打印到控制台
    console: false,
    // 日志文件最多存储的天数
    maxDays: 30
  }
};