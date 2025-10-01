import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import apiRoutes from 'routes/api';
import config from 'config';
import logger from 'logger';

const app = express();

// 设置信任代理
if (config.security.trustProxy) {
  app.set('trust proxy', 1);
}

// 中间件
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 自定义 API 路由前缀
const apiPrefix = config.api && config.api.prefix ? `/${config.api.prefix}` : '/api-pagestats';
app.use(apiPrefix, apiRoutes);

// 健康检查
app.get('/health', (req: express.Request, res: express.Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 错误处理
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error(`Error: ${err.message}`);
  res.status(500).json({ error: 'Internal Server Error' });
});

// 404 处理
app.use('*', (req: express.Request, res: express.Response) => {
  res.status(404).json({ error: 'Not Found' });
});

const PORT = config.port || 3000;
app.listen(PORT, () => {
  logger.info(`Page Stats Tracker running on port ${PORT}`);
});