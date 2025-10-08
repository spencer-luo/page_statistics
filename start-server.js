// start-server.js - 动态设置模块别名的启动脚本

// 确定当前运行环境
const isLocalDevelopment = process.argv.includes('--local') || 
                          require('path').dirname(require.main?.filename || '') !== process.cwd();

// 根据环境设置正确的模块别名路径前缀
const aliasPathPrefix = isLocalDevelopment ? './dist/' : './';

// 动态设置模块别名
const moduleAlias = require('module-alias');
moduleAlias.addAliases({
  'config': `${aliasPathPrefix}config.js`,
  'logger': `${aliasPathPrefix}logger.js`,
  'models': `${aliasPathPrefix}models`,
  'routes': `${aliasPathPrefix}routes`,
  'counter': `${aliasPathPrefix}counter`
});

console.log(`Starting server in ${isLocalDevelopment ? 'local' : 'deployment'} mode`);
console.log(`Module alias path prefix: ${aliasPathPrefix}`);

// 启动服务器
require(aliasPathPrefix + 'server.js');