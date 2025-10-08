## 部署步骤

### 步骤1：准备部署文件（在开发环境执行）

```bash
npm run deploy:prepare
```

这个命令会：

1. 编译TypeScript代码 (`npm run build`)
2. 将 `package.json` 和 `package-lock.json` 复制到 `./dist` 目录

### 步骤2：部署到服务器

将 `./dist` 目录完整复制到服务器上的目标位置。

### 步骤3：安装依赖（在服务器上执行）

```bash
npm run deploy:server
```

或者手动执行：

```bash
cd ./dist
npm install --production
```

这个命令会安装 `package.json` 中定义的所有生产依赖，包括 `module-alias`。

### 步骤4：启动应用

```bash
node server.js
```
