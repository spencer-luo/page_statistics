---
title: README
date: 2025-10-24 18:53:29
---

## 1. 项目概述

**page_statistics** 是一个网站访问量统计的服务，可以统计网站各个页面和全站的PV/UV。采用 TypeScript 和 Express.js 实现，轻量级，适合中小型规模的网站。

## 2. 核心亮点

- **轻量化部署：** Json文件持久化，无需安装数据库，特别适合静态网站。
- **多域名支持：** 一个服务可同时支持多个域名网站的统计，统计数据根据域名进行隔离。
- **个性化配置：** 提供了灵活的配置参数来配置服务的各项功能，如：端口号、安全策略、日志保存目录和时间等。具体配置项参见 `config.ts` / `config.js`。
- **高性能UV统计：** `uv < 512`时，采用Set容器进行**精确统计**；`uv >= 512`时，采用HyperLogLog算法进行**基数估算统计**。

## 3. 功能列表

- 页面访问触发接口
- 页面访问查询接口
- 获取所有页面统计
- 获取每日统计
- 获取所有按天统计的数据
- 网站访问量查询接口

## 4. 接口文档

[./api.md](./api.md)

## 5. 项目部署

### 5.1. 安装依赖（在开发环境执行）

```bash
npm install
```

### 5.2. 准备部署文件（在开发环境执行）

```bash
npm run deploy:prepare
```

这个命令会：

1. 编译TypeScript代码 (`npm run build`)
2. 将 `package.json` 和 `package-lock.json` 复制到 `./dist` 目录

### 5.3. 部署到服务器

将 `./dist` 目录完整复制到服务器上的目标位置。

### 5.4. 安装依赖（在服务器上执行）

```bash
npm run deploy:server
```

或者手动执行：

```bash
cd ./dist
npm install --production
```

这个命令会安装 `package.json` 中定义的所有生产依赖，包括 `module-alias`。

### 5.5. 启动应用（在服务器上执行）

```bash
node server.js
```
