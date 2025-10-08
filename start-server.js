// start-server.js - 动态设置模块别名的启动脚本
const path = require('path');
const fs = require('fs');

// 确定当前运行环境和文件路径
const appDirectory = path.resolve(process.cwd());
const localPath = path.join(appDirectory, 'dist/server.js');
const deployPath = path.join(appDirectory, 'server.js');

// 检查server.js文件的实际位置
let serverFilePath;
let aliasPathPrefix;

if (fs.existsSync(localPath)) {
  // 本地编译后模式
  serverFilePath = localPath;
  aliasPathPrefix = './dist/';
  console.log('Starting server in local mode (dist directory)');
} else if (fs.existsSync(deployPath)) {
  // 直接部署模式
  serverFilePath = deployPath;
  aliasPathPrefix = './';
  console.log('Starting server in direct deployment mode');
} else {
  // 尝试查找可能的server.js文件
  console.error('❌ Error: Could not find server.js file');
  console.error('Searched locations:');
  console.error(`- ${localPath}`);
  console.error(`- ${deployPath}`);
  console.error('\n⚠️  Please make sure you have built the project first:');
  console.error('   $ npm run build');
  
  // 默认使用dist路径作为备选
  serverFilePath = localPath;
  aliasPathPrefix = './dist/';
  console.log('\nAttempting to start from default location: dist/server.js');
}

console.log(`Module alias path prefix: ${aliasPathPrefix}`);

// 尝试加载module-alias，如果不存在则提供安装指导
try {
  // 动态设置模块别名
  const moduleAlias = require('module-alias');
  moduleAlias.addAliases({
    'config': `${aliasPathPrefix}config.js`,
    'logger': `${aliasPathPrefix}logger.js`,
    'models': `${aliasPathPrefix}models`,
    'routes': `${aliasPathPrefix}routes`,
    'counter': `${aliasPathPrefix}counter`
  });
  
  // 启动服务器
  console.log('\n🚀 Starting server...');
  require(serverFilePath);
} catch (error) {
  if (error.code === 'MODULE_NOT_FOUND') {
    if (error.message.includes('module-alias')) {
      console.error('\n❌ Error: Could not find module-alias');
      console.error('⚠️  Please install dependencies first:');
      console.error('   $ npm install');
    } else if (error.message.includes(serverFilePath)) {
      console.error(`\n❌ Error: Could not find server.js at ${serverFilePath}`);
      console.error('⚠️  Please make sure you have built the project:');
      console.error('   $ npm run build');
    } else {
      console.error(`\n❌ Error: Could not find module: ${error.message}`);
    }
  } else {
    console.error('\n❌ Unexpected error:', error.message);
  }
  process.exit(1);
}